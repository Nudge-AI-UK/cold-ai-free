// supabase/functions/check-login-rate-limit/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

const MAX_FAILED_ATTEMPTS = 5 // Lock after 5 failed attempts
const LOCKOUT_DURATION_MINUTES = 30 // Lock for 30 minutes
const ATTEMPT_WINDOW_MINUTES = 15 // Count attempts in last 15 minutes

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { email, action = 'check' } = await req.json()

    // Get environment variables
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing Supabase configuration')
    }

    // Initialize Supabase client with service role
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Get client IP from request
    const ip_address = req.headers.get('x-forwarded-for')?.split(',')[0] ||
                       req.headers.get('x-real-ip') ||
                       'unknown'

    if (action === 'check') {
      // Check if account is locked
      const { data: lockoutData, error: lockoutError } = await supabase
        .rpc('is_account_locked', { p_email: email })

      if (lockoutError) {
        console.error('Error checking lockout:', lockoutError)
        throw lockoutError
      }

      const lockoutInfo = lockoutData?.[0]

      if (lockoutInfo?.is_locked) {
        const minutesRemaining = Math.ceil(
          (new Date(lockoutInfo.locked_until).getTime() - Date.now()) / 1000 / 60
        )

        return new Response(JSON.stringify({
          allowed: false,
          locked: true,
          locked_until: lockoutInfo.locked_until,
          minutes_remaining: minutesRemaining,
          failed_attempts: lockoutInfo.failed_attempts,
          message: `Account locked due to too many failed attempts. Try again in ${minutesRemaining} minutes.`
        }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // Check failed attempts count
      const { data: failedCount, error: countError } = await supabase
        .rpc('get_failed_attempts_count', {
          p_email: email,
          p_minutes: ATTEMPT_WINDOW_MINUTES
        })

      if (countError) {
        console.error('Error getting failed attempts:', countError)
        // Allow login attempt even if we can't check (fail open for availability)
      }

      const attemptsRemaining = MAX_FAILED_ATTEMPTS - (failedCount || 0)

      return new Response(JSON.stringify({
        allowed: true,
        locked: false,
        failed_attempts: failedCount || 0,
        attempts_remaining: Math.max(0, attemptsRemaining),
        message: attemptsRemaining <= 2 && attemptsRemaining > 0
          ? `Warning: ${attemptsRemaining} attempt(s) remaining before lockout`
          : 'Login allowed'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })

    } else if (action === 'record_attempt') {
      // Record a login attempt
      const { success = false, user_agent = null } = await req.json()

      // Record the attempt
      await supabase.rpc('record_login_attempt', {
        p_email: email,
        p_ip_address: ip_address,
        p_success: success,
        p_user_agent: user_agent
      })

      if (!success) {
        // Get failed attempts count
        const { data: failedCount } = await supabase
          .rpc('get_failed_attempts_count', {
            p_email: email,
            p_minutes: ATTEMPT_WINDOW_MINUTES
          })

        // Lock account if threshold exceeded
        if ((failedCount || 0) >= MAX_FAILED_ATTEMPTS) {
          await supabase.rpc('lock_account', {
            p_email: email,
            p_ip_address: ip_address,
            p_lockout_minutes: LOCKOUT_DURATION_MINUTES
          })

          return new Response(JSON.stringify({
            success: true,
            locked: true,
            message: `Account locked for ${LOCKOUT_DURATION_MINUTES} minutes due to too many failed attempts`
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
      } else {
        // Successful login - unlock account if it was locked
        await supabase.rpc('unlock_account', { p_email: email })
      }

      return new Response(JSON.stringify({
        success: true,
        locked: false,
        message: 'Attempt recorded'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })

    } else if (action === 'unlock') {
      // Manual unlock (for admin use or after password reset)
      await supabase.rpc('unlock_account', { p_email: email })

      return new Response(JSON.stringify({
        success: true,
        message: 'Account unlocked'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({
      error: 'Invalid action'
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Rate limit check error:', error)

    return new Response(JSON.stringify({
      error: error.message,
      allowed: true, // Fail open - allow login attempt even on error
      message: 'Rate limit check failed, proceeding with login'
    }), {
      status: 200, // Return 200 to allow login on error
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
