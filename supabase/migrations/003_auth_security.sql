-- Migration: Auth Security Features
-- Rate limiting, account lockout tracking
-- Created: 2025-10-16

-- Create table for tracking login attempts
CREATE TABLE IF NOT EXISTS auth_login_attempts (
  id BIGSERIAL PRIMARY KEY,
  email TEXT NOT NULL,
  ip_address TEXT,
  attempt_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  success BOOLEAN NOT NULL DEFAULT FALSE,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index for efficient querying
CREATE INDEX IF NOT EXISTS idx_login_attempts_email ON auth_login_attempts(email, attempt_time DESC);
CREATE INDEX IF NOT EXISTS idx_login_attempts_ip ON auth_login_attempts(ip_address, attempt_time DESC);

-- Create table for account lockouts
CREATE TABLE IF NOT EXISTS auth_account_lockouts (
  id BIGSERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  locked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  locked_until TIMESTAMPTZ NOT NULL,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  last_attempt_ip TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index for lockout checks
CREATE INDEX IF NOT EXISTS idx_account_lockouts_email ON auth_account_lockouts(email);
CREATE INDEX IF NOT EXISTS idx_account_lockouts_locked_until ON auth_account_lockouts(locked_until);

-- Function to check if account is locked
CREATE OR REPLACE FUNCTION is_account_locked(p_email TEXT)
RETURNS TABLE(
  is_locked BOOLEAN,
  locked_until TIMESTAMPTZ,
  failed_attempts INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    TRUE as is_locked,
    al.locked_until,
    al.failed_attempts
  FROM auth_account_lockouts al
  WHERE al.email = p_email
    AND al.locked_until > NOW();

  -- If no active lockout found, return not locked
  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, NULL::TIMESTAMPTZ, 0;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to record login attempt
CREATE OR REPLACE FUNCTION record_login_attempt(
  p_email TEXT,
  p_ip_address TEXT,
  p_success BOOLEAN,
  p_user_agent TEXT DEFAULT NULL
) RETURNS void AS $$
BEGIN
  INSERT INTO auth_login_attempts (email, ip_address, success, user_agent)
  VALUES (p_email, p_ip_address, p_success, p_user_agent);
END;
$$ LANGUAGE plpgsql;

-- Function to lock account
CREATE OR REPLACE FUNCTION lock_account(
  p_email TEXT,
  p_ip_address TEXT,
  p_lockout_minutes INTEGER DEFAULT 30
) RETURNS void AS $$
DECLARE
  v_failed_attempts INTEGER;
BEGIN
  -- Get current failed attempts count
  SELECT failed_attempts INTO v_failed_attempts
  FROM auth_account_lockouts
  WHERE email = p_email;

  IF v_failed_attempts IS NULL THEN
    v_failed_attempts := 0;
  END IF;

  -- Insert or update lockout record
  INSERT INTO auth_account_lockouts (
    email,
    locked_until,
    failed_attempts,
    last_attempt_ip,
    updated_at
  )
  VALUES (
    p_email,
    NOW() + (p_lockout_minutes || ' minutes')::INTERVAL,
    v_failed_attempts + 1,
    p_ip_address,
    NOW()
  )
  ON CONFLICT (email)
  DO UPDATE SET
    locked_until = NOW() + (p_lockout_minutes || ' minutes')::INTERVAL,
    failed_attempts = auth_account_lockouts.failed_attempts + 1,
    last_attempt_ip = p_ip_address,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Function to unlock account (for password reset or manual unlock)
CREATE OR REPLACE FUNCTION unlock_account(p_email TEXT)
RETURNS void AS $$
BEGIN
  DELETE FROM auth_account_lockouts
  WHERE email = p_email;

  -- Also clear recent failed login attempts
  DELETE FROM auth_login_attempts
  WHERE email = p_email
    AND success = FALSE
    AND attempt_time > NOW() - INTERVAL '1 hour';
END;
$$ LANGUAGE plpgsql;

-- Function to get failed login attempts count in last X minutes
CREATE OR REPLACE FUNCTION get_failed_attempts_count(
  p_email TEXT,
  p_minutes INTEGER DEFAULT 15
) RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM auth_login_attempts
  WHERE email = p_email
    AND success = FALSE
    AND attempt_time > NOW() - (p_minutes || ' minutes')::INTERVAL;

  RETURN COALESCE(v_count, 0);
END;
$$ LANGUAGE plpgsql;

-- Cleanup function to remove old login attempts (should be run periodically)
CREATE OR REPLACE FUNCTION cleanup_old_login_attempts()
RETURNS void AS $$
BEGIN
  -- Delete login attempts older than 30 days
  DELETE FROM auth_login_attempts
  WHERE attempt_time < NOW() - INTERVAL '30 days';

  -- Delete expired lockouts
  DELETE FROM auth_account_lockouts
  WHERE locked_until < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;

-- Enable Row Level Security
ALTER TABLE auth_login_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_account_lockouts ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Only service role can access these tables
CREATE POLICY "Service role only for login attempts" ON auth_login_attempts
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role only for lockouts" ON auth_account_lockouts
  FOR ALL USING (auth.role() = 'service_role');

-- Grant permissions
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON auth_login_attempts TO service_role;
GRANT ALL ON auth_account_lockouts TO service_role;
GRANT EXECUTE ON FUNCTION is_account_locked TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION record_login_attempt TO service_role;
GRANT EXECUTE ON FUNCTION lock_account TO service_role;
GRANT EXECUTE ON FUNCTION unlock_account TO service_role;
GRANT EXECUTE ON FUNCTION get_failed_attempts_count TO service_role;
GRANT EXECUTE ON FUNCTION cleanup_old_login_attempts TO service_role;
