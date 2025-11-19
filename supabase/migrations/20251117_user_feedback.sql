-- Create user_feedback table for collecting user feedback
CREATE TABLE IF NOT EXISTS user_feedback (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT,
  email TEXT NOT NULL,
  subject TEXT NOT NULL,
  feedback TEXT NOT NULL,
  feedback_type TEXT NOT NULL CHECK (feedback_type IN ('bug', 'feature', 'improvement', 'other', 'love_it', 'issue', 'suggestion', 'question')),
  context_data JSONB DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'reviewed', 'in_progress', 'resolved', 'closed')),
  admin_notes TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_user_feedback_status ON user_feedback(status);
CREATE INDEX IF NOT EXISTS idx_user_feedback_created_at ON user_feedback(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_feedback_email ON user_feedback(email);
CREATE INDEX IF NOT EXISTS idx_user_feedback_user_id ON user_feedback(user_id);

-- Enable RLS
ALTER TABLE user_feedback ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can insert feedback
CREATE POLICY "Anyone can submit feedback"
  ON user_feedback
  FOR INSERT
  WITH CHECK (true);

-- Policy: Users can view their own feedback
CREATE POLICY "Users can view own feedback"
  ON user_feedback
  FOR SELECT
  USING (email = auth.jwt() ->> 'email' OR user_id = auth.uid()::text);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_user_feedback_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_feedback_updated_at
    BEFORE UPDATE ON user_feedback
    FOR EACH ROW
    EXECUTE FUNCTION update_user_feedback_updated_at();

COMMENT ON TABLE user_feedback IS 'User feedback and bug reports';
COMMENT ON COLUMN user_feedback.user_id IS 'User ID from auth for linking feedback to users';
COMMENT ON COLUMN user_feedback.feedback_type IS 'Type of feedback: bug, feature, improvement, other, love_it, issue, suggestion, or question';
COMMENT ON COLUMN user_feedback.context_data IS 'JSONB field containing page context (page, productId, icpId, messageId, researchId, feature, feedbackTarget)';
COMMENT ON COLUMN user_feedback.status IS 'Current status of the feedback: new, reviewed, in_progress, resolved, or closed';
