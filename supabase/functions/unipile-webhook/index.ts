// supabase/functions/unipile-webhook/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface UnipileWebhookPayload {
  event: string
  account_id: string
  user_id?: string
  provider: string
  status: 'connected' | 'disconnected' | 'error'
  profile?: {
    username?: string
    profile_url?: string
    email?: string
  }
  error_message?: string
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client with service role key (bypasses RLS)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing environment variables:', {
        supabaseUrl: !!supabaseUrl,
        supabaseServiceKey: !!supabaseServiceKey,
        allEnvVars: Object.keys(Deno.env.toObject())
      })
      throw new Error('Missing required environment variables')
    }

    console.log('✅ Environment variables found, creating Supabase client')
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    })

    // Parse webhook payload
    const payload: UnipileWebhookPayload = await req.json()
    console.log('📥 Received Unipile webhook:', payload)

    // Handle different event types
    switch (payload.event) {
      case 'account.connected':
        await handleAccountConnected(supabase, payload)
        break

      case 'account.disconnected':
        await handleAccountDisconnected(supabase, payload)
        break

      case 'account.error':
        await handleAccountError(supabase, payload)
        break

      default:
        console.log('⚠️ Unknown webhook event:', payload.event)
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Webhook processed' }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    )

  } catch (error) {
    console.error('❌ Webhook error:', error)

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Unknown error occurred'
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    )
  }
})

async function handleAccountConnected(supabase: any, payload: UnipileWebhookPayload) {
  console.log('🎉 Handling account connected:', payload.account_id)

  // Extract LinkedIn public identifier from profile URL
  const profileUrl = payload.profile?.profile_url || ''
  const urlMatch = profileUrl.match(/linkedin\.com\/in\/([\w%-]+)\/?/)
  const linkedinPublicId = urlMatch ? decodeURIComponent(urlMatch[1]).toLowerCase().trim() : null

  if (!linkedinPublicId) {
    console.error('❌ Could not extract LinkedIn public identifier from:', profileUrl)
    throw new Error('Invalid LinkedIn profile URL')
  }

  console.log('🔍 LinkedIn public ID:', linkedinPublicId)

  // Check if this LinkedIn profile is already connected to a DIFFERENT user
  // The unique index will prevent duplicates, but we check first for better UX
  const { data: existingProfile, error: checkError } = await supabase
    .from('user_profiles')
    .select('user_id, linkedin_connection_count, linkedin_profile_snapshot')
    .eq('linkedin_public_identifier', linkedinPublicId)
    .eq('linkedin_connected', true)
    .maybeSingle()

  if (checkError) {
    console.error('❌ Error checking for existing LinkedIn connection:', checkError)
    throw checkError
  }

  // DUPLICATE DETECTED - Same LinkedIn profile already connected to different user
  if (existingProfile && existingProfile.user_id !== payload.user_id) {
    console.warn('🚨 DUPLICATE LINKEDIN CONNECTION DETECTED:', {
      linkedinPublicId,
      existingUser: existingProfile.user_id,
      newUser: payload.user_id,
      newUnipileAccount: payload.account_id
    })

    // Log the rejected connection attempt to webhook_events
    await supabase
      .from('webhook_events')
      .insert({
        user_id: payload.user_id,
        event_type: 'account.connected',
        source: 'other',
        status: 'rejected',
        linkedin_event_type: 'duplicate_rejected',
        connection_status: 'duplicate_rejected',
        rejection_reason: 'LinkedIn profile already connected to another Cold AI account',
        payload: {
          account_id: payload.account_id,
          provider: payload.provider,
          profile: payload.profile,
          existing_user: existingProfile.user_id
        },
        processed: true,
        created_at: new Date().toISOString()
      })

    // Delete the newly created Unipile account since it's a duplicate
    const unipileApiUrl = Deno.env.get('UNIPILE_API_URL')
    const unipileApiKey = Deno.env.get('UNIPILE_API_KEY')

    if (unipileApiUrl && unipileApiKey) {
      console.log('🗑️ Deleting duplicate Unipile account:', payload.account_id)
      try {
        const deleteResponse = await fetch(`${unipileApiUrl}/api/v1/accounts/${payload.account_id}`, {
          method: 'DELETE',
          headers: {
            'X-API-KEY': unipileApiKey
          }
        })

        if (deleteResponse.ok) {
          console.log('✅ Duplicate Unipile account deleted successfully')
        } else {
          console.warn('⚠️ Failed to delete duplicate Unipile account:', await deleteResponse.text())
        }
      } catch (deleteError) {
        console.error('❌ Error deleting duplicate Unipile account:', deleteError)
      }
    }

    // Throw error with custom message to user
    throw new Error('This LinkedIn account is already registered to another email. Please login with that account to continue.\n\nNot you? Please contact support.')
  }

  // Extract organizations data if available
  const organizations = payload.profile?.organizations || []

  // Update user profile with LinkedIn connection
  // This will be a NEW connection or RECONNECTION by same user
  const isReconnection = existingProfile && existingProfile.user_id === payload.user_id
  const now = new Date().toISOString()

  const { error: upsertError } = await supabase
    .from('user_profiles')
    .upsert({
      user_id: payload.user_id,
      linkedin_connected: true,
      unipile_account_id: payload.account_id,
      linkedin_url: profileUrl,
      linkedin_public_identifier: linkedinPublicId,
      linkedin_first_connected_at: isReconnection ? undefined : now,
      linkedin_connection_count: (existingProfile?.linkedin_connection_count || 0) + 1,
      linkedin_profile_snapshot: payload.profile || {},
      linkedin_organizations: organizations,
      updated_at: now
    }, {
      onConflict: 'user_id',
      ignoreDuplicates: false
    })

  if (upsertError) {
    console.error('❌ Failed to update user profile:', upsertError)
    throw upsertError
  }

  // Log the successful connection to webhook_events
  await supabase
    .from('webhook_events')
    .insert({
      user_id: payload.user_id,
      event_type: 'account.connected',
      source: 'other',
      status: 'completed',
      linkedin_event_type: isReconnection ? 'reconnected' : 'connected',
      connection_status: 'active',
      payload: {
        account_id: payload.account_id,
        provider: payload.provider,
        profile: payload.profile,
        event_type: isReconnection ? 'reconnection' : 'first_connection'
      },
      processed: true,
      created_at: now
    })

  console.log(`✅ User profile updated with LinkedIn ${isReconnection ? 'reconnection' : 'connection'}`)
}

async function handleAccountDisconnected(supabase: any, payload: UnipileWebhookPayload) {
  console.log('🔌 Handling account disconnected:', payload.account_id)

  const now = new Date().toISOString()

  // Update user profile to remove LinkedIn connection
  // Note: We keep linkedin_public_identifier, linkedin_url for historical tracking
  // but set linkedin_connected = false which releases the unique constraint
  const { error: updateError } = await supabase
    .from('user_profiles')
    .update({
      linkedin_connected: false,
      unipile_account_id: null,
      linkedin_last_disconnected_at: now,
      updated_at: now
    })
    .eq('unipile_account_id', payload.account_id)

  if (updateError) {
    console.error('❌ Failed to update user profile:', updateError)
    throw updateError
  }

  // Log the disconnection to webhook_events
  await supabase
    .from('webhook_events')
    .insert({
      user_id: payload.user_id,
      event_type: 'account.disconnected',
      source: 'other',
      status: 'completed',
      linkedin_event_type: 'disconnected',
      connection_status: 'disconnected',
      payload: {
        account_id: payload.account_id,
        provider: payload.provider,
        event_type: 'user_disconnection'
      },
      processed: true,
      created_at: now
    })

  console.log('✅ LinkedIn connection removed from user profile')
}

async function handleAccountError(supabase: any, payload: UnipileWebhookPayload) {
  console.log('❌ Handling account error:', payload.error_message)

  const now = new Date().toISOString()

  // Log the error (could also store in database for debugging)
  console.error('Unipile account error:', {
    account_id: payload.account_id,
    user_id: payload.user_id,
    provider: payload.provider,
    error: payload.error_message
  })

  // Update user profile to reflect error state
  if (payload.user_id) {
    await supabase
      .from('user_profiles')
      .update({
        linkedin_connected: false,
        unipile_account_id: null,
        updated_at: now
      })
      .eq('user_id', payload.user_id)
  }

  // Log the error to webhook_events
  await supabase
    .from('webhook_events')
    .insert({
      user_id: payload.user_id,
      event_type: 'account.error',
      source: 'other',
      status: 'failed',
      linkedin_event_type: 'error',
      connection_status: 'failed',
      payload: {
        account_id: payload.account_id,
        provider: payload.provider,
        event_type: 'connection_error',
        error_message: payload.error_message
      },
      error_message: payload.error_message,
      processed: true,
      created_at: now
    })
}

/* To test locally:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/unipile-webhook' \
    --header 'Authorization: Bearer [YOUR_ANON_KEY]' \
    --header 'Content-Type: application/json' \
    --data '{"event": "account.connected", "account_id": "test-123", "user_id": "user-456", "provider": "LINKEDIN", "status": "connected", "profile": {"username": "John Doe", "profile_url": "https://linkedin.com/in/johndoe"}}'

*/