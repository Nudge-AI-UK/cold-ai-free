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

  // Update user profile with LinkedIn connection
  const { error } = await supabase
    .from('user_profiles')
    .upsert({
      user_id: payload.user_id,
      linkedin_connected: true,
      unipile_account_id: payload.account_id,
      linkedin_url: payload.profile?.profile_url || '',
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'user_id'
    })

  if (error) {
    console.error('❌ Failed to update user profile:', error)
    throw error
  }

  console.log('✅ User profile updated with LinkedIn connection')
}

async function handleAccountDisconnected(supabase: any, payload: UnipileWebhookPayload) {
  console.log('🔌 Handling account disconnected:', payload.account_id)

  // Remove LinkedIn connection from user profile
  const { error } = await supabase
    .from('user_profiles')
    .update({
      linkedin_connected: false,
      unipile_account_id: null,
      linkedin_url: null,
      updated_at: new Date().toISOString()
    })
    .eq('unipile_account_id', payload.account_id)

  if (error) {
    console.error('❌ Failed to update user profile:', error)
    throw error
  }

  console.log('✅ LinkedIn connection removed from user profile')
}

async function handleAccountError(supabase: any, payload: UnipileWebhookPayload) {
  console.log('❌ Handling account error:', payload.error_message)

  // Log the error (could also store in database for debugging)
  console.error('Unipile account error:', {
    account_id: payload.account_id,
    user_id: payload.user_id,
    provider: payload.provider,
    error: payload.error_message
  })

  // Optionally update user profile to reflect error state
  if (payload.user_id) {
    await supabase
      .from('user_profiles')
      .update({
        linkedin_connected: false,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', payload.user_id)
  }
}

/* To test locally:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/unipile-webhook' \
    --header 'Authorization: Bearer [YOUR_ANON_KEY]' \
    --header 'Content-Type: application/json' \
    --data '{"event": "account.connected", "account_id": "test-123", "user_id": "user-456", "provider": "LINKEDIN", "status": "connected", "profile": {"username": "John Doe", "profile_url": "https://linkedin.com/in/johndoe"}}'

*/