export interface User {
  id: string
  email: string
  full_name?: string
  avatar_url?: string
  created_at: string
}

export interface Profile {
  id: string
  user_id: string
  first_name?: string
  last_name?: string
  job_title?: string
  company?: string
  linkedin_url?: string
  email?: string
  phone?: string
  bio?: string
  created_at: string
  updated_at: string
}

export interface CompanyProfile {
  id: string
  user_id: string
  company_name: string
  industry?: string
  company_size?: string
  website?: string
  description?: string
  value_proposition?: string
  target_market?: string
  created_at: string
  updated_at: string
}

export interface CommunicationPreferences {
  id: string
  user_id: string
  tone: 'professional' | 'casual' | 'friendly' | 'direct'
  style: 'concise' | 'detailed' | 'storytelling'
  emoji_use: boolean
  personalisation_level: 'low' | 'medium' | 'high'
  created_at: string
  updated_at: string
}

export interface KnowledgeEntry {
  id: string
  user_id: string
  title: string
  content: string
  category: 'product' | 'service' | 'case_study' | 'other'
  tags?: string[]
  created_at: string
  updated_at: string
}

export interface ICP {
  id: string
  user_id: string
  name: string
  job_titles: string[]
  industries: string[]
  company_size: string
  pain_points: string[]
  goals: string[]
  trigger_events?: string[]
  created_at: string
  updated_at: string
}

export interface Prospect {
  id: string
  user_id: string
  icp_id?: string
  name: string
  company: string
  job_title: string
  linkedin_url?: string
  email?: string
  status: 'new' | 'contacted' | 'responded' | 'qualified' | 'closed'
  notes?: string
  last_contacted?: string
  created_at: string
  updated_at: string
}

export interface Message {
  id: string
  user_id: string
  prospect_id?: string
  icp_id?: string
  type: 'linkedin' | 'email' | 'call_script'
  content: string
  subject?: string
  metadata?: Record<string, any>
  created_at: string
}

export interface Usage {
  id: string
  user_id: string
  messages_sent: number
  messages_remaining: number
  period_start: string
  period_end: string
  created_at: string
  updated_at: string
}

export interface Subscription {
  id: string
  user_id: string
  plan_type: 'free' | 'basic' | 'standard' | 'pro' | 'team'
  status: 'active' | 'cancelled' | 'expired'
  current_period_start: string
  current_period_end: string
  created_at: string
  updated_at: string
}