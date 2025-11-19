// supabase/functions/unipile-delete-account/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface DeleteAccountRequest {
  account_id: string
  user_id: string
  action?: 'disconnected' | 'blocked_by_cold'  // Action type for history tracking
  error_message?: string  // Error message for blocked connections
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get Unipile API credentials from Supabase secrets
    const unipileApiUrl = Deno.env.get('UNIPILE_API_URL') || 'https://api.unipile.com'
    const unipileApiKey = Deno.env.get('UNIPILE_API_KEY')

    if (!unipileApiKey) {
      console.error('❌ UNIPILE_API_KEY not found in Supabase secrets')
      throw new Error('Unipile API key not configured')
    }

    // Parse request body
    const body: DeleteAccountRequest = await req.json()
    console.log('🗑️ Deleting Unipile account:', body.account_id, 'for user:', body.user_id)

    if (!body.account_id || !body.user_id) {
      throw new Error('account_id and user_id are required')
    }

    // Call Unipile API to delete the account
    const unipileResponse = await fetch(`${unipileApiUrl}/api/v1/accounts/${body.account_id}`, {
      method: 'DELETE',
      headers: {
        'X-API-KEY': unipileApiKey
      }
    })

    if (!unipileResponse.ok) {
      const errorText = await unipileResponse.text()
      console.error('❌ Unipile API error:', unipileResponse.status, errorText)

      // If account not found (404), consider it already deleted
      if (unipileResponse.status === 404) {
        console.log('⚠️ Account not found on Unipile (already deleted or never existed)')
        return new Response(
          JSON.stringify({
            success: true,
            message: 'Account not found (already deleted)',
            account_id: body.account_id
          }),
          {
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json'
            }
          }
        )
      }

      throw new Error(`Unipile API error: ${unipileResponse.status} ${errorText}`)
    }

    console.log('✅ Unipile account deleted successfully')

    // Get user's current linkedin_public_identifier and history before clearing
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('linkedin_public_identifier, linkedin_connection_history')
      .eq('user_id', body.user_id)
      .single()

    const linkedinIdentifier = userProfile?.linkedin_public_identifier

    // Determine the action type (defaults to 'disconnected' for backward compatibility)
    const action = body.action || 'disconnected'

    // Get current history and append event
    const currentHistory = (userProfile?.linkedin_connection_history as any[]) || []
    const newHistoryEntry = {
      identifier: linkedinIdentifier,
      event: action,
      timestamp: new Date().toISOString(),
      ...(body.error_message && { error_message: body.error_message })  // Include error if provided
    }

    // Update user_profiles to record event
    const updateData: any = {
      linkedin_connected: false,
      unipile_account_id: null,
      linkedin_connection_history: [...currentHistory, newHistoryEntry],
      updated_at: new Date().toISOString()
    }

    // If this is a blocked attempt, set the error message for the widget to display
    if (action === 'blocked_by_cold' && body.error_message) {
      updateData.linkedin_connection_error = body.error_message
    } else if (action === 'disconnected') {
      // Clear error on successful disconnection
      updateData.linkedin_connection_error = null
    }

    await supabase
      .from('user_profiles')
      .update(updateData)
      .eq('user_id', body.user_id)

    console.log(`✅ LinkedIn ${action} event recorded in history`)

    // Return success response
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Account deleted successfully',
        account_id: body.account_id
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    )

  } catch (error) {
    console.error('❌ Edge Function error:', error)

    // Return error response
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

/* To invoke locally:

  1. Run `supabase start`
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/unipile-delete-account' \
    --header 'Authorization: Bearer [YOUR_ANON_KEY]' \
    --header 'Content-Type: application/json' \
    --data '{"account_id": "acc_123456", "user_id": "user-123"}'

*/
