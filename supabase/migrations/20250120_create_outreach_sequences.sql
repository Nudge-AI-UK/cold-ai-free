-- =====================================================
-- OUTREACH SEQUENCES & QUOTA TRACKING MIGRATION
-- Comprehensive LinkedIn automation with quota management
-- Updated to match existing schema (character varying user_id)
-- =====================================================

-- =====================================================
-- PART 1: OUTREACH SEQUENCES TABLES
-- =====================================================

-- Create outreach_sequences table
CREATE TABLE IF NOT EXISTS outreach_sequences (
  id BIGSERIAL PRIMARY KEY,
  user_id CHARACTER VARYING NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  team_id CHARACTER VARYING REFERENCES teams(team_id) ON DELETE CASCADE,

  -- Sequence details
  sequence_name TEXT NOT NULL,
  sequence_type TEXT NOT NULL CHECK (sequence_type IN ('connection_request', 'inmail', 'message')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'completed', 'archived')),

  -- Target audience
  icp_id BIGINT REFERENCES icps(id) ON DELETE SET NULL,
  target_search_query TEXT,
  target_filters JSONB DEFAULT '{}',

  -- Message content
  message_template TEXT NOT NULL,
  follow_up_messages JSONB DEFAULT '[]', -- Array of follow-up messages with delays

  -- Scheduling
  daily_limit INTEGER NOT NULL DEFAULT 50 CHECK (daily_limit <= 100),
  delay_between_min INTEGER NOT NULL DEFAULT 5, -- Minutes between sends (randomized)
  delay_between_max INTEGER NOT NULL DEFAULT 15,
  working_hours_only BOOLEAN DEFAULT true,
  working_days INTEGER[] DEFAULT ARRAY[1,2,3,4,5], -- Mon-Fri
  timezone TEXT DEFAULT 'UTC',

  -- Progress tracking
  total_targets INTEGER DEFAULT 0,
  sent_count INTEGER DEFAULT 0,
  accepted_count INTEGER DEFAULT 0,
  replied_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  -- Ensure user can't exceed rate limits
  CONSTRAINT reasonable_daily_limit CHECK (daily_limit BETWEEN 1 AND 100)
);

-- Create sequence_prospects table (individual targets in a sequence)
CREATE TABLE IF NOT EXISTS sequence_prospects (
  id BIGSERIAL PRIMARY KEY,
  sequence_id BIGINT NOT NULL REFERENCES outreach_sequences(id) ON DELETE CASCADE,
  user_id CHARACTER VARYING NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,

  -- Prospect details
  linkedin_url TEXT NOT NULL,
  linkedin_public_id TEXT NOT NULL,
  linkedin_messaging_id TEXT, -- From Unipile
  prospect_name TEXT,
  prospect_headline TEXT,
  prospect_company TEXT,
  prospect_data JSONB DEFAULT '{}',

  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',
    'searching',
    'scheduled',
    'sending',
    'sent',
    'accepted',
    'replied',
    'failed',
    'skipped'
  )),

  -- Timing
  scheduled_for TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  last_message_at TIMESTAMPTZ,

  -- Current step in sequence
  current_step INTEGER DEFAULT 0, -- 0 = initial message, 1+ = follow-ups

  -- Results
  connection_accepted BOOLEAN DEFAULT false,
  response_received BOOLEAN DEFAULT false,
  unipile_chat_id TEXT,
  error_message TEXT,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Prevent duplicates
  UNIQUE(sequence_id, linkedin_public_id)
);

