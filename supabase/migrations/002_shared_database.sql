-- Migration to support shared database between free and paid apps
-- Run this on your existing Supabase database

-- Add app_version column if you want to track which app users came from (optional)
ALTER TABLE subscriptions 
ADD COLUMN IF NOT EXISTS app_version TEXT DEFAULT 'paid';

-- Update existing subscriptions to mark them as 'paid' (optional)
UPDATE subscriptions 
SET app_version = 'paid' 
WHERE app_version IS NULL;

-- Update RLS policies to enforce free tier limits
-- Drop existing policies first
DROP POLICY IF EXISTS "Users can insert own knowledge" ON knowledge_base;
DROP POLICY IF EXISTS "Users can insert own ICPs" ON icps;

-- Knowledge Base: Free users limited to 1 entry
CREATE POLICY "Users can insert own knowledge" ON knowledge_base 
FOR INSERT WITH CHECK (
  auth.uid() = user_id AND
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM subscriptions 
      WHERE user_id = auth.uid() 
      AND plan_type = 'free'
    )
    THEN (SELECT COUNT(*) FROM knowledge_base WHERE user_id = auth.uid()) < 1
    ELSE true
  END
);

-- ICPs: Free users limited to 1 ICP
CREATE POLICY "Users can insert own ICPs" ON icps 
FOR INSERT WITH CHECK (
  auth.uid() = user_id AND
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM subscriptions 
      WHERE user_id = auth.uid() 
      AND plan_type = 'free'
    )
    THEN (SELECT COUNT(*) FROM icps WHERE user_id = auth.uid()) < 1
    ELSE true
  END
);

-- Function to check message limits for free users
CREATE OR REPLACE FUNCTION check_message_limit()
RETURNS TRIGGER AS $$
BEGIN
  -- Only check for free tier users
  IF EXISTS (
    SELECT 1 FROM subscriptions 
    WHERE user_id = NEW.user_id 
    AND plan_type = 'free'
  ) THEN
    -- Check current month's usage
    IF EXISTS (
      SELECT 1 FROM usage 
      WHERE user_id = NEW.user_id 
      AND period_start <= CURRENT_DATE 
      AND period_end >= CURRENT_DATE 
      AND messages_remaining <= 0
    ) THEN
      RAISE EXCEPTION 'Monthly message limit reached for free tier';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for message limit checking (if not exists)
DROP TRIGGER IF EXISTS check_message_limit_trigger ON messages;
CREATE TRIGGER check_message_limit_trigger
  BEFORE INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION check_message_limit();

-- Function to automatically create usage records for new periods
CREATE OR REPLACE FUNCTION create_monthly_usage()
RETURNS void AS $$
DECLARE
  user_record RECORD;
  current_period_start DATE;
  current_period_end DATE;
BEGIN
  -- Calculate current period
  current_period_start := DATE_TRUNC('month', CURRENT_DATE);
  current_period_end := (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month - 1 day')::DATE;
  
  -- Create usage records for all users who don't have one for current period
  FOR user_record IN 
    SELECT DISTINCT s.user_id, s.plan_type 
    FROM subscriptions s
    WHERE NOT EXISTS (
      SELECT 1 FROM usage u 
      WHERE u.user_id = s.user_id 
      AND u.period_start = current_period_start
    )
  LOOP
    INSERT INTO usage (
      user_id,
      messages_sent,
      messages_remaining,
      period_start,
      period_end
    ) VALUES (
      user_record.user_id,
      0,
      CASE 
        WHEN user_record.plan_type = 'free' THEN 25
        WHEN user_record.plan_type = 'basic' THEN 500
        WHEN user_record.plan_type = 'standard' THEN 2000
        ELSE 999999 -- Unlimited for pro/team
      END,
      current_period_start,
      current_period_end
    );
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Create a scheduled job to run monthly (requires pg_cron extension)
-- Note: You'll need to enable pg_cron in Supabase dashboard first
-- Then uncomment and run this:
/*
SELECT cron.schedule(
  'create-monthly-usage', 
  '0 0 1 * *', -- Run at midnight on the 1st of each month
  $$SELECT create_monthly_usage();$$
);
*/

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Add index for better performance on usage queries
CREATE INDEX IF NOT EXISTS idx_usage_period ON usage(user_id, period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_subscriptions_plan ON subscriptions(user_id, plan_type);

COMMENT ON COLUMN subscriptions.app_version IS 'Tracks which app the user signed up from: free or paid';
COMMENT ON FUNCTION check_message_limit IS 'Enforces message limits for free tier users';
COMMENT ON FUNCTION create_monthly_usage IS 'Creates monthly usage records for all users';