
// supabase/functions/message-generate/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface MessageGenerateRequest {
  user_id: string
  prospect_data?: {
    name?: string
    company?: string
    role?: string
    linkedin_url?: string
  }
  message_type?: 'first_message' | 'follow_up' | 'reply'
  outreach_goal?: 'meeting' | 'call' | 'email' | 'soft'
  campaign_id?: string
  product_id?: number
  icp_id?: number
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
    const payload: MessageGenerateRequest = await req.json()
    console.log('📨 Message generation request:', payload)

    // Validate required fields
    if (!payload.user_id) {
      throw new Error('user_id is required')
    }

    // Create initial log entry in database
    console.log('📝 Creating message generation log entry...')
    const { data: logEntry, error: logError } = await supabase
      .from('message_generation_logs')
      .insert({
        user_id: payload.user_id,
        message_status: 'analysing_prospect', // Start with initial status, not 'generated'
        created_at: new Date().toISOString()
      })
      .select('id')
      .single()

    if (logError || !logEntry) {
      console.error('❌ Failed to create log entry:', logError)
      throw new Error('Failed to create message generation log')
    }

    const messageLogId = logEntry.id
    console.log('✅ Created log entry with ID:', messageLogId)

    // Get message webhook URL
    const messageWebhook = Deno.env.get('N8N_MESSAGE_WEBHOOK')
    if (!messageWebhook) {
      throw new Error('N8N_MESSAGE_WEBHOOK not configured')
    }

    // For now, append _1 to the webhook URL (load balancing commented out for later)
    const selectedWorker = `${messageWebhook}_1`
    console.log('🔧 Using n8n worker:', selectedWorker)

    // Prepare data for n8n workflow
    const n8nPayload = {
      action: 'generate_message',
      message_log_id: messageLogId, // ID for the message_generation_logs record
      user_id: payload.user_id,
      prospect_url: payload.prospect_data?.linkedin_url || '',
      prospect_data: payload.prospect_data || {},
      message_type: payload.message_type || 'first_message',
      outreach_goal: payload.outreach_goal || 'meeting',
      product_id: payload.product_id,
      icp_id: payload.icp_id,
      campaign_id: payload.campaign_id,
      timestamp: new Date().toISOString(),
      request_id: crypto.randomUUID()
    }

    // Trigger n8n workflow asynchronously (fire and forget)
    console.log('🚀 Triggering n8n workflow (async)...')
    fetch(selectedWorker, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(n8nPayload),
    }).catch(error => {
      console.error('❌ n8n webhook trigger failed:', error)
      // Update log entry with error status
      supabase
        .from('message_generation_logs')
        .update({
          message_status: 'failed',
          message_metadata: {
            error: error.message,
            failed_at: new Date().toISOString()
          },
          updated_at: new Date().toISOString()
        })
        .eq('id', messageLogId)
        .then(() => console.log('Updated log entry with error status'))
    })

    // Return message_log_id immediately
    console.log('✅ Returning message_log_id to client')
    return new Response(
      JSON.stringify({
        success: true,
        log_id: messageLogId,
        message: 'Message generation started'
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
    console.error('❌ Message generation error:', error)

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

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/message-generate' \
    --header 'Authorization: Bearer [YOUR_USER_TOKEN]' \
    --header 'Content-Type: application/json' \
    --data '{
      "user_id": "test-user-123",
      "prospect_data": {
        "linkedin_url": "https://linkedin.com/in/example"
      },
      "message_type": "first_message",
      "outreach_goal": "meeting",
      "product_id": 1,
      "icp_id": 1
    }'

  Expected response:
  {
    "success": true,
    "log_id": 123,
    "message": "Message generation started"
  }

  Then subscribe to message_generation_logs table (id=123) for progress updates.

  Note: n8n webhook receives "message_log_id" field (not "log_id") to avoid confusion with webhook_events.log_id

*/