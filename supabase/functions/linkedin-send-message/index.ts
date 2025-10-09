// supabase/functions/linkedin-send-message/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SendMessageRequest {
  user_id: string
  message_log_id: number
  recipient_linkedin_url: string
  message_text: string
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

    // Get user authentication
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Missing authorization header')
    }

    // Parse request payload
    const payload: SendMessageRequest = await req.json()
    console.log('📤 LinkedIn send message request:', payload)

    // Validate required fields
    if (!payload.user_id || !payload.message_log_id || !payload.recipient_linkedin_url || !payload.message_text) {
      throw new Error('Missing required fields')
    }

    // Get user's LinkedIn account from integrations table
    console.log('🔍 Fetching LinkedIn account for user:', payload.user_id)
    const { data: integration, error: integrationError } = await supabase
      .from('integrations')
      .select('account_id, access_token, provider_account_id')
      .eq('user_id', payload.user_id)
      .eq('provider', 'linkedin')
      .eq('status', 'connected')
      .single()

    if (integrationError || !integration) {
      console.error('❌ No LinkedIn account found:', integrationError)
      throw new Error('LinkedIn account not connected. Please connect your LinkedIn account first.')
    }

    console.log('✅ Found LinkedIn account:', integration.account_id)

    // Get Unipile API configuration
    const unipileApiUrl = Deno.env.get('UNIPILE_API_URL') || 'https://api.unipile.com:13443'
    const unipileApiKey = Deno.env.get('UNIPILE_API_KEY')

    if (!unipileApiKey) {
      throw new Error('UNIPILE_API_KEY not configured')
    }

    // Extract LinkedIn public identifier from URL
    // e.g., https://linkedin.com/in/john-doe-123/ -> john-doe-123
    const urlMatch = payload.recipient_linkedin_url.match(/linkedin\.com\/in\/([\w%-]+)\/?/)
    if (!urlMatch) {
      throw new Error('Invalid LinkedIn URL format')
    }
    const recipientIdentifier = decodeURIComponent(urlMatch[1])

    // Prepare Unipile API request to start new chat
    console.log('📨 Sending message via Unipile API...')
    const unipilePayload = {
      account_id: integration.account_id,
      attendees: [{
        identifier: recipientIdentifier,
        provider: 'LINKEDIN'
      }],
      text: payload.message_text
    }

    console.log('🔧 Unipile request:', { ...unipilePayload, text: '[REDACTED]' })

    const unipileResponse = await fetch(`${unipileApiUrl}/api/v1/chats`, {
      method: 'POST',
      headers: {
        'X-API-KEY': unipileApiKey,
        'Content-Type': 'application/json',
        'accept': 'application/json'
      },
      body: JSON.stringify(unipilePayload)
    })

    const unipileData = await unipileResponse.json()

    if (!unipileResponse.ok) {
      console.error('❌ Unipile API error:', unipileData)
      throw new Error(unipileData.message || 'Failed to send message via Unipile')
    }

    console.log('✅ Message sent successfully via Unipile:', unipileData)

    // Update message_generation_logs to mark as sent
    const { error: updateError } = await supabase
      .from('message_generation_logs')
      .update({
        message_status: 'sent',
        sent_at: new Date().toISOString(),
        message_metadata: {
          unipile_chat_id: unipileData.object?.id,
          sent_via: 'linkedin',
          sent_at: new Date().toISOString()
        },
        updated_at: new Date().toISOString()
      })
      .eq('id', payload.message_log_id)

    if (updateError) {
      console.error('❌ Failed to update message log:', updateError)
      // Don't fail the request since message was sent successfully
    }

    // Update usage tracking (messages_sent)
    const today = new Date().toISOString().split('T')[0]
    const { error: usageError } = await supabase.rpc('increment_usage_tracking', {
      p_user_id: payload.user_id,
      p_usage_date: today,
      p_field: 'messages_sent',
      p_increment: 1
    })

    if (usageError) {
      console.error('❌ Failed to update usage tracking:', usageError)
      // Don't fail the request since message was sent
    }

    // Return success response
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Message sent successfully via LinkedIn',
        chat_id: unipileData.object?.id,
        timestamp: new Date().toISOString()
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    )

  } catch (error) {
    console.error('❌ Send message error:', error)

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Unknown error occurred',
        timestamp: new Date().toISOString()
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

/* To test locally:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/linkedin-send-message' \
    --header 'Authorization: Bearer [YOUR_USER_TOKEN]' \
    --header 'Content-Type: application/json' \
    --data '{
      "user_id": "test-user-123",
      "message_log_id": 1,
      "recipient_linkedin_url": "https://linkedin.com/in/john-doe/",
      "message_text": "Hi John, I came across your profile..."
    }'

  Expected response:
  {
    "success": true,
    "message": "Message sent successfully via LinkedIn",
    "chat_id": "...",
    "timestamp": "2025-10-08T..."
  }

*/