-- Create sequence_messages table (track all messages sent)
CREATE TABLE IF NOT EXISTS sequence_messages (
  id BIGSERIAL PRIMARY KEY,
  sequence_id BIGINT NOT NULL REFERENCES outreach_sequences(id) ON DELETE CASCADE,
  prospect_id BIGINT NOT NULL REFERENCES sequence_prospects(id) ON DELETE CASCADE,
  user_id CHARACTER VARYING NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,

  -- Message details
  message_text TEXT NOT NULL,
  message_type TEXT NOT NULL CHECK (message_type IN ('connection_request', 'inmail', 'message', 'follow_up')),
  step_number INTEGER NOT NULL DEFAULT 0,

  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sending', 'sent', 'failed')),

  -- Unipile data
  unipile_chat_id TEXT,
  unipile_message_id TEXT,

  -- Timing
  scheduled_for TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,

  -- Error handling
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- PART 2: QUOTA TRACKING TABLES
-- =====================================================

-- LinkedIn Account Configuration
-- Stores user's LinkedIn account type and limits
CREATE TABLE IF NOT EXISTS linkedin_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id CHARACTER VARYING NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  account_type TEXT NOT NULL DEFAULT 'free' CHECK (account_type IN ('free', 'premium', 'sales_navigator', 'recruiter_lite', 'recruiter_pro')),
  ssi_score INTEGER DEFAULT 0 CHECK (ssi_score >= 0 AND ssi_score <= 100),

  -- InMail credits
  inmail_credits_remaining INTEGER DEFAULT 0,
  inmail_credits_max INTEGER DEFAULT 0,
  inmail_renewal_date TIMESTAMPTZ,

  -- Account health
  connection_acceptance_rate DECIMAL(3,2) DEFAULT 0.50,
  message_response_rate DECIMAL(3,2) DEFAULT 0.10,
  account_status TEXT DEFAULT 'active' CHECK (account_status IN ('active', 'warning', 'restricted', 'suspended')),
  last_restriction_date TIMESTAMPTZ,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id)
);

-- Message Quotas
-- Tracks all message sending limits and usage
CREATE TABLE IF NOT EXISTS message_quotas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id CHARACTER VARYING NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,

  -- Daily quotas (reset at midnight user's timezone)
  daily_direct_messages INTEGER DEFAULT 0,
  daily_connection_requests INTEGER DEFAULT 0,
  daily_inmails INTEGER DEFAULT 0,
  daily_open_profile INTEGER DEFAULT 0,
  daily_group_messages INTEGER DEFAULT 0,
  daily_total_actions INTEGER DEFAULT 0,
  daily_reset_at TIMESTAMPTZ DEFAULT DATE_TRUNC('day', NOW()) + INTERVAL '1 day',

  -- Weekly quotas (reset 7 days from first action)
  weekly_connection_requests INTEGER DEFAULT 0,
  weekly_first_action_at TIMESTAMPTZ,
  weekly_reset_at TIMESTAMPTZ,

  -- Monthly quotas (reset on billing cycle or month start)
  monthly_personalised_connections INTEGER DEFAULT 0, -- For free accounts only
  monthly_open_profile_messages INTEGER DEFAULT 0,    -- 800/month limit
  monthly_reset_at TIMESTAMPTZ DEFAULT DATE_TRUNC('month', NOW()) + INTERVAL '1 month',

  -- Pending counts
  pending_connections INTEGER DEFAULT 0,
  pending_inmails INTEGER DEFAULT 0,

  -- Rate limiting
  last_action_at TIMESTAMPTZ,
  hourly_action_count INTEGER DEFAULT 0,
  hourly_reset_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id)
);

