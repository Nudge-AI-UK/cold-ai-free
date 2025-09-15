-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  first_name TEXT,
  last_name TEXT,
  job_title TEXT,
  company TEXT,
  linkedin_url TEXT,
  email TEXT,
  phone TEXT,
  bio TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Create company_profiles table
CREATE TABLE IF NOT EXISTS company_profiles (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  company_name TEXT NOT NULL,
  industry TEXT,
  company_size TEXT,
  website TEXT,
  description TEXT,
  value_proposition TEXT,
  target_market TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Create communication_preferences table
CREATE TABLE IF NOT EXISTS communication_preferences (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  tone TEXT CHECK (tone IN ('professional', 'casual', 'friendly', 'direct')) DEFAULT 'professional',
  style TEXT CHECK (style IN ('concise', 'detailed', 'storytelling')) DEFAULT 'concise',
  emoji_use BOOLEAN DEFAULT false,
  personalisation_level TEXT CHECK (personalisation_level IN ('low', 'medium', 'high')) DEFAULT 'medium',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Create knowledge_base table
CREATE TABLE IF NOT EXISTS knowledge_base (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT CHECK (category IN ('product', 'service', 'case_study', 'other')) DEFAULT 'product',
  tags TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create icps table
CREATE TABLE IF NOT EXISTS icps (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  job_titles TEXT[],
  industries TEXT[],
  company_size TEXT,
  pain_points TEXT[],
  goals TEXT[],
  trigger_events TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create prospects table
CREATE TABLE IF NOT EXISTS prospects (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  icp_id UUID REFERENCES icps(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  company TEXT NOT NULL,
  job_title TEXT NOT NULL,
  linkedin_url TEXT,
  email TEXT,
  status TEXT CHECK (status IN ('new', 'contacted', 'responded', 'qualified', 'closed')) DEFAULT 'new',
  notes TEXT,
  last_contacted TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create messages table
CREATE TABLE IF NOT EXISTS messages (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  prospect_id UUID REFERENCES prospects(id) ON DELETE SET NULL,
  icp_id UUID REFERENCES icps(id) ON DELETE SET NULL,
  type TEXT CHECK (type IN ('linkedin', 'email', 'call_script')) NOT NULL,
  content TEXT NOT NULL,
  subject TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create usage table
CREATE TABLE IF NOT EXISTS usage (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  messages_sent INTEGER DEFAULT 0,
  messages_remaining INTEGER DEFAULT 25,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  plan_type TEXT CHECK (plan_type IN ('free', 'basic', 'standard', 'pro', 'team')) DEFAULT 'free',
  status TEXT CHECK (status IN ('active', 'cancelled', 'expired')) DEFAULT 'active',
  current_period_start TIMESTAMPTZ NOT NULL,
  current_period_end TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Create indexes for better performance
CREATE INDEX idx_profiles_user_id ON profiles(user_id);
CREATE INDEX idx_company_profiles_user_id ON company_profiles(user_id);
CREATE INDEX idx_communication_preferences_user_id ON communication_preferences(user_id);
CREATE INDEX idx_knowledge_base_user_id ON knowledge_base(user_id);
CREATE INDEX idx_icps_user_id ON icps(user_id);
CREATE INDEX idx_prospects_user_id ON prospects(user_id);
CREATE INDEX idx_messages_user_id ON messages(user_id);
CREATE INDEX idx_usage_user_id ON usage(user_id);
CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);

-- Row Level Security (RLS)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE communication_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_base ENABLE ROW LEVEL SECURITY;
ALTER TABLE icps ENABLE ROW LEVEL SECURITY;
ALTER TABLE prospects ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Profiles
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Company Profiles
CREATE POLICY "Users can view own company profile" ON company_profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own company profile" ON company_profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own company profile" ON company_profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Communication Preferences
CREATE POLICY "Users can view own preferences" ON communication_preferences FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own preferences" ON communication_preferences FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own preferences" ON communication_preferences FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Knowledge Base (Free tier: 1 entry limit)
CREATE POLICY "Users can view own knowledge" ON knowledge_base FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own knowledge" ON knowledge_base FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own knowledge" ON knowledge_base FOR INSERT WITH CHECK (
  auth.uid() = user_id AND
  (SELECT COUNT(*) FROM knowledge_base WHERE user_id = auth.uid()) < 1
);
CREATE POLICY "Users can delete own knowledge" ON knowledge_base FOR DELETE USING (auth.uid() = user_id);

-- ICPs (Free tier: 1 ICP limit)
CREATE POLICY "Users can view own ICPs" ON icps FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own ICPs" ON icps FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own ICPs" ON icps FOR INSERT WITH CHECK (
  auth.uid() = user_id AND
  (SELECT COUNT(*) FROM icps WHERE user_id = auth.uid()) < 1
);
CREATE POLICY "Users can delete own ICPs" ON icps FOR DELETE USING (auth.uid() = user_id);

-- Prospects
CREATE POLICY "Users can view own prospects" ON prospects FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own prospects" ON prospects FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own prospects" ON prospects FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own prospects" ON prospects FOR DELETE USING (auth.uid() = user_id);

-- Messages
CREATE POLICY "Users can view own messages" ON messages FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own messages" ON messages FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Usage
CREATE POLICY "Users can view own usage" ON usage FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own usage" ON usage FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own usage" ON usage FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Subscriptions
CREATE POLICY "Users can view own subscription" ON subscriptions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own subscription" ON subscriptions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own subscription" ON subscriptions FOR INSERT WITH CHECK (auth.uid() = user_id);