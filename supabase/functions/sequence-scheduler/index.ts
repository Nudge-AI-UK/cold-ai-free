// supabase/functions/sequence-scheduler/index.ts
// This function should be called by a cron job every 5-10 minutes
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Rate limits (per LinkedIn account per day)
const RATE_LIMITS = {
  connection_requests: 80, // Conservative limit
  messages: 100,
  inmails: 50
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('🔄 Starting sequence scheduler...')

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const unipileApiUrl = Deno.env.get('UNIPILE_API_URL')
    const unipileApiKey = Deno.env.get('UNIPILE_API_KEY')

    if (!unipileApiUrl || !unipileApiKey) {
      throw new Error('Unipile API not configured')
    }

    // Get all active sequences
    const { data: sequences, error: seqError } = await supabase
      .from('outreach_sequences')
      .select('*')
      .eq('status', 'active')

    if (seqError) throw seqError

    console.log(`📋 Found ${sequences?.length || 0} active sequences`)

    let processedCount = 0
    let sentCount = 0
    let errorCount = 0

    // Process each sequence
    for (const sequence of sequences || []) {
      try {
        console.log(`\n📨 Processing sequence: ${sequence.sequence_name} (ID: ${sequence.id})`)

        // Check today's usage for this user
        const today = new Date().toISOString().split('T')[0]
        const { data: usageData } = await supabase
          .from('usage_tracking')
          .select('connection_requests_sent, messages_sent')
          .eq('user_id', sequence.user_id)
          .eq('usage_date', today)
          .single()

        const todayRequests = usageData?.connection_requests_sent || 0
        const todayMessages = usageData?.messages_sent || 0

        console.log(`📊 Today's usage: ${todayRequests} requests, ${todayMessages} messages`)

        // Check if we've hit daily limit
        const limit = sequence.daily_limit || 50
        const requestsRemaining = Math.min(limit, RATE_LIMITS.connection_requests) - todayRequests

        if (requestsRemaining <= 0) {
          console.log(`⏸️ Daily limit reached for user ${sequence.user_id}`)
          continue
        }

        // Get prospects that are scheduled to send now
        const { data: prospects, error: prospectError } = await supabase
          .from('sequence_prospects')
          .select('*')
          .eq('sequence_id', sequence.id)
          .eq('status', 'scheduled')
          .lte('scheduled_for', new Date().toISOString())
          .order('scheduled_for', { ascending: true })
          .limit(requestsRemaining) // Don't exceed remaining quota

        if (prospectError) throw prospectError

        if (!prospects || prospects.length === 0) {
          console.log(`✅ No prospects ready to send for sequence ${sequence.id}`)
          continue
        }

        console.log(`🎯 Found ${prospects.length} prospects ready to send`)

        // Get user's Unipile account
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('unipile_account_id')
          .eq('user_id', sequence.user_id)
          .single()

        if (!profile?.unipile_account_id) {
          console.error(`❌ No Unipile account for user ${sequence.user_id}`)
          continue
        }

        // Process each prospect
        for (const prospect of prospects) {
          try {
            processedCount++

            // Update status to sending
            await supabase
              .from('sequence_prospects')
              .update({ status: 'sending' })
              .eq('id', prospect.id)

            // Get the message template for this step
            const messageText = prospect.current_step === 0
              ? sequence.message_template
              : sequence.follow_up_messages?.[prospect.current_step - 1]?.message

            if (!messageText) {
              throw new Error(`No message template for step ${prospect.current_step}`)
            }

            // Personalize message (replace placeholders)
            const personalizedMessage = messageText
              .replace(/\{firstName\}/g, prospect.prospect_name?.split(' ')[0] || 'there')
              .replace(/\{name\}/g, prospect.prospect_name || 'there')
              .replace(/\{company\}/g, prospect.prospect_company || 'your company')
              .replace(/\{headline\}/g, prospect.prospect_headline || '')

            console.log(`📤 Sending to ${prospect.prospect_name} (${prospect.linkedin_url})`)

            // Determine message type
            const isConnectionRequest = sequence.sequence_type === 'connection_request'
            const isInMail = sequence.sequence_type === 'inmail'

            // Build form data for Unipile API
            const formData = new FormData()
            formData.append('attendees_ids', prospect.linkedin_messaging_id)
            formData.append('text', personalizedMessage)
            formData.append('account_id', profile.unipile_account_id)
            formData.append('inmail', isInMail ? 'true' : 'false')
            formData.append('api', 'classic')

            // Send via Unipile
            const unipileResponse = await fetch(`${unipileApiUrl}/api/v1/chats`, {
              method: 'POST',
              headers: {
                'accept': 'application/json',
                'X-API-KEY': unipileApiKey
              },
              body: formData
            })

            const unipileData = await unipileResponse.json()

            if (!unipileResponse.ok) {
              throw new Error(unipileData.message || 'Failed to send via Unipile')
            }

            console.log(`✅ Sent successfully! Chat ID: ${unipileData.object?.id}`)

            // Update prospect status
            await supabase
              .from('sequence_prospects')
              .update({
                status: 'sent',
                sent_at: new Date().toISOString(),
                last_message_at: new Date().toISOString(),
                unipile_chat_id: unipileData.object?.id,
                current_step: prospect.current_step + 1
              })
              .eq('id', prospect.id)

            // Log the message
            await supabase
              .from('sequence_messages')
              .insert({
                sequence_id: sequence.id,
                prospect_id: prospect.id,
                user_id: sequence.user_id,
                message_text: personalizedMessage,
                message_type: isConnectionRequest ? 'connection_request' : isInMail ? 'inmail' : 'message',
                step_number: prospect.current_step,
                status: 'sent',
                sent_at: new Date().toISOString(),
                unipile_chat_id: unipileData.object?.id
              })

            // Update sequence stats
            await supabase
              .from('outreach_sequences')
              .update({
                sent_count: sequence.sent_count + 1
              })
              .eq('id', sequence.id)

            // Update quota tracking using the new quota system
            // This automatically handles legacy usage_tracking updates as well
            const messageType = isConnectionRequest ? 'connection_request' : isInMail ? 'inmail' : 'direct_message'
            await supabase.rpc('increment_message_quota', {
              p_user_id: sequence.user_id,
              p_message_type: messageType,
              p_is_personalised: personalizedMessage.length > 0 // Consider any message with content as personalised
            })

            // Schedule next follow-up if applicable
            const followUpMessages = sequence.follow_up_messages || []
            if (prospect.current_step + 1 < followUpMessages.length) {
              const nextFollowUp = followUpMessages[prospect.current_step]
              const delayDays = nextFollowUp.delay_days || 2

              const nextSendTime = new Date()
              nextSendTime.setDate(nextSendTime.getDate() + delayDays)

              await supabase
                .from('sequence_prospects')
                .update({
                  status: 'scheduled',
                  scheduled_for: nextSendTime.toISOString()
                })
                .eq('id', prospect.id)

              console.log(`📅 Scheduled follow-up for ${delayDays} days from now`)
            }

            sentCount++

            // Add random delay between sends (5-15 minutes)
            const delayMin = sequence.delay_between_min || 5
            const delayMax = sequence.delay_between_max || 15
            const delayMs = (delayMin + Math.random() * (delayMax - delayMin)) * 60 * 1000
            console.log(`⏳ Waiting ${Math.round(delayMs / 60000)} minutes before next send...`)
            await new Promise(resolve => setTimeout(resolve, delayMs))

          } catch (prospectError) {
            console.error(`❌ Error sending to prospect ${prospect.id}:`, prospectError)
            errorCount++

            // Update prospect with error
            await supabase
              .from('sequence_prospects')
              .update({
                status: 'failed',
                error_message: prospectError.message
              })
              .eq('id', prospect.id)

            // Update sequence failed count
            await supabase
              .from('outreach_sequences')
              .update({
                failed_count: sequence.failed_count + 1
              })
              .eq('id', sequence.id)
          }
        }

      } catch (seqError) {
        console.error(`❌ Error processing sequence ${sequence.id}:`, seqError)
        errorCount++
      }
    }

    console.log(`\n✅ Scheduler complete:`)
    console.log(`   Processed: ${processedCount}`)
    console.log(`   Sent: ${sentCount}`)
    console.log(`   Errors: ${errorCount}`)

    return new Response(
      JSON.stringify({
        success: true,
        processed: processedCount,
        sent: sentCount,
        errors: errorCount,
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
    console.error('❌ Scheduler error:', error)

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

/* To set up cron job in Supabase:
 *
 * Add this to supabase/functions/_shared/cron.ts or via Supabase Dashboard:
 *
 * Schedule: */5 * * * *  (every 5 minutes)
 * URL: https://your-project.supabase.co/functions/v1/sequence-scheduler
 * Method: POST
 * Headers: { "Authorization": "Bearer YOUR_SERVICE_ROLE_KEY" }
 */