-- Enhance existing message_generation_logs table with LinkedIn-specific fields
-- This consolidates AI generation and sending logs into one table
DO $$
BEGIN
  -- LinkedIn message type
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'message_generation_logs' AND column_name = 'message_type'
  ) THEN
    ALTER TABLE message_generation_logs
    ADD COLUMN message_type TEXT CHECK (message_type IN (
      'direct_message',
      'connection_request',
      'inmail',
      'open_profile',
      'group_message',
      'event_message'
    ));
  END IF;

  -- Recipient details
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'message_generation_logs' AND column_name = 'recipient_linkedin_id'
  ) THEN
    ALTER TABLE message_generation_logs
    ADD COLUMN recipient_linkedin_id TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'message_generation_logs' AND column_name = 'recipient_name'
  ) THEN
    ALTER TABLE message_generation_logs
    ADD COLUMN recipient_name TEXT;
  END IF;

  -- Subject line (for InMails)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'message_generation_logs' AND column_name = 'subject_line'
  ) THEN
    ALTER TABLE message_generation_logs
    ADD COLUMN subject_line TEXT;
  END IF;

  -- Message analytics
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'message_generation_logs' AND column_name = 'message_length'
  ) THEN
    ALTER TABLE message_generation_logs
    ADD COLUMN message_length INTEGER;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'message_generation_logs' AND column_name = 'is_personalised'
  ) THEN
    ALTER TABLE message_generation_logs
    ADD COLUMN is_personalised BOOLEAN DEFAULT false;
  END IF;

  -- Unipile integration
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'message_generation_logs' AND column_name = 'unipile_message_id'
  ) THEN
    ALTER TABLE message_generation_logs
    ADD COLUMN unipile_message_id TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'message_generation_logs' AND column_name = 'unipile_thread_id'
  ) THEN
    ALTER TABLE message_generation_logs
    ADD COLUMN unipile_thread_id TEXT;
  END IF;

  -- InMail tracking
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'message_generation_logs' AND column_name = 'inmail_credit_consumed'
  ) THEN
    ALTER TABLE message_generation_logs
    ADD COLUMN inmail_credit_consumed BOOLEAN DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'message_generation_logs' AND column_name = 'inmail_credit_refunded'
  ) THEN
    ALTER TABLE message_generation_logs
    ADD COLUMN inmail_credit_refunded BOOLEAN DEFAULT false;
  END IF;

  -- Link to sequence system
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'message_generation_logs' AND column_name = 'sequence_id'
  ) THEN
    ALTER TABLE message_generation_logs
    ADD COLUMN sequence_id BIGINT REFERENCES outreach_sequences(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'message_generation_logs' AND column_name = 'sequence_message_id'
  ) THEN
    ALTER TABLE message_generation_logs
    ADD COLUMN sequence_message_id BIGINT REFERENCES sequence_messages(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Connection Requests Tracking
-- Separate table for detailed connection request management
CREATE TABLE IF NOT EXISTS connection_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id CHARACTER VARYING NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  recipient_linkedin_id TEXT NOT NULL,

  -- Request details
  message_text TEXT,
  message_length INTEGER,
  is_personalised BOOLEAN DEFAULT false,

  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'ignored', 'withdrawn')),
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  status_changed_at TIMESTAMPTZ,

  -- Auto-withdrawal tracking
  withdrawal_scheduled_for TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '14 days'),
  auto_withdrawn BOOLEAN DEFAULT false,

  -- Link to sequence system
  sequence_id BIGINT REFERENCES outreach_sequences(id) ON DELETE SET NULL,
  prospect_id BIGINT REFERENCES sequence_prospects(id) ON DELETE SET NULL,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Quota Violations Log
-- Track when limits are hit for analysis
CREATE TABLE IF NOT EXISTS quota_violations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id CHARACTER VARYING NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  violation_type TEXT NOT NULL,
  limit_value INTEGER,
  actual_value INTEGER,
  message TEXT,
  occurred_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- PART 3: UPDATE EXISTING USAGE_TRACKING TABLE
-- =====================================================

-- Add connection_requests_sent column to existing usage_tracking
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'usage_tracking'
    AND column_name = 'connection_requests_sent'
  ) THEN
    ALTER TABLE usage_tracking
    ADD COLUMN connection_requests_sent INTEGER DEFAULT 0;
  END IF;
END $$;

-- =====================================================
-- PART 4: INDEXES FOR PERFORMANCE
-- =====================================================

