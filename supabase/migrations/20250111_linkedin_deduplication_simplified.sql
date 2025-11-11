-- ============================================================================
-- LinkedIn Duplicate Detection & Security (Simplified Approach)
-- Using existing tables with added columns instead of creating new tables
-- ============================================================================

-- 1. Extend user_profiles table to track LinkedIn duplicate detection
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS linkedin_public_identifier TEXT,
  ADD COLUMN IF NOT EXISTS linkedin_first_connected_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS linkedin_connection_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS linkedin_last_disconnected_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS linkedin_profile_snapshot JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS linkedin_organizations JSONB DEFAULT '[]'::jsonb;

-- Create unique index to prevent duplicate LinkedIn profiles across users
-- This is the core of the duplicate detection system
CREATE UNIQUE INDEX IF NOT EXISTS idx_linkedin_public_identifier_active
  ON public.user_profiles(linkedin_public_identifier)
  WHERE linkedin_connected = true AND linkedin_public_identifier IS NOT NULL;

-- Create index for faster LinkedIn URL lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_linkedin_url
  ON public.user_profiles(linkedin_url)
  WHERE linkedin_url IS NOT NULL;

-- Create index for unipile_account_id lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_unipile_account_id
  ON public.user_profiles(unipile_account_id)
  WHERE unipile_account_id IS NOT NULL;

COMMENT ON COLUMN public.user_profiles.linkedin_public_identifier IS 'Unique LinkedIn URL slug extracted from linkedin.com/in/{identifier} - used for global duplicate detection';
COMMENT ON COLUMN public.user_profiles.linkedin_first_connected_at IS 'First time this user connected their LinkedIn account';
COMMENT ON COLUMN public.user_profiles.linkedin_connection_count IS 'Number of times this user has connected/reconnected LinkedIn';
COMMENT ON COLUMN public.user_profiles.linkedin_last_disconnected_at IS 'Last time this user disconnected their LinkedIn account';
COMMENT ON COLUMN public.user_profiles.linkedin_profile_snapshot IS 'Latest profile data from Unipile (username, profile_url, email, etc.)';
COMMENT ON COLUMN public.user_profiles.linkedin_organizations IS 'Organizations this LinkedIn profile is part of (from Unipile data) - helps detect company affiliations';

-- 2. Extend auth_login_attempts to track signup IP and email patterns
ALTER TABLE public.auth_login_attempts
  ADD COLUMN IF NOT EXISTS is_signup BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS email_base TEXT,
  ADD COLUMN IF NOT EXISTS is_gmail_alias BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_auth_login_attempts_signup
  ON public.auth_login_attempts(email, ip_address, is_signup)
  WHERE is_signup = true;

CREATE INDEX IF NOT EXISTS idx_auth_login_attempts_email_base
  ON public.auth_login_attempts(email_base, ip_address)
  WHERE email_base IS NOT NULL;

COMMENT ON COLUMN public.auth_login_attempts.is_signup IS 'True if this was a signup attempt (not just login)';
COMMENT ON COLUMN public.auth_login_attempts.email_base IS 'Normalized email base (removing Gmail aliases like +tag and dots)';
COMMENT ON COLUMN public.auth_login_attempts.is_gmail_alias IS 'True if this email appears to be a Gmail alias (contains + or uses dot trick)';

-- 3. Extend webhook_events to track LinkedIn connection history
ALTER TABLE public.webhook_events
  ADD COLUMN IF NOT EXISTS linkedin_event_type TEXT,
  ADD COLUMN IF NOT EXISTS connection_status TEXT,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_webhook_events_linkedin
  ON public.webhook_events(user_id, linkedin_event_type, connection_status)
  WHERE linkedin_event_type IS NOT NULL;

COMMENT ON COLUMN public.webhook_events.linkedin_event_type IS 'Type of LinkedIn event: connected, disconnected, duplicate_rejected, error';
COMMENT ON COLUMN public.webhook_events.connection_status IS 'Status of LinkedIn connection: active, disconnected, duplicate_rejected, failed';
COMMENT ON COLUMN public.webhook_events.rejection_reason IS 'Reason for rejection if connection was blocked';

-- 4. Extend knowledge_base_ai_usage to track LinkedIn-level usage
ALTER TABLE public.knowledge_base_ai_usage
  ADD COLUMN IF NOT EXISTS linkedin_public_identifier TEXT;

CREATE INDEX IF NOT EXISTS idx_knowledge_base_ai_usage_linkedin
  ON public.knowledge_base_ai_usage(linkedin_public_identifier, created_at)
  WHERE linkedin_public_identifier IS NOT NULL;

COMMENT ON COLUMN public.knowledge_base_ai_usage.linkedin_public_identifier IS 'LinkedIn identifier for tracking usage at LinkedIn profile level (cross-user tracking)';

-- 5. Add helper functions for duplicate detection

