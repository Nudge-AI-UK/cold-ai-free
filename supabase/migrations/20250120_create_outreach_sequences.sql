-- Create outreach_sequences table
CREATE TABLE IF NOT EXISTS outreach_sequences (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,

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
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

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
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

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

-- Create indexes for performance
CREATE INDEX idx_sequences_user_id ON outreach_sequences(user_id);
CREATE INDEX idx_sequences_status ON outreach_sequences(status);
CREATE INDEX idx_prospects_sequence_id ON sequence_prospects(sequence_id);
CREATE INDEX idx_prospects_status ON sequence_prospects(status);
CREATE INDEX idx_prospects_scheduled_for ON sequence_prospects(scheduled_for);
CREATE INDEX idx_messages_sequence_id ON sequence_messages(sequence_id);
CREATE INDEX idx_messages_prospect_id ON sequence_messages(prospect_id);
CREATE INDEX idx_messages_scheduled_for ON sequence_messages(scheduled_for);

-- Enable RLS
ALTER TABLE outreach_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE sequence_prospects ENABLE ROW LEVEL SECURITY;
ALTER TABLE sequence_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for outreach_sequences
CREATE POLICY "Users can view their own sequences"
  ON outreach_sequences FOR SELECT
  USING (auth.uid() = user_id OR team_id IN (
    SELECT team_id FROM team_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can create sequences"
  ON outreach_sequences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own sequences"
  ON outreach_sequences FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own sequences"
  ON outreach_sequences FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for sequence_prospects
CREATE POLICY "Users can view their sequence prospects"
  ON sequence_prospects FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create sequence prospects"
  ON sequence_prospects FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their sequence prospects"
  ON sequence_prospects FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their sequence prospects"
  ON sequence_prospects FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for sequence_messages
CREATE POLICY "Users can view their sequence messages"
  ON sequence_messages FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create sequence messages"
  ON sequence_messages FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their sequence messages"
  ON sequence_messages FOR UPDATE
  USING (auth.uid() = user_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_sequence_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
CREATE TRIGGER update_outreach_sequences_updated_at
  BEFORE UPDATE ON outreach_sequences
  FOR EACH ROW
  EXECUTE FUNCTION update_sequence_updated_at();

CREATE TRIGGER update_sequence_prospects_updated_at
  BEFORE UPDATE ON sequence_prospects
  FOR EACH ROW
  EXECUTE FUNCTION update_sequence_updated_at();

CREATE TRIGGER update_sequence_messages_updated_at
  BEFORE UPDATE ON sequence_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_sequence_updated_at();

-- Create function to get next prospect to send
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

COMMENT ON TABLE outreach_sequences IS 'Stores LinkedIn outreach sequence campaigns';
COMMENT ON TABLE sequence_prospects IS 'Individual prospects/targets within sequences';
COMMENT ON TABLE sequence_messages IS 'Messages sent as part of sequences';
