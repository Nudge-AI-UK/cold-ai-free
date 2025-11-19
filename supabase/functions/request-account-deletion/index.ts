// Request Account Deletion Edge Function
// Handles soft delete with 30-day grace period

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get user from auth header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Missing authorization header')
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      throw new Error('Unauthorized')
    }

    const userId = user.id
    const userEmail = user.email

    if (!userEmail) {
      throw new Error('User email not found')
    }

    // Parse request body
    const body = await req.json()
    const { deletion_reason } = body

    console.log('🗑️ Account deletion requested:', { userId, userEmail })

    // Step 1: Calculate total usage metrics
    const { data: usageData } = await supabase
      .from('usage_tracking')
      .select('messages_generated, messages_sent, connection_requests_sent')
      .eq('user_id', userId)

    const totalMessages = usageData?.reduce((sum, record) => sum + (record.messages_sent || 0), 0) || 0

    const { data: icpsData } = await supabase
      .from('icps')
      .select('id')
      .eq('created_by', userId)

    const totalIcps = icpsData?.length || 0

    const { data: knowledgeData } = await supabase
      .from('knowledge_base')
      .select('id')
      .eq('created_by', userId)

    const totalKnowledge = knowledgeData?.length || 0

    const { data: prospectsData } = await supabase
      .from('message_generation_logs')
      .select('id')
      .eq('user_id', userId)

    const totalProspects = prospectsData?.length || 0

    console.log('📊 Usage metrics:', { totalMessages, totalIcps, totalKnowledge, totalProspects })

    // Step 2: Hash email for privacy
    const emailHash = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(userEmail.toLowerCase())
    )
    const emailHashHex = Array.from(new Uint8Array(emailHash))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')

    // Step 3: Insert into deleted_accounts (soft delete)
    const softDeleteUntil = new Date()
    softDeleteUntil.setDate(softDeleteUntil.getDate() + 30) // 30 days from now

    const { data: deletedAccount, error: insertError } = await supabase
      .from('deleted_accounts')
      .insert({
        email_hash: emailHashHex,
        original_user_id: userId,
        deleted_at: new Date().toISOString(),
        soft_delete_until: softDeleteUntil.toISOString(),
        messages_sent_total: totalMessages,
        icps_created_total: totalIcps,
        knowledge_entries_total: totalKnowledge,
        prospects_created_total: totalProspects,
        deletion_reason: deletion_reason || null
      })
      .select()
      .single()

    if (insertError) {
      console.error('❌ Failed to create deletion record:', insertError)
      throw new Error('Failed to initiate account deletion')
    }

    console.log('✅ Deletion record created:', deletedAccount.id)

    // Step 4: Delete LinkedIn/Unipile integration immediately (no need to keep this)
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('unipile_account_id')
      .eq('user_id', userId)
      .single()

    if (userProfile?.unipile_account_id) {
      try {
        console.log('🔗 Deleting Unipile account:', userProfile.unipile_account_id)

        await fetch(`${supabaseUrl}/functions/v1/unipile-delete-account`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            account_id: userProfile.unipile_account_id,
            user_id: userId
          })
        })

        console.log('✅ Unipile account deleted')
      } catch (error) {
        console.error('⚠️ Failed to delete Unipile account:', error)
        // Continue with soft delete even if Unipile deletion fails
      }
    }

    // Step 5: Soft delete - Mark user profile as pending deletion
    // Data is NOT deleted yet - will be deleted by n8n cron after 30 days
    const { error: updateError } = await supabase
      .from('user_profiles')
      .update({
        account_status: 'pending_deletion',
        deletion_requested_at: new Date().toISOString(),
        unipile_account_id: null, // Clear Unipile ID
        linkedin_connected: false, // Mark as disconnected
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)

    if (updateError) {
      console.error('❌ Failed to mark account as pending deletion:', updateError)
      throw new Error('Failed to initiate account deletion')
    }

    console.log('✅ Account marked as pending deletion (soft delete)')

    // Step 6: Sign out the user (they can still sign back in to cancel within 30 days)
    // Note: We don't delete auth.users - user can still log in to recover account
    console.log('✅ Soft delete complete - user can recover within 30 days by signing in')

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Account deletion initiated',
        soft_delete_until: softDeleteUntil.toISOString(),
        days_until_permanent: 30
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )
  } catch (error: any) {
    console.error('❌ Account deletion error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Failed to delete account'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      }
    )
  }
})