-- Function to extract LinkedIn public identifier from URL
CREATE OR REPLACE FUNCTION extract_linkedin_identifier(profile_url TEXT)
RETURNS TEXT AS $$
DECLARE
  url_match TEXT[];
BEGIN
  -- Match patterns like linkedin.com/in/john-doe or linkedin.com/in/john-doe/
  url_match := regexp_match(profile_url, 'linkedin\.com/in/([\w%-]+)/?', 'i');

  IF url_match IS NOT NULL AND array_length(url_match, 1) > 0 THEN
    -- Decode URL encoding and return
    RETURN lower(trim(url_match[1]));
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION extract_linkedin_identifier IS 'Extracts LinkedIn public identifier from profile URL for duplicate detection';

-- Function to normalize Gmail addresses (detect aliases)
CREATE OR REPLACE FUNCTION normalize_gmail_email(email TEXT)
RETURNS TABLE(
  email_base TEXT,
  is_gmail_alias BOOLEAN
) AS $$
DECLARE
  local_part TEXT;
  domain_part TEXT;
  normalized_local TEXT;
BEGIN
  -- Split email into local and domain parts
  local_part := split_part(email, '@', 1);
  domain_part := split_part(email, '@', 2);

  -- Check if it's a Gmail address
  IF lower(domain_part) IN ('gmail.com', 'googlemail.com') THEN
    -- Remove everything after + (plus addressing)
    normalized_local := split_part(local_part, '+', 1);

    -- Remove all dots (Gmail ignores dots in local part)
    normalized_local := replace(normalized_local, '.', '');

    -- Reconstruct normalized email
    email_base := lower(normalized_local || '@gmail.com');

    -- Check if this was an alias (had + or dots)
    is_gmail_alias := (local_part != normalized_local);

    RETURN QUERY SELECT email_base, is_gmail_alias;
  ELSE
    -- Not Gmail, return as-is
    RETURN QUERY SELECT lower(email), false;
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION normalize_gmail_email IS 'Normalizes Gmail addresses to detect aliases (+ addressing and dot removal)';

-- 6. Create view for LinkedIn connection audit trail
CREATE OR REPLACE VIEW linkedin_connection_audit AS
SELECT
  we.id,
  we.user_id,
  we.created_at,
  we.linkedin_event_type,
  we.connection_status,
  we.rejection_reason,
  we.payload->>'account_id' as unipile_account_id,
  we.payload->'profile'->>'profile_url' as linkedin_url,
  extract_linkedin_identifier(we.payload->'profile'->>'profile_url') as linkedin_public_identifier,
  u.email as user_email,
  up.linkedin_connected as current_status
FROM public.webhook_events we
LEFT JOIN public.users u ON we.user_id = u.user_id
LEFT JOIN public.user_profiles up ON we.user_id = up.user_id
WHERE we.linkedin_event_type IS NOT NULL
ORDER BY we.created_at DESC;

COMMENT ON VIEW linkedin_connection_audit IS 'Audit trail of all LinkedIn connection events for monitoring and debugging';

-- 7. Create view for potential duplicate detection monitoring
CREATE OR REPLACE VIEW potential_duplicate_signups AS
SELECT
  la1.email as email1,
  la2.email as email2,
  la1.email_base as shared_email_base,
  la1.ip_address as shared_ip,
  la1.attempt_time as signup1_time,
  la2.attempt_time as signup2_time,
  EXTRACT(EPOCH FROM (la2.attempt_time - la1.attempt_time))/3600 as hours_between_signups
FROM public.auth_login_attempts la1
JOIN public.auth_login_attempts la2
  ON la1.email_base = la2.email_base
  AND la1.email < la2.email
  AND la1.ip_address = la2.ip_address
WHERE
  la1.is_signup = true
  AND la2.is_signup = true
  AND la1.email_base IS NOT NULL
  AND la1.success = true
  AND la2.success = true
ORDER BY la2.attempt_time DESC;

COMMENT ON VIEW potential_duplicate_signups IS 'Detects potential duplicate signups from same IP with Gmail aliases or similar emails';

-- 8. Grant appropriate permissions
GRANT SELECT ON linkedin_connection_audit TO authenticated;
GRANT SELECT ON potential_duplicate_signups TO authenticated;

-- ============================================================================
-- IMPORTANT NOTES FOR DEPLOYMENT:
-- ============================================================================
-- 1. The unique index on linkedin_public_identifier is the core protection
--    It prevents the same LinkedIn profile from being connected to multiple users
--
-- 2. When a user disconnects LinkedIn, linkedin_connected = false, which
--    removes them from the unique index (allows reconnection)
--
-- 3. The webhook_events table now tracks all LinkedIn connection attempts
--    including rejections, for audit purposes
--
-- 4. The auth_login_attempts table tracks signup patterns to detect
--    users creating multiple accounts with Gmail aliases
--
-- 5. Usage tracking at LinkedIn level (not just user level) helps
--    detect if someone is cycling accounts to bypass limits
-- ============================================================================
