// supabase/functions/unipile-delete-account/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface DeleteAccountRequest {
  account_id: string
  user_id: string
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
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

    if (!body.account_id) {
      throw new Error('account_id is required')
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
