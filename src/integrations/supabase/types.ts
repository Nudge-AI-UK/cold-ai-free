export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          user_id: string
          first_name: string | null
          last_name: string | null
          job_title: string | null
          company: string | null
          linkedin_url: string | null
          email: string | null
          phone: string | null
          bio: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['profiles']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>
      }
      company_profiles: {
        Row: {
          id: string
          user_id: string
          company_name: string
          industry: string | null
          company_size: string | null
          website: string | null
          description: string | null
          value_proposition: string | null
          target_market: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['company_profiles']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['company_profiles']['Insert']>
      }
      communication_preferences: {
        Row: {
          id: string
          user_id: string
          tone: 'professional' | 'casual' | 'friendly' | 'direct'
          style: 'concise' | 'detailed' | 'storytelling'
          emoji_use: boolean
          personalisation_level: 'low' | 'medium' | 'high'
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['communication_preferences']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['communication_preferences']['Insert']>
      }
      knowledge_base: {
        Row: {
          id: string
          user_id: string
          title: string
          content: string
          category: 'product' | 'service' | 'case_study' | 'other'
          tags: string[] | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['knowledge_base']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['knowledge_base']['Insert']>
      }
      icps: {
        Row: {
          id: string
          user_id: string
          name: string
          job_titles: string[]
          industries: string[]
          company_size: string
          pain_points: string[]
          goals: string[]
          trigger_events: string[] | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['icps']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['icps']['Insert']>
      }
      prospects: {
        Row: {
          id: string
          user_id: string
          icp_id: string | null
          name: string
          company: string
          job_title: string
          linkedin_url: string | null
          email: string | null
          status: 'new' | 'contacted' | 'responded' | 'qualified' | 'closed'
          notes: string | null
          last_contacted: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['prospects']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['prospects']['Insert']>
      }
      messages: {
        Row: {
          id: string
          user_id: string
          prospect_id: string | null
          icp_id: string | null
          type: 'linkedin' | 'email' | 'call_script'
          content: string
          subject: string | null
          metadata: Record<string, any> | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['messages']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['messages']['Insert']>
      }
      usage_tracking: {
        Row: {
          id: string
          user_id: string
          messages_sent: number
          messages_remaining: number
          period_start: string
          period_end: string
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['usage_tracking']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['usage_tracking']['Insert']>
      }
      subscriptions: {
        Row: {
          id: string
          user_id: string
          plan_type: 'free' | 'basic' | 'standard' | 'pro' | 'team'
          status: 'active' | 'cancelled' | 'expired'
          current_period_start: string
          current_period_end: string
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['subscriptions']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['subscriptions']['Insert']>
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}
