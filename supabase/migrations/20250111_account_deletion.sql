-- Account Deletion System Migration
-- Simplified single-table approach with 30-day soft delete period

-- Add account_status column to user_profiles for soft delete tracking
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS account_status TEXT DEFAULT 'active' CHECK (account_status IN ('active', 'pending_deletion', 'deleted'));

ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS deletion_requested_at TIMESTAMPTZ;

-- Create index for finding pending deletions
CREATE INDEX IF NOT EXISTS idx_user_profiles_pending_deletion
ON user_profiles(account_status, deletion_requested_at)
WHERE account_status = 'pending_deletion';

-- Create deleted_accounts table
CREATE TABLE IF NOT EXISTS deleted_accounts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  email_hash TEXT NOT NULL UNIQUE,
  original_user_id UUID NOT NULL,
  deleted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  soft_delete_until TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),

  -- Usage data at time of deletion (for limit restoration)
  messages_sent_total INTEGER DEFAULT 0,
  icps_created_total INTEGER DEFAULT 0,
  knowledge_entries_total INTEGER DEFAULT 0,
  prospects_created_total INTEGER DEFAULT 0,

  -- Metadata
  deletion_reason TEXT,

  -- Tracking
  created_at TIMESTAMPTZ DEFAULT NOW(),
  hard_deleted BOOLEAN DEFAULT FALSE
);

-- Create indexes for performance
CREATE INDEX idx_deleted_accounts_email_hash ON deleted_accounts(email_hash);
CREATE INDEX idx_deleted_accounts_soft_delete_until ON deleted_accounts(soft_delete_until) WHERE hard_deleted = FALSE;
CREATE INDEX idx_deleted_accounts_deleted_at ON deleted_accounts(deleted_at);

-- Create function to check email deletion history
CREATE OR REPLACE FUNCTION check_email_deletion_history(p_email TEXT)
RETURNS TABLE(
  previously_deleted BOOLEAN,
  deleted_at TIMESTAMPTZ,
  soft_delete_until TIMESTAMPTZ,
  messages_used INTEGER,
  within_limit_period BOOLEAN
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_email_hash TEXT;
  v_record RECORD;
BEGIN
  -- Hash the email (lowercase for consistency)
  v_email_hash := encode(digest(LOWER(p_email), 'sha256'), 'hex');

  -- Check for existing record (most recent)
  SELECT * INTO v_record
  FROM deleted_accounts
  WHERE email_hash = v_email_hash
    AND hard_deleted = FALSE
  ORDER BY deleted_at DESC
  LIMIT 1;

  IF v_record IS NULL THEN
    -- Email never deleted before
    RETURN QUERY SELECT
      FALSE,
      NULL::TIMESTAMPTZ,
      NULL::TIMESTAMPTZ,
      0,
      FALSE;
  ELSE
    -- Email was deleted before
    RETURN QUERY SELECT
      TRUE,
      v_record.deleted_at,
      v_record.soft_delete_until,
      v_record.messages_sent_total,
      (v_record.soft_delete_until > NOW()); -- Still within soft delete period
  END IF;
END;
$$;

-- Create function to get pending deletions (for n8n cron job)
CREATE OR REPLACE FUNCTION get_pending_hard_deletions()
RETURNS TABLE(
  deleted_account_id UUID,
  email_hash TEXT,
  original_user_id TEXT,
  deleted_at TIMESTAMPTZ,
  soft_delete_until TIMESTAMPTZ,
  user_email TEXT
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    da.id as deleted_account_id,
    da.email_hash,
    da.original_user_id::text,
    da.deleted_at,
    da.soft_delete_until,
    au.email as user_email
  FROM deleted_accounts da
  LEFT JOIN auth.users au ON au.id = da.original_user_id
  WHERE da.soft_delete_until < NOW()
    AND da.hard_deleted = FALSE
  ORDER BY da.soft_delete_until ASC;
END;
$$;

-- Create function to mark account as hard deleted
CREATE OR REPLACE FUNCTION mark_account_hard_deleted(p_deleted_account_id UUID)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE deleted_accounts
  SET hard_deleted = TRUE
  WHERE id = p_deleted_account_id;

  RETURN FOUND;
END;
$$;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION check_email_deletion_history(TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_pending_hard_deletions() TO service_role;
GRANT EXECUTE ON FUNCTION mark_account_hard_deleted(UUID) TO service_role;

-- Add helpful comment
COMMENT ON TABLE deleted_accounts IS 'Tracks deleted accounts with 30-day soft delete period to prevent abuse of monthly limits';
COMMENT ON FUNCTION check_email_deletion_history(TEXT) IS 'Checks if an email was previously used and returns deletion history for limit restoration';
COMMENT ON FUNCTION get_pending_hard_deletions() IS 'Returns accounts ready for hard deletion (past soft_delete_until date) - called by n8n cron';
COMMENT ON FUNCTION mark_account_hard_deleted(UUID) IS 'Marks a deleted account record as hard deleted after processing';
