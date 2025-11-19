-- ===========================================================================================
-- LinkedIn Profile Deduplication & Security System
-- ===========================================================================================
-- Purpose: Prevent users from:
--   1. Connecting the same LinkedIn account to multiple Cold AI accounts (cost protection)
--   2. Creating multiple Cold AI accounts to bypass rate limits (security)
--   3. Using email aliases or patterns to circumvent detection
-- ===========================================================================================

-- ===========================================================================================
-- TABLE: linkedin_profile_registry
-- ===========================================================================================
-- Global registry of unique LinkedIn profiles across ALL Cold AI users
-- Ensures each LinkedIn profile can only be connected to ONE Cold AI account at a time
CREATE TABLE IF NOT EXISTS public.linkedin_profile_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- LinkedIn identifiers
  linkedin_public_identifier TEXT UNIQUE NOT NULL,  -- e.g., "john-doe-123" from linkedin.com/in/john-doe-123
  provider_id TEXT,                                 -- Unipile's internal LinkedIn ID (urn:li:person:xxx)
  linkedin_profile_url TEXT,                        -- Full URL: https://linkedin.com/in/john-doe-123

  -- Current active connection (UUID from auth.users)
  active_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  active_unipile_account_id TEXT,                   -- Current Unipile account ID

  -- Tracking metadata
  first_seen_at TIMESTAMPTZ DEFAULT NOW(),
  last_connected_at TIMESTAMPTZ DEFAULT NOW(),
  connection_count INT DEFAULT 1,                   -- Total number of connection attempts (including duplicates)
  rejection_count INT DEFAULT 0,                    -- Number of duplicate connection attempts rejected

  -- Profile snapshot (cached from LinkedIn for duplicate detection)
  profile_snapshot JSONB,                           -- Store LinkedIn profile data

  -- Security flags
  flagged_suspicious BOOLEAN DEFAULT FALSE,
  suspension_reason TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_linkedin_registry_public_id
  ON public.linkedin_profile_registry(linkedin_public_identifier);

CREATE INDEX IF NOT EXISTS idx_linkedin_registry_active_user
  ON public.linkedin_profile_registry(active_user_id)
  WHERE active_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_linkedin_registry_provider_id
  ON public.linkedin_profile_registry(provider_id)
  WHERE provider_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_linkedin_registry_flagged
  ON public.linkedin_profile_registry(flagged_suspicious)
  WHERE flagged_suspicious = TRUE;

-- ===========================================================================================
-- TABLE: linkedin_connection_history
-- ===========================================================================================
-- Complete audit trail of all LinkedIn connection attempts (successful and rejected)
CREATE TABLE IF NOT EXISTS public.linkedin_connection_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relationships
  linkedin_profile_id UUID REFERENCES public.linkedin_profile_registry(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Connection details
  unipile_account_id TEXT,
  connection_status TEXT NOT NULL CHECK (connection_status IN (
    'active',
    'disconnected',
    'duplicate_rejected',
    'transferred',
    'failed'
  )),

  -- Timestamps
  connected_at TIMESTAMPTZ DEFAULT NOW(),
  disconnected_at TIMESTAMPTZ,

  -- Security metadata
  metadata JSONB DEFAULT '{}',  -- IP address, user agent, location, etc.
  rejection_reason TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_connection_history_profile
  ON public.linkedin_connection_history(linkedin_profile_id);

CREATE INDEX IF NOT EXISTS idx_connection_history_user
  ON public.linkedin_connection_history(user_id);

CREATE INDEX IF NOT EXISTS idx_connection_history_status
  ON public.linkedin_connection_history(connection_status);

CREATE INDEX IF NOT EXISTS idx_connection_history_rejected
  ON public.linkedin_connection_history(connection_status)
  WHERE connection_status = 'duplicate_rejected';

-- ===========================================================================================
-- TABLE: linkedin_profile_usage
-- ===========================================================================================
-- Track usage at the LinkedIn profile level to prevent limit circumvention
CREATE TABLE IF NOT EXISTS public.linkedin_profile_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relationship
  linkedin_profile_id UUID REFERENCES public.linkedin_profile_registry(id) ON DELETE CASCADE,

  -- Usage period
  usage_month TEXT NOT NULL,  -- Format: 'YYYY-MM' (e.g., '2025-01')

  -- Usage counters (reset monthly)
  messages_sent INT DEFAULT 0,
  messages_generated INT DEFAULT 0,
  prospects_researched INT DEFAULT 0,
  products_generated INT DEFAULT 0,          -- Track Product AI usage
  icps_generated INT DEFAULT 0,              -- Track ICP AI usage

  -- Timestamps
  first_activity_at TIMESTAMPTZ,
  last_activity_at TIMESTAMPTZ,
  last_reset_at TIMESTAMPTZ DEFAULT NOW(),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Ensure one row per profile per month
  UNIQUE(linkedin_profile_id, usage_month)
);