-- Sequence indexes
CREATE INDEX IF NOT EXISTS idx_sequences_user_id ON outreach_sequences(user_id);
CREATE INDEX IF NOT EXISTS idx_sequences_status ON outreach_sequences(status);
CREATE INDEX IF NOT EXISTS idx_prospects_sequence_id ON sequence_prospects(sequence_id);
CREATE INDEX IF NOT EXISTS idx_prospects_status ON sequence_prospects(status);
CREATE INDEX IF NOT EXISTS idx_prospects_scheduled_for ON sequence_prospects(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_messages_sequence_id ON sequence_messages(sequence_id);
CREATE INDEX IF NOT EXISTS idx_messages_prospect_id ON sequence_messages(prospect_id);
CREATE INDEX IF NOT EXISTS idx_messages_scheduled_for ON sequence_messages(scheduled_for);

-- Quota tracking indexes
CREATE INDEX IF NOT EXISTS idx_linkedin_accounts_user ON linkedin_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_message_quotas_user ON message_quotas(user_id);
CREATE INDEX IF NOT EXISTS idx_message_gen_logs_user_date ON message_generation_logs(user_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_message_gen_logs_user_type ON message_generation_logs(user_id, message_type, sent_at) WHERE message_type IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_message_gen_logs_unipile ON message_generation_logs(unipile_message_id) WHERE unipile_message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_message_gen_logs_sequence ON message_generation_logs(sequence_id) WHERE sequence_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_connection_pending ON connection_requests(user_id, status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_violations_user_date ON quota_violations(user_id, occurred_at DESC);

-- =====================================================
-- PART 5: ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Sequence tables RLS
ALTER TABLE outreach_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE sequence_prospects ENABLE ROW LEVEL SECURITY;
ALTER TABLE sequence_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own sequences" ON outreach_sequences
  FOR SELECT USING (user_id = current_setting('request.jwt.claims', true)::json->>'user_id');
CREATE POLICY "Users can create sequences" ON outreach_sequences
  FOR INSERT WITH CHECK (user_id = current_setting('request.jwt.claims', true)::json->>'user_id');
CREATE POLICY "Users can update their own sequences" ON outreach_sequences
  FOR UPDATE USING (user_id = current_setting('request.jwt.claims', true)::json->>'user_id');
CREATE POLICY "Users can delete their own sequences" ON outreach_sequences
  FOR DELETE USING (user_id = current_setting('request.jwt.claims', true)::json->>'user_id');

CREATE POLICY "Users can view their sequence prospects" ON sequence_prospects
  FOR SELECT USING (user_id = current_setting('request.jwt.claims', true)::json->>'user_id');
CREATE POLICY "Users can create sequence prospects" ON sequence_prospects
  FOR INSERT WITH CHECK (user_id = current_setting('request.jwt.claims', true)::json->>'user_id');
CREATE POLICY "Users can update their sequence prospects" ON sequence_prospects
  FOR UPDATE USING (user_id = current_setting('request.jwt.claims', true)::json->>'user_id');
CREATE POLICY "Users can delete their sequence prospects" ON sequence_prospects
  FOR DELETE USING (user_id = current_setting('request.jwt.claims', true)::json->>'user_id');

CREATE POLICY "Users can view their sequence messages" ON sequence_messages
  FOR SELECT USING (user_id = current_setting('request.jwt.claims', true)::json->>'user_id');
CREATE POLICY "Users can create sequence messages" ON sequence_messages
  FOR INSERT WITH CHECK (user_id = current_setting('request.jwt.claims', true)::json->>'user_id');
CREATE POLICY "Users can update their sequence messages" ON sequence_messages
  FOR UPDATE USING (user_id = current_setting('request.jwt.claims', true)::json->>'user_id');

-- Quota tracking tables RLS
ALTER TABLE linkedin_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_quotas ENABLE ROW LEVEL SECURITY;
ALTER TABLE connection_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE quota_violations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own linkedin account" ON linkedin_accounts
  FOR ALL USING (user_id = current_setting('request.jwt.claims', true)::json->>'user_id');
CREATE POLICY "Users can view own quotas" ON message_quotas
  FOR ALL USING (user_id = current_setting('request.jwt.claims', true)::json->>'user_id');
CREATE POLICY "Users can view own connection requests" ON connection_requests
  FOR ALL USING (user_id = current_setting('request.jwt.claims', true)::json->>'user_id');
CREATE POLICY "Users can view own violations" ON quota_violations
  FOR ALL USING (user_id = current_setting('request.jwt.claims', true)::json->>'user_id');

-- Note: message_generation_logs already has RLS enabled from its original creation

-- =====================================================
-- PART 6: HELPER FUNCTIONS
-- =====================================================

-- Function to check if user can send a message
CREATE OR REPLACE FUNCTION check_message_quota(
  p_user_id CHARACTER VARYING,
  p_message_type TEXT,
  p_is_personalised BOOLEAN DEFAULT false
)
RETURNS TABLE (
  can_send BOOLEAN,
  reason TEXT,
  wait_until TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_account linkedin_accounts%ROWTYPE;
  v_quota message_quotas%ROWTYPE;
  v_can_send BOOLEAN := false;
  v_reason TEXT := '';
  v_wait_until TIMESTAMPTZ := NULL;
BEGIN
  -- Get account and quota info
  SELECT * INTO v_account FROM linkedin_accounts WHERE user_id = p_user_id;
  SELECT * INTO v_quota FROM message_quotas WHERE user_id = p_user_id;

  -- If no records exist, create them
  IF v_account IS NULL THEN
    INSERT INTO linkedin_accounts (user_id) VALUES (p_user_id)
    RETURNING * INTO v_account;
  END IF;

  IF v_quota IS NULL THEN
    INSERT INTO message_quotas (user_id) VALUES (p_user_id)
    RETURNING * INTO v_quota;
  END IF;

  -- Check rate limiting first
  IF v_quota.last_action_at > NOW() - INTERVAL '2 minutes' THEN
    RETURN QUERY SELECT
      false,
      'Rate limit: Must wait 2 minutes between actions',
      v_quota.last_action_at + INTERVAL '2 minutes';
    RETURN;
  END IF;

  -- Check hourly limit
  IF v_quota.hourly_action_count >= 25 THEN
    RETURN QUERY SELECT
      false,
      'Hourly limit reached (25 actions/hour)',
      v_quota.hourly_reset_at;
    RETURN;
  END IF;

  -- Check specific message type limits
  CASE p_message_type
    WHEN 'direct_message' THEN
      IF v_account.account_type = 'free' AND v_quota.daily_direct_messages >= 100 THEN
        v_can_send := false;
        v_reason := 'Daily direct message limit reached (100/day for free)';
        v_wait_until := v_quota.daily_reset_at;
      ELSIF v_account.account_type != 'free' AND v_quota.daily_direct_messages >= 150 THEN
        v_can_send := false;
        v_reason := 'Daily direct message limit reached (150/day for premium)';
        v_wait_until := v_quota.daily_reset_at;
      ELSE
        v_can_send := true;
      END IF;

    WHEN 'connection_request' THEN
      -- Check weekly limit
      IF v_quota.weekly_connection_requests >= 100 THEN
        v_can_send := false;
        v_reason := 'Weekly connection request limit reached (100/week)';
        v_wait_until := v_quota.weekly_reset_at;
      -- Check monthly personalised limit for free accounts
      ELSIF v_account.account_type = 'free' AND p_is_personalised AND v_quota.monthly_personalised_connections >= 20 THEN
        v_can_send := false;
        v_reason := 'Monthly personalised connection limit reached (20/month for free)';
        v_wait_until := v_quota.monthly_reset_at;
      -- Check pending connections
      ELSIF v_quota.pending_connections >= 500 THEN
        v_can_send := false;
        v_reason := 'Too many pending connections (500+ pending)';
      ELSE
        v_can_send := true;
      END IF;

    WHEN 'inmail' THEN
      IF v_account.account_type = 'free' THEN
        v_can_send := false;
        v_reason := 'InMail not available for free accounts';
      ELSIF v_account.inmail_credits_remaining <= 0 THEN
        v_can_send := false;
        v_reason := 'No InMail credits remaining';
        v_wait_until := v_account.inmail_renewal_date;
      ELSIF v_quota.daily_inmails >= 25 THEN
        v_can_send := false;
        v_reason := 'Daily InMail limit reached (25/day)';
        v_wait_until := v_quota.daily_reset_at;
      ELSE
        v_can_send := true;
      END IF;

    WHEN 'open_profile' THEN
      IF v_quota.monthly_open_profile_messages >= 800 THEN
        v_can_send := false;
        v_reason := 'Monthly Open Profile message limit reached (800/month)';
        v_wait_until := v_quota.monthly_reset_at;
      ELSE
        v_can_send := true;
      END IF;

    ELSE
      v_can_send := true;
  END CASE;

  -- Log violation if quota exceeded
  IF NOT v_can_send THEN
    INSERT INTO quota_violations (user_id, violation_type, message)
    VALUES (p_user_id, p_message_type || '_quota_exceeded', v_reason);
  END IF;

  RETURN QUERY SELECT v_can_send, v_reason, v_wait_until;
END;
$$;

-- Function to increment quotas after sending
CREATE OR REPLACE FUNCTION increment_message_quota(
  p_user_id CHARACTER VARYING,
  p_message_type TEXT,
  p_is_personalised BOOLEAN DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- Initialize weekly tracking if needed
  UPDATE message_quotas
  SET
    weekly_first_action_at = COALESCE(weekly_first_action_at, NOW()),
    weekly_reset_at = COALESCE(weekly_reset_at, NOW() + INTERVAL '7 days')
  WHERE user_id = p_user_id AND weekly_first_action_at IS NULL;

  -- Initialize hourly tracking if needed
  UPDATE message_quotas
  SET hourly_reset_at = COALESCE(hourly_reset_at, NOW() + INTERVAL '1 hour')
  WHERE user_id = p_user_id AND hourly_reset_at IS NULL;

  -- Update all relevant counters
  UPDATE message_quotas
  SET
    -- Update daily counts
    daily_direct_messages = CASE
      WHEN p_message_type = 'direct_message' THEN daily_direct_messages + 1
      ELSE daily_direct_messages
    END,
    daily_connection_requests = CASE
      WHEN p_message_type = 'connection_request' THEN daily_connection_requests + 1
      ELSE daily_connection_requests
    END,
    daily_inmails = CASE
      WHEN p_message_type = 'inmail' THEN daily_inmails + 1
      ELSE daily_inmails
    END,
    daily_open_profile = CASE
      WHEN p_message_type = 'open_profile' THEN daily_open_profile + 1
      ELSE daily_open_profile
    END,
    daily_total_actions = daily_total_actions + 1,

    -- Update weekly counts
    weekly_connection_requests = CASE
      WHEN p_message_type = 'connection_request' THEN weekly_connection_requests + 1
      ELSE weekly_connection_requests
    END,

    -- Update monthly counts
    monthly_personalised_connections = CASE
      WHEN p_message_type = 'connection_request' AND p_is_personalised THEN monthly_personalised_connections + 1
      ELSE monthly_personalised_connections
    END,
    monthly_open_profile_messages = CASE
      WHEN p_message_type = 'open_profile' THEN monthly_open_profile_messages + 1
      ELSE monthly_open_profile_messages
    END,

    -- Update rate limiting
    last_action_at = NOW(),
    hourly_action_count = hourly_action_count + 1,

    updated_at = NOW()
  WHERE user_id = p_user_id;

  -- Decrement InMail credits if applicable
  IF p_message_type = 'inmail' THEN
    UPDATE linkedin_accounts
    SET
      inmail_credits_remaining = GREATEST(inmail_credits_remaining - 1, 0),
      updated_at = NOW()
    WHERE user_id = p_user_id;
  END IF;

  -- Also update the legacy usage_tracking table for backwards compatibility
  INSERT INTO usage_tracking (user_id, usage_date, connection_requests_sent, messages_sent)
  VALUES (
    p_user_id,
    CURRENT_DATE,
    CASE WHEN p_message_type = 'connection_request' THEN 1 ELSE 0 END,
    CASE WHEN p_message_type IN ('direct_message', 'inmail', 'open_profile') THEN 1 ELSE 0 END
  )
  ON CONFLICT (user_id, usage_date)
  DO UPDATE SET
    connection_requests_sent = usage_tracking.connection_requests_sent + CASE WHEN p_message_type = 'connection_request' THEN 1 ELSE 0 END,
    messages_sent = usage_tracking.messages_sent + CASE WHEN p_message_type IN ('direct_message', 'inmail', 'open_profile') THEN 1 ELSE 0 END;
END;
$$;

-- Function to get RPC-style usage increment (for sequence scheduler compatibility)
CREATE OR REPLACE FUNCTION increment_usage_tracking(
  p_user_id CHARACTER VARYING,
  p_usage_date DATE,
  p_field TEXT,
  p_increment INTEGER
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO usage_tracking (user_id, usage_date, connection_requests_sent, messages_sent)
  VALUES (
    p_user_id,
    p_usage_date,
    CASE WHEN p_field = 'connection_requests_sent' THEN p_increment ELSE 0 END,
    CASE WHEN p_field = 'messages_sent' THEN p_increment ELSE 0 END
  )
  ON CONFLICT (user_id, usage_date)
  DO UPDATE SET
    connection_requests_sent = usage_tracking.connection_requests_sent + CASE WHEN p_field = 'connection_requests_sent' THEN p_increment ELSE 0 END,
    messages_sent = usage_tracking.messages_sent + CASE WHEN p_field = 'messages_sent' THEN p_increment ELSE 0 END;
END;
$$;

-- =====================================================
-- PART 7: SCHEDULED RESET FUNCTIONS
-- =====================================================

-- Reset daily quotas (run at midnight)
CREATE OR REPLACE FUNCTION reset_daily_quotas()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE message_quotas
  SET
    daily_direct_messages = 0,
    daily_connection_requests = 0,
    daily_inmails = 0,
    daily_open_profile = 0,
    daily_group_messages = 0,
    daily_total_actions = 0,
    daily_reset_at = DATE_TRUNC('day', NOW()) + INTERVAL '1 day'
  WHERE daily_reset_at <= NOW();
END;
$$;

-- Reset hourly quotas (run every hour)
CREATE OR REPLACE FUNCTION reset_hourly_quotas()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE message_quotas
  SET
    hourly_action_count = 0,
    hourly_reset_at = NOW() + INTERVAL '1 hour'
  WHERE hourly_reset_at IS NULL OR hourly_reset_at <= NOW();
END;
$$;

-- Reset weekly quotas (run daily, checks for 7-day cycles)
CREATE OR REPLACE FUNCTION reset_weekly_quotas()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE message_quotas
  SET
    weekly_connection_requests = 0,
    weekly_first_action_at = NULL,
    weekly_reset_at = NULL
  WHERE weekly_reset_at IS NOT NULL AND weekly_reset_at <= NOW();
END;
$$;

-- Reset monthly quotas (run daily, checks for month boundaries)
CREATE OR REPLACE FUNCTION reset_monthly_quotas()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE message_quotas
  SET
    monthly_personalised_connections = 0,
    monthly_open_profile_messages = 0,
    monthly_reset_at = DATE_TRUNC('month', NOW()) + INTERVAL '1 month'
  WHERE monthly_reset_at <= NOW();
END;
$$;

-- Auto-withdraw old connection requests (run daily)
CREATE OR REPLACE FUNCTION auto_withdraw_old_requests()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- Withdraw requests older than 14 days
  UPDATE connection_requests
  SET
    status = 'withdrawn',
    auto_withdrawn = true,
    status_changed_at = NOW(),
    updated_at = NOW()
  WHERE status = 'pending'
    AND withdrawal_scheduled_for <= NOW();

  -- Update pending connection counts
  UPDATE message_quotas mq
  SET
    pending_connections = (
      SELECT COUNT(*)
      FROM connection_requests cr
      WHERE cr.user_id = mq.user_id
        AND cr.status = 'pending'
    ),
    updated_at = NOW();
END;
$$;

-- =====================================================
-- PART 8: TRIGGERS
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_sequence_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for sequences
DROP TRIGGER IF EXISTS update_outreach_sequences_updated_at ON outreach_sequences;
CREATE TRIGGER update_outreach_sequences_updated_at
  BEFORE UPDATE ON outreach_sequences
  FOR EACH ROW
  EXECUTE FUNCTION update_sequence_updated_at();

DROP TRIGGER IF EXISTS update_sequence_prospects_updated_at ON sequence_prospects;
CREATE TRIGGER update_sequence_prospects_updated_at
  BEFORE UPDATE ON sequence_prospects
  FOR EACH ROW
  EXECUTE FUNCTION update_sequence_updated_at();

DROP TRIGGER IF EXISTS update_sequence_messages_updated_at ON sequence_messages;
CREATE TRIGGER update_sequence_messages_updated_at
  BEFORE UPDATE ON sequence_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_sequence_updated_at();

-- Trigger to auto-create quota records for new users
CREATE OR REPLACE FUNCTION create_user_quota_records()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Create linkedin_accounts record
  INSERT INTO linkedin_accounts (user_id, account_type)
  VALUES (NEW.user_id, 'free')
  ON CONFLICT (user_id) DO NOTHING;

  -- Create message_quotas record
  INSERT INTO message_quotas (user_id)
  VALUES (NEW.user_id)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_user_created_quota ON users;
CREATE TRIGGER on_user_created_quota
  AFTER INSERT ON users
  FOR EACH ROW
  EXECUTE FUNCTION create_user_quota_records();

-- =====================================================
-- PART 9: HELPER FUNCTIONS FOR SEQUENCES
-- =====================================================

-- Get next prospect to send
CREATE OR REPLACE FUNCTION get_next_scheduled_prospect(p_sequence_id BIGINT)
RETURNS TABLE (
  prospect_id BIGINT,
  linkedin_url TEXT,
  scheduled_for TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    sp.id,
    sp.linkedin_url,
    sp.scheduled_for
  FROM sequence_prospects sp
  WHERE sp.sequence_id = p_sequence_id
    AND sp.status = 'scheduled'
    AND sp.scheduled_for <= NOW()
  ORDER BY sp.scheduled_for ASC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE outreach_sequences IS 'Stores LinkedIn outreach sequence campaigns';
COMMENT ON TABLE sequence_prospects IS 'Individual prospects/targets within sequences';
COMMENT ON TABLE sequence_messages IS 'Messages sent as part of sequences';
COMMENT ON TABLE linkedin_accounts IS 'LinkedIn account configuration and InMail credits';
COMMENT ON TABLE message_quotas IS 'Real-time quota tracking for all message types';
COMMENT ON TABLE connection_requests IS 'Connection request tracking with auto-withdrawal';
COMMENT ON TABLE quota_violations IS 'Log of quota limit violations for analysis';

-- message_generation_logs (existing table enhanced with LinkedIn fields) serves as the comprehensive activity log
