// supabase/functions/unipile-auth/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface UnipileAuthRequest {
  type: 'create' | 'reconnect'
  providers: string[]
  api_url: string
  expiresOn: string
  userId: string
  success_url?: string
  failure_url?: string
  webhook_url?: string
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
    const body: UnipileAuthRequest = await req.json()
    console.log('🔗 Generating Unipile auth link for user:', body.userId)

    // Prepare Unipile API request
    const unipilePayload = {
      type: body.type,
      providers: body.providers,
      api_url: unipileApiUrl,
      expiresOn: body.expiresOn,
      success_url: body.success_url,
      failure_url: body.failure_url,
      notify_url: body.webhook_url,
      name: body.userId
    }

    console.log('📤 Calling Unipile API with payload:', unipilePayload)

    // Call Unipile API
    const unipileResponse = await fetch(`${unipileApiUrl}/api/v1/hosted/accounts/link`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': unipileApiKey
      },
      body: JSON.stringify(unipilePayload)
    })

    if (!unipileResponse.ok) {
      const errorText = await unipileResponse.text()
      console.error('❌ Unipile API error:', unipileResponse.status, errorText)
      throw new Error(`Unipile API error: ${unipileResponse.status} ${errorText}`)
    }

    const unipileResult = await unipileResponse.json()
    console.log('✅ Unipile auth link generated successfully')

    // Return the auth URL to the frontend
    return new Response(
      JSON.stringify({
        success: true,
        data: {
          url: unipileResult.url || unipileResult.link,
          token: unipileResult.token,
          expiresOn: unipileResult.expiresOn || body.expiresOn
        }
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

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/unipile-auth' \
    --header 'Authorization: Bearer [YOUR_ANON_KEY]' \
    --header 'Content-Type: application/json' \
    --data '{"type": "create", "providers": ["LINKEDIN"], "api_url": "https://api.unipile.com", "expiresOn": "2024-12-22T12:00:00.701Z", "userId": "test-user"}'

*/