-- Index for monthly usage lookups
CREATE INDEX IF NOT EXISTS idx_linkedin_usage_profile_month
  ON public.linkedin_profile_usage(linkedin_profile_id, usage_month);

-- ===========================================================================================
-- TABLE: signup_tracking
-- ===========================================================================================
-- Track signups by IP address and email patterns to detect abuse
CREATE TABLE IF NOT EXISTS public.signup_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- User info
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  email_base TEXT,                          -- Base email without + aliases (john@gmail.com from john+test@gmail.com)

  -- IP tracking
  ip_address INET,
  ip_country TEXT,
  ip_city TEXT,

  -- Browser/device info
  user_agent TEXT,
  referrer TEXT,

  -- Pattern detection
  is_plus_alias BOOLEAN DEFAULT FALSE,      -- Detects user+alias@domain.com
  is_dot_alias BOOLEAN DEFAULT FALSE,       -- Detects user.name vs username for Gmail

  -- Timestamps
  signed_up_at TIMESTAMPTZ DEFAULT NOW(),

  -- Flags
  flagged_suspicious BOOLEAN DEFAULT FALSE,
  flag_reasons TEXT[],                      -- Array of reasons: ['rapid_signup', 'duplicate_ip', 'plus_alias']

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for duplicate detection
CREATE INDEX IF NOT EXISTS idx_signup_tracking_email_base
  ON public.signup_tracking(email_base);

CREATE INDEX IF NOT EXISTS idx_signup_tracking_ip
  ON public.signup_tracking(ip_address);

CREATE INDEX IF NOT EXISTS idx_signup_tracking_user
  ON public.signup_tracking(user_id);

CREATE INDEX IF NOT EXISTS idx_signup_tracking_flagged
  ON public.signup_tracking(flagged_suspicious)
  WHERE flagged_suspicious = TRUE;

CREATE INDEX IF NOT EXISTS idx_signup_tracking_recent
  ON public.signup_tracking(signed_up_at DESC);

-- ===========================================================================================
-- FUNCTION: Extract email base (remove + aliases and normalize)
-- ===========================================================================================
CREATE OR REPLACE FUNCTION extract_email_base(email TEXT)
RETURNS TEXT AS $$
DECLARE
  local_part TEXT;
  domain_part TEXT;
  normalized_local TEXT;
BEGIN
  -- Split email into local and domain parts
  local_part := split_part(email, '@', 1);
  domain_part := split_part(email, '@', 2);

  -- Remove everything after + (plus addressing)
  normalized_local := split_part(local_part, '+', 1);

  -- For Gmail/Google Workspace: remove dots (they're ignored by Gmail)
  IF domain_part ILIKE '%gmail.com' OR domain_part ILIKE '%googlemail.com' THEN
    normalized_local := REPLACE(normalized_local, '.', '');
  END IF;

  -- Return normalized email
  RETURN LOWER(normalized_local || '@' || domain_part);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ===========================================================================================
-- FUNCTION: Detect email patterns
-- ===========================================================================================
CREATE OR REPLACE FUNCTION detect_email_patterns(email TEXT)
RETURNS TABLE (
  is_plus_alias BOOLEAN,
  is_dot_alias BOOLEAN,
  email_base TEXT
) AS $$
DECLARE
  local_part TEXT;
  domain_part TEXT;
BEGIN
  local_part := split_part(email, '@', 1);
  domain_part := split_part(email, '@', 2);

  is_plus_alias := position('+' IN local_part) > 0;
  is_dot_alias := (domain_part ILIKE '%gmail.com' OR domain_part ILIKE '%googlemail.com')
                  AND position('.' IN local_part) > 0;
  email_base := extract_email_base(email);

  RETURN NEXT;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ===========================================================================================
-- FUNCTION: Check for suspicious signup patterns
-- ===========================================================================================
CREATE OR REPLACE FUNCTION check_suspicious_signup_patterns(
  new_email TEXT,
  new_ip INET DEFAULT NULL
)
RETURNS TABLE (
  is_suspicious BOOLEAN,
  flag_reasons TEXT[]
) AS $$
DECLARE
  email_base_normalized TEXT;
  recent_signups_from_ip INT;
  recent_signups_same_base INT;
  reasons TEXT[] := ARRAY[]::TEXT[];
  suspicious BOOLEAN := FALSE;
BEGIN
  -- Get normalized email base
  email_base_normalized := extract_email_base(new_email);

  -- Check 1: Multiple signups from same email base
  SELECT COUNT(*) INTO recent_signups_same_base
  FROM public.signup_tracking
  WHERE email_base = email_base_normalized
    AND signed_up_at > NOW() - INTERVAL '7 days';

  IF recent_signups_same_base > 0 THEN
    reasons := array_append(reasons, 'duplicate_email_base');
    suspicious := TRUE;
  END IF;

  -- Check 2: Multiple signups from same IP (if provided)
  IF new_ip IS NOT NULL THEN
    SELECT COUNT(*) INTO recent_signups_from_ip
    FROM public.signup_tracking
    WHERE ip_address = new_ip
      AND signed_up_at > NOW() - INTERVAL '24 hours';

    IF recent_signups_from_ip >= 3 THEN
      reasons := array_append(reasons, 'rapid_signup_same_ip');
      suspicious := TRUE;
    END IF;
  END IF;

  -- Check 3: Plus alias usage
  IF position('+' IN new_email) > 0 THEN
    reasons := array_append(reasons, 'plus_alias_detected');
    -- Don't mark as suspicious yet, just flag for review
  END IF;

  is_suspicious := suspicious;
  flag_reasons := reasons;

  RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

-- ===========================================================================================
-- FUNCTION: Find duplicate LinkedIn connections
-- ===========================================================================================
CREATE OR REPLACE FUNCTION find_duplicate_linkedin_connections()
RETURNS TABLE (
  linkedin_public_identifier TEXT,
  connection_count BIGINT,
  user_ids UUID[],
  unipile_account_ids TEXT[],
  profile_url TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    lpr.linkedin_public_identifier,
    COUNT(DISTINCT lch.user_id)::BIGINT as connection_count,
    ARRAY_AGG(DISTINCT lch.user_id) as user_ids,
    ARRAY_AGG(DISTINCT lch.unipile_account_id) FILTER (WHERE lch.unipile_account_id IS NOT NULL) as unipile_account_ids,
    lpr.linkedin_profile_url as profile_url
  FROM public.linkedin_profile_registry lpr
  JOIN public.linkedin_connection_history lch ON lch.linkedin_profile_id = lpr.id
  WHERE lch.connection_status IN ('active', 'disconnected')
  GROUP BY lpr.linkedin_public_identifier, lpr.linkedin_profile_url
  HAVING COUNT(DISTINCT lch.user_id) > 1
  ORDER BY connection_count DESC;
END;
$$ LANGUAGE plpgsql;

-- ===========================================================================================
-- FUNCTION: Get LinkedIn profile usage (check limits)
-- ===========================================================================================
CREATE OR REPLACE FUNCTION get_linkedin_profile_usage(
  linkedin_public_id TEXT,
  check_month TEXT DEFAULT to_char(NOW(), 'YYYY-MM')
)
RETURNS TABLE (
  messages_sent INT,
  messages_generated INT,
  prospects_researched INT,
  products_generated INT,
  icps_generated INT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(lpu.messages_sent, 0),
    COALESCE(lpu.messages_generated, 0),
    COALESCE(lpu.prospects_researched, 0),
    COALESCE(lpu.products_generated, 0),
    COALESCE(lpu.icps_generated, 0)
  FROM public.linkedin_profile_registry lpr
  LEFT JOIN public.linkedin_profile_usage lpu ON lpu.linkedin_profile_id = lpr.id AND lpu.usage_month = check_month
  WHERE lpr.linkedin_public_identifier = linkedin_public_id;
END;
$$ LANGUAGE plpgsql;

-- ===========================================================================================
-- TRIGGERS: Update updated_at timestamps
-- ===========================================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_linkedin_registry_updated_at
  BEFORE UPDATE ON public.linkedin_profile_registry
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_linkedin_usage_updated_at
  BEFORE UPDATE ON public.linkedin_profile_usage
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ===========================================================================================
-- RLS POLICIES
-- ===========================================================================================

-- Enable RLS
ALTER TABLE public.linkedin_profile_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.linkedin_connection_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.linkedin_profile_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signup_tracking ENABLE ROW LEVEL SECURITY;

-- linkedin_profile_registry policies
CREATE POLICY "Users can read their own LinkedIn profile registry"
  ON public.linkedin_profile_registry
  FOR SELECT
  USING (auth.uid() = active_user_id);

CREATE POLICY "Service role can manage all LinkedIn registries"
  ON public.linkedin_profile_registry
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- linkedin_connection_history policies
CREATE POLICY "Users can read their own connection history"
  ON public.linkedin_connection_history
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all connection history"
  ON public.linkedin_connection_history
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- linkedin_profile_usage policies
CREATE POLICY "Users can read their own LinkedIn usage"
  ON public.linkedin_profile_usage
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.linkedin_profile_registry lpr
      WHERE lpr.id = linkedin_profile_usage.linkedin_profile_id
      AND lpr.active_user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage all LinkedIn usage"
  ON public.linkedin_profile_usage
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- signup_tracking policies
CREATE POLICY "Users can only read their own signup tracking"
  ON public.signup_tracking
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all signup tracking"
  ON public.signup_tracking
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- ===========================================================================================
-- COMMENTS
-- ===========================================================================================

COMMENT ON TABLE public.linkedin_profile_registry IS
  'Global registry of LinkedIn profiles to prevent duplicate connections and protect against abuse';

COMMENT ON TABLE public.linkedin_connection_history IS
  'Audit trail of all LinkedIn connection attempts including rejections for security monitoring';

COMMENT ON TABLE public.linkedin_profile_usage IS
  'Track AI feature usage at LinkedIn profile level to prevent circumventing limits via new accounts';

COMMENT ON TABLE public.signup_tracking IS
  'Track signups with IP and email pattern detection to identify suspicious behavior';

COMMENT ON FUNCTION extract_email_base(TEXT) IS
  'Normalize email addresses to detect aliases (removes + addressing and Gmail dots)';

COMMENT ON FUNCTION check_suspicious_signup_patterns(TEXT, INET) IS
  'Analyze signup patterns to detect potential abuse (duplicate emails, rapid signups from same IP)';

COMMENT ON FUNCTION find_duplicate_linkedin_connections() IS
  'Admin utility to identify LinkedIn profiles connected to multiple Cold AI accounts';

COMMENT ON FUNCTION get_linkedin_profile_usage(TEXT, TEXT) IS
  'Get usage statistics for a LinkedIn profile to enforce limits regardless of Cold AI account';
