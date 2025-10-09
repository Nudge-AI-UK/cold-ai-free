export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      agent_conversations: {
        Row: {
          channel_id: string
          channel_type: string | null
          conversation_key: string
          current_plan: string | null
          expires_at: string | null
          id: string
          is_active: boolean | null
          last_updated: string | null
          metadata: Json | null
          started_at: string | null
          user_id: string
        }
        Insert: {
          channel_id: string
          channel_type?: string | null
          conversation_key: string
          current_plan?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          last_updated?: string | null
          metadata?: Json | null
          started_at?: string | null
          user_id: string
        }
        Update: {
          channel_id?: string
          channel_type?: string | null
          conversation_key?: string
          current_plan?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          last_updated?: string | null
          metadata?: Json | null
          started_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      agent_executions: {
        Row: {
          conversation_id: string | null
          created_at: string | null
          error_details: Json | null
          execution_time_ms: number | null
          execution_type: string | null
          id: string
          status: string | null
        }
        Insert: {
          conversation_id?: string | null
          created_at?: string | null
          error_details?: Json | null
          execution_time_ms?: number | null
          execution_type?: string | null
          id?: string
          status?: string | null
        }
        Update: {
          conversation_id?: string | null
          created_at?: string | null
          error_details?: Json | null
          execution_time_ms?: number | null
          execution_type?: string | null
          id?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_executions_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "agent_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_executions_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "recent_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_messages: {
        Row: {
          content: string
          conversation_id: string | null
          created_at: string | null
          id: string
          message_metadata: Json | null
          role: string
          token_count: number | null
        }
        Insert: {
          content: string
          conversation_id?: string | null
          created_at?: string | null
          id?: string
          message_metadata?: Json | null
          role: string
          token_count?: number | null
        }
        Update: {
          content?: string
          conversation_id?: string | null
          created_at?: string | null
          id?: string
          message_metadata?: Json | null
          role?: string
          token_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "agent_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "recent_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      business_profiles: {
        Row: {
          about_page_url: string | null
          additional_resource_url: string | null
          case_studies_url: string | null
          company_linkedin_url: string | null
          company_name: string
          company_size: string | null
          created_at: string | null
          id: number
          industry: string | null
          key_differentiators: string[] | null
          pain_points_addressed: string[] | null
          pricing_model: string | null
          product_description: string | null
          product_page_1: string | null
          product_page_2: string | null
          product_page_3: string | null
          target_market: string | null
          unique_selling_points: string | null
          updated_at: string | null
          urls_collected_at: string | null
          user_id: string | null
          value_proposition: string | null
          website: string | null
        }
        Insert: {
          about_page_url?: string | null
          additional_resource_url?: string | null
          case_studies_url?: string | null
          company_linkedin_url?: string | null
          company_name: string
          company_size?: string | null
          created_at?: string | null
          id?: number
          industry?: string | null
          key_differentiators?: string[] | null
          pain_points_addressed?: string[] | null
          pricing_model?: string | null
          product_description?: string | null
          product_page_1?: string | null
          product_page_2?: string | null
          product_page_3?: string | null
          target_market?: string | null
          unique_selling_points?: string | null
          updated_at?: string | null
          urls_collected_at?: string | null
          user_id?: string | null
          value_proposition?: string | null
          website?: string | null
        }
        Update: {
          about_page_url?: string | null
          additional_resource_url?: string | null
          case_studies_url?: string | null
          company_linkedin_url?: string | null
          company_name?: string
          company_size?: string | null
          created_at?: string | null
          id?: number
          industry?: string | null
          key_differentiators?: string[] | null
          pain_points_addressed?: string[] | null
          pricing_model?: string | null
          product_description?: string | null
          product_page_1?: string | null
          product_page_2?: string | null
          product_page_3?: string | null
          target_market?: string | null
          unique_selling_points?: string | null
          updated_at?: string | null
          urls_collected_at?: string | null
          user_id?: string | null
          value_proposition?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "business_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      communication_preferences: {
        Row: {
          avoid_phrases: string[] | null
          calendar_link: string | null
          communication_style: string | null
          created_at: string | null
          cta_preference: string | null
          custom_cta: string | null
          id: number
          message_length: string | null
          message_types: Json | null
          personalization_elements: Json | null
          primary_style: string | null
          signature_style: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          avoid_phrases?: string[] | null
          calendar_link?: string | null
          communication_style?: string | null
          created_at?: string | null
          cta_preference?: string | null
          custom_cta?: string | null
          id?: number
          message_length?: string | null
          message_types?: Json | null
          personalization_elements?: Json | null
          primary_style?: string | null
          signature_style?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          avoid_phrases?: string[] | null
          calendar_link?: string | null
          communication_style?: string | null
          created_at?: string | null
          cta_preference?: string | null
          custom_cta?: string | null
          id?: number
          message_length?: string | null
          message_types?: Json | null
          personalization_elements?: Json | null
          primary_style?: string | null
          signature_style?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "communication_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      company_profiles: {
        Row: {
          about_page_url: string | null
          additional_resource_url: string | null
          business_linkedin_url: string | null
          case_studies_url: string | null
          company_name: string
          company_size: string | null
          created_at: string | null
          id: number
          industry: string | null
          key_benefits: string | null
          product_description: string | null
          product_page_1: string | null
          product_page_2: string | null
          product_page_3: string | null
          target_market: string | null
          team_id: string | null
          unique_selling_points: string | null
          updated_at: string | null
          urls_collected_at: string | null
          website: string | null
        }
        Insert: {
          about_page_url?: string | null
          additional_resource_url?: string | null
          business_linkedin_url?: string | null
          case_studies_url?: string | null
          company_name: string
          company_size?: string | null
          created_at?: string | null
          id?: number
          industry?: string | null
          key_benefits?: string | null
          product_description?: string | null
          product_page_1?: string | null
          product_page_2?: string | null
          product_page_3?: string | null
          target_market?: string | null
          team_id?: string | null
          unique_selling_points?: string | null
          updated_at?: string | null
          urls_collected_at?: string | null
          website?: string | null
        }
        Update: {
          about_page_url?: string | null
          additional_resource_url?: string | null
          business_linkedin_url?: string | null
          case_studies_url?: string | null
          company_name?: string
          company_size?: string | null
          created_at?: string | null
          id?: number
          industry?: string | null
          key_benefits?: string | null
          product_description?: string | null
          product_page_1?: string | null
          product_page_2?: string | null
          product_page_3?: string | null
          target_market?: string | null
          team_id?: string | null
          unique_selling_points?: string | null
          updated_at?: string | null
          urls_collected_at?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_profiles_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["team_id"]
          },
        ]
      }
      icps: {
        Row: {
          budget_range: string | null
          buying_signals: string[] | null
          call_to_action: string | null
          can_restore_until: string | null
          company_characteristics: string | null
          company_size_range: string | null
          competitive_alternatives: string[] | null
          competitive_landscape: string | null
          created_at: string | null
          created_by: string | null
          decision_making_process: string | null
          deleted_at: string | null
          description: string | null
          generation_attempts: number | null
          geographic_focus: string[] | null
          growth_opportunities: string[] | null
          icp_name: string
          id: number
          industry_focus: string[] | null
          is_active: boolean | null
          job_titles: string[] | null
          key_messaging_points: string[] | null
          last_error: string | null
          last_used: string | null
          market_trends: string | null
          metadata: Json | null
          objections_and_concerns: string[] | null
          pain_points: string[] | null
          preferred_communication_channels: string[] | null
          product_link_id: number | null
          review_notes: string | null
          review_status: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          risk_factors: string[] | null
          sales_cycle_length: string | null
          success_metrics: string[] | null
          team_id: string | null
          technology_stack: string[] | null
          updated_at: string | null
          value_drivers: string[] | null
          workflow_status:
            | Database["public"]["Enums"]["icp_workflow_status"]
            | null
        }
        Insert: {
          budget_range?: string | null
          buying_signals?: string[] | null
          call_to_action?: string | null
          can_restore_until?: string | null
          company_characteristics?: string | null
          company_size_range?: string | null
          competitive_alternatives?: string[] | null
          competitive_landscape?: string | null
          created_at?: string | null
          created_by?: string | null
          decision_making_process?: string | null
          deleted_at?: string | null
          description?: string | null
          generation_attempts?: number | null
          geographic_focus?: string[] | null
          growth_opportunities?: string[] | null
          icp_name: string
          id?: number
          industry_focus?: string[] | null
          is_active?: boolean | null
          job_titles?: string[] | null
          key_messaging_points?: string[] | null
          last_error?: string | null
          last_used?: string | null
          market_trends?: string | null
          metadata?: Json | null
          objections_and_concerns?: string[] | null
          pain_points?: string[] | null
          preferred_communication_channels?: string[] | null
          product_link_id?: number | null
          review_notes?: string | null
          review_status?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          risk_factors?: string[] | null
          sales_cycle_length?: string | null
          success_metrics?: string[] | null
          team_id?: string | null
          technology_stack?: string[] | null
          updated_at?: string | null
          value_drivers?: string[] | null
          workflow_status?:
            | Database["public"]["Enums"]["icp_workflow_status"]
            | null
        }
        Update: {
          budget_range?: string | null
          buying_signals?: string[] | null
          call_to_action?: string | null
          can_restore_until?: string | null
          company_characteristics?: string | null
          company_size_range?: string | null
          competitive_alternatives?: string[] | null
          competitive_landscape?: string | null
          created_at?: string | null
          created_by?: string | null
          decision_making_process?: string | null
          deleted_at?: string | null
          description?: string | null
          generation_attempts?: number | null
          geographic_focus?: string[] | null
          growth_opportunities?: string[] | null
          icp_name?: string
          id?: number
          industry_focus?: string[] | null
          is_active?: boolean | null
          job_titles?: string[] | null
          key_messaging_points?: string[] | null
          last_error?: string | null
          last_used?: string | null
          market_trends?: string | null
          metadata?: Json | null
          objections_and_concerns?: string[] | null
          pain_points?: string[] | null
          preferred_communication_channels?: string[] | null
          product_link_id?: number | null
          review_notes?: string | null
          review_status?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          risk_factors?: string[] | null
          sales_cycle_length?: string | null
          success_metrics?: string[] | null
          team_id?: string | null
          technology_stack?: string[] | null
          updated_at?: string | null
          value_drivers?: string[] | null
          workflow_status?:
            | Database["public"]["Enums"]["icp_workflow_status"]
            | null
        }
        Relationships: [
          {
            foreignKeyName: "icps_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "icps_product_link_id_fkey"
            columns: ["product_link_id"]
            isOneToOne: false
            referencedRelation: "knowledge_base"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "icps_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "icps_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["team_id"]
          },
        ]
      }
      integrations: {
        Row: {
          config_data: Json | null
          created_at: string | null
          id: number
          integration_type: string | null
          is_active: boolean | null
          last_sync_at: string | null
          team_id: string | null
          updated_at: string | null
        }
        Insert: {
          config_data?: Json | null
          created_at?: string | null
          id?: number
          integration_type?: string | null
          is_active?: boolean | null
          last_sync_at?: string | null
          team_id?: string | null
          updated_at?: string | null
        }
        Update: {
          config_data?: Json | null
          created_at?: string | null
          id?: number
          integration_type?: string | null
          is_active?: boolean | null
          last_sync_at?: string | null
          team_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "integrations_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["team_id"]
          },
        ]
      }
      interactive_message_tracking: {
        Row: {
          channel_id: string
          created_at: string | null
          expires_at: string
          id: number
          message_context: Json
          message_ts: string
          message_type: string
          thread_ts: string | null
          user_id: string
        }
        Insert: {
          channel_id: string
          created_at?: string | null
          expires_at: string
          id?: number
          message_context: Json
          message_ts: string
          message_type: string
          thread_ts?: string | null
          user_id: string
        }
        Update: {
          channel_id?: string
          created_at?: string | null
          expires_at?: string
          id?: number
          message_context?: Json
          message_ts?: string
          message_type?: string
          thread_ts?: string | null
          user_id?: string
        }
        Relationships: []
      }
      knowledge_base: {
        Row: {
          ai_generation_count: number | null
          can_restore_until: string | null
          content: string
          created_at: string | null
          created_by: string | null
          deleted_at: string | null
          embedding: string | null
          id: number
          knowledge_type: string | null
          last_ai_generation: string | null
          last_enhanced_at: string | null
          metadata: Json | null
          review_notes: string | null
          review_status: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          summary: string | null
          team_id: string | null
          title: string
          updated_at: string | null
          workflow_metadata: Json | null
          workflow_status: string | null
        }
        Insert: {
          ai_generation_count?: number | null
          can_restore_until?: string | null
          content: string
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          embedding?: string | null
          id?: number
          knowledge_type?: string | null
          last_ai_generation?: string | null
          last_enhanced_at?: string | null
          metadata?: Json | null
          review_notes?: string | null
          review_status?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          summary?: string | null
          team_id?: string | null
          title: string
          updated_at?: string | null
          workflow_metadata?: Json | null
          workflow_status?: string | null
        }
        Update: {
          ai_generation_count?: number | null
          can_restore_until?: string | null
          content?: string
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          embedding?: string | null
          id?: number
          knowledge_type?: string | null
          last_ai_generation?: string | null
          last_enhanced_at?: string | null
          metadata?: Json | null
          review_notes?: string | null
          review_status?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          summary?: string | null
          team_id?: string | null
          title?: string
          updated_at?: string | null
          workflow_metadata?: Json | null
          workflow_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_base_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "knowledge_base_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["team_id"]
          },
        ]
      }
      knowledge_base_ai_usage: {
        Row: {
          cost_estimate: number | null
          created_at: string | null
          generation_type: string | null
          id: number
          knowledge_base_id: number | null
          tokens_used: number | null
          user_id: string
        }
        Insert: {
          cost_estimate?: number | null
          created_at?: string | null
          generation_type?: string | null
          id?: number
          knowledge_base_id?: number | null
          tokens_used?: number | null
          user_id: string
        }
        Update: {
          cost_estimate?: number | null
          created_at?: string | null
          generation_type?: string | null
          id?: number
          knowledge_base_id?: number | null
          tokens_used?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_base_ai_usage_knowledge_base_id_fkey"
            columns: ["knowledge_base_id"]
            isOneToOne: false
            referencedRelation: "knowledge_base"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_base_edits: {
        Row: {
          created_at: string | null
          edit_type: string
          id: number
          knowledge_base_id: number
          user_id: string
        }
        Insert: {
          created_at?: string | null
          edit_type: string
          id?: number
          knowledge_base_id: number
          user_id: string
        }
        Update: {
          created_at?: string | null
          edit_type?: string
          id?: number
          knowledge_base_id?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_base_edits_knowledge_base_id_fkey"
            columns: ["knowledge_base_id"]
            isOneToOne: false
            referencedRelation: "knowledge_base"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_base_lifecycle: {
        Row: {
          action: string
          created_at: string | null
          entry_data: Json | null
          entry_type: string
          id: number
          knowledge_base_id: number | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string | null
          entry_data?: Json | null
          entry_type: string
          id?: number
          knowledge_base_id?: number | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string | null
          entry_data?: Json | null
          entry_type?: string
          id?: number
          knowledge_base_id?: number | null
          user_id?: string
        }
        Relationships: []
      }
      knowledge_base_wiki: {
        Row: {
          ai_insights: Json | null
          compiled_content: string
          completeness_score: number | null
          created_at: string | null
          entry_count: number | null
          entry_ids: number[]
          id: string
          last_compiled_at: string | null
          last_entry_added: number | null
          status: string | null
          summary: string | null
          table_of_contents: Json | null
          team_id: string | null
          title: string
          updated_at: string | null
          user_id: string
          wiki_metadata: Json | null
        }
        Insert: {
          ai_insights?: Json | null
          compiled_content: string
          completeness_score?: number | null
          created_at?: string | null
          entry_count?: number | null
          entry_ids?: number[]
          id?: string
          last_compiled_at?: string | null
          last_entry_added?: number | null
          status?: string | null
          summary?: string | null
          table_of_contents?: Json | null
          team_id?: string | null
          title: string
          updated_at?: string | null
          user_id: string
          wiki_metadata?: Json | null
        }
        Update: {
          ai_insights?: Json | null
          compiled_content?: string
          completeness_score?: number | null
          created_at?: string | null
          entry_count?: number | null
          entry_ids?: number[]
          id?: string
          last_compiled_at?: string | null
          last_entry_added?: number | null
          status?: string | null
          summary?: string | null
          table_of_contents?: Json | null
          team_id?: string | null
          title?: string
          updated_at?: string | null
          user_id?: string
          wiki_metadata?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_base_wiki_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: true
            referencedRelation: "teams"
            referencedColumns: ["team_id"]
          },
        ]
      }
      landing_interest: {
        Row: {
          created_at: string | null
          email: string
          id: string
          ip_address: string | null
          processed: boolean | null
          referrer: string | null
          source: string | null
          user_agent: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          id?: string
          ip_address?: string | null
          processed?: boolean | null
          referrer?: string | null
          source?: string | null
          user_agent?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          ip_address?: string | null
          processed?: boolean | null
          referrer?: string | null
          source?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      message_generation_logs: {
        Row: {
          ai_context: Json
          ai_model_used: string | null
          conversation_thread_id: string | null
          created_at: string | null
          edited_message: string | null
          generated_message: string | null
          generation_cost: number | null
          id: number
          message_id: string | null
          message_metadata: Json | null
          message_status: string | null
          parent_message_id: string | null
          research_cache_id: number | null
          response_id: number | null
          response_received_at: string | null
          sent_at: string | null
          team_id: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          ai_context?: Json
          ai_model_used?: string | null
          conversation_thread_id?: string | null
          created_at?: string | null
          edited_message?: string | null
          generated_message?: string | null
          generation_cost?: number | null
          id?: number
          message_id?: string | null
          message_metadata?: Json | null
          message_status?: string | null
          parent_message_id?: string | null
          research_cache_id?: number | null
          response_id?: number | null
          response_received_at?: string | null
          sent_at?: string | null
          team_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          ai_context?: Json
          ai_model_used?: string | null
          conversation_thread_id?: string | null
          created_at?: string | null
          edited_message?: string | null
          generated_message?: string | null
          generation_cost?: number | null
          id?: number
          message_id?: string | null
          message_metadata?: Json | null
          message_status?: string | null
          parent_message_id?: string | null
          research_cache_id?: number | null
          response_id?: number | null
          response_received_at?: string | null
          sent_at?: string | null
          team_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "message_generation_logs_parent_message_id_fkey"
            columns: ["parent_message_id"]
            isOneToOne: false
            referencedRelation: "message_generation_logs"
            referencedColumns: ["message_id"]
          },
          {
            foreignKeyName: "message_generation_logs_research_cache_id_fkey"
            columns: ["research_cache_id"]
            isOneToOne: false
            referencedRelation: "research_cache"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_generation_logs_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "message_generation_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      message_templates: {
        Row: {
          a_b_test_variant: string | null
          channel: string | null
          created_at: string | null
          created_by: string | null
          id: number
          is_active: boolean | null
          performance_metrics: Json | null
          personalization_tokens: Json | null
          team_id: string | null
          template_content: string
          template_name: string
          updated_at: string | null
        }
        Insert: {
          a_b_test_variant?: string | null
          channel?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: number
          is_active?: boolean | null
          performance_metrics?: Json | null
          personalization_tokens?: Json | null
          team_id?: string | null
          template_content: string
          template_name: string
          updated_at?: string | null
        }
        Update: {
          a_b_test_variant?: string | null
          channel?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: number
          is_active?: boolean | null
          performance_metrics?: Json | null
          personalization_tokens?: Json | null
          team_id?: string | null
          template_content?: string
          template_name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "message_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "message_templates_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["team_id"]
          },
        ]
      }
      product_links: {
        Row: {
          created_at: string | null
          id: string
          last_researched: string | null
          name: string
          research_data: Json | null
          status: string | null
          team_id: string | null
          updated_at: string | null
          url: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          last_researched?: string | null
          name: string
          research_data?: Json | null
          status?: string | null
          team_id?: string | null
          updated_at?: string | null
          url: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          last_researched?: string | null
          name?: string
          research_data?: Json | null
          status?: string | null
          team_id?: string | null
          updated_at?: string | null
          url?: string
          user_id?: string
        }
        Relationships: []
      }
      product_profiles: {
        Row: {
          benefits: string[] | null
          case_study_links: string[] | null
          created_at: string | null
          demo_link: string | null
          documentation_link: string | null
          features: string[] | null
          id: number
          integrations: string[] | null
          pricing_tiers: Json | null
          products: Json | null
          updated_at: string | null
          use_cases: string[] | null
          user_id: string | null
        }
        Insert: {
          benefits?: string[] | null
          case_study_links?: string[] | null
          created_at?: string | null
          demo_link?: string | null
          documentation_link?: string | null
          features?: string[] | null
          id?: number
          integrations?: string[] | null
          pricing_tiers?: Json | null
          products?: Json | null
          updated_at?: string | null
          use_cases?: string[] | null
          user_id?: string | null
        }
        Update: {
          benefits?: string[] | null
          case_study_links?: string[] | null
          created_at?: string | null
          demo_link?: string | null
          documentation_link?: string | null
          features?: string[] | null
          id?: number
          integrations?: string[] | null
          pricing_tiers?: Json | null
          products?: Json | null
          updated_at?: string | null
          use_cases?: string[] | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      product_research_queue: {
        Row: {
          attempts: number | null
          created_at: string | null
          error_message: string | null
          id: string
          processed_at: string | null
          product_link_id: string
          status: string | null
          webhook_response: Json | null
        }
        Insert: {
          attempts?: number | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          processed_at?: string | null
          product_link_id: string
          status?: string | null
          webhook_response?: Json | null
        }
        Update: {
          attempts?: number | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          processed_at?: string | null
          product_link_id?: string
          status?: string | null
          webhook_response?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "product_research_queue_product_link_id_fkey"
            columns: ["product_link_id"]
            isOneToOne: false
            referencedRelation: "product_links"
            referencedColumns: ["id"]
          },
        ]
      }
      research_cache: {
        Row: {
          created_at: string | null
          id: number
          last_researched_at: string | null
          profile_picture_url: string | null
          profile_type: string | null
          profile_url: string | null
          research_data: Json | null
          research_depth: string | null
          research_version: number | null
        }
        Insert: {
          created_at?: string | null
          id?: number
          last_researched_at?: string | null
          profile_picture_url?: string | null
          profile_type?: string | null
          profile_url?: string | null
          research_data?: Json | null
          research_depth?: string | null
          research_version?: number | null
        }
        Update: {
          created_at?: string | null
          id?: number
          last_researched_at?: string | null
          profile_picture_url?: string | null
          profile_type?: string | null
          profile_url?: string | null
          research_data?: Json | null
          research_depth?: string | null
          research_version?: number | null
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          billing_cycle_end: string | null
          billing_cycle_start: string | null
          billing_email: string
          created_at: string | null
          max_teams_allowed: number | null
          plan_type: string
          squarespace_subscription_id: string | null
          status: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscription_id: string
          teams_created: number | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          billing_cycle_end?: string | null
          billing_cycle_start?: string | null
          billing_email: string
          created_at?: string | null
          max_teams_allowed?: number | null
          plan_type: string
          squarespace_subscription_id?: string | null
          status?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_id: string
          teams_created?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          billing_cycle_end?: string | null
          billing_cycle_start?: string | null
          billing_email?: string
          created_at?: string | null
          max_teams_allowed?: number | null
          plan_type?: string
          squarespace_subscription_id?: string | null
          status?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_id?: string
          teams_created?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      sync_status: {
        Row: {
          last_check_timestamp: string | null
          last_error: string | null
          last_order_id: string | null
          orders_processed: number | null
          sync_type: string
          updated_at: string | null
        }
        Insert: {
          last_check_timestamp?: string | null
          last_error?: string | null
          last_order_id?: string | null
          orders_processed?: number | null
          sync_type: string
          updated_at?: string | null
        }
        Update: {
          last_check_timestamp?: string | null
          last_error?: string | null
          last_order_id?: string | null
          orders_processed?: number | null
          sync_type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      team_memberships: {
        Row: {
          can_invite_members: boolean | null
          can_manage_company_profile: boolean | null
          can_manage_icps: boolean | null
          can_manage_knowledge_base: boolean | null
          can_view_team_stats: boolean | null
          id: number
          invited_by: string | null
          joined_at: string | null
          role: string | null
          status: string | null
          team_id: string | null
          user_id: string | null
        }
        Insert: {
          can_invite_members?: boolean | null
          can_manage_company_profile?: boolean | null
          can_manage_icps?: boolean | null
          can_manage_knowledge_base?: boolean | null
          can_view_team_stats?: boolean | null
          id?: number
          invited_by?: string | null
          joined_at?: string | null
          role?: string | null
          status?: string | null
          team_id?: string | null
          user_id?: string | null
        }
        Update: {
          can_invite_members?: boolean | null
          can_manage_company_profile?: boolean | null
          can_manage_icps?: boolean | null
          can_manage_knowledge_base?: boolean | null
          can_view_team_stats?: boolean | null
          id?: number
          invited_by?: string | null
          joined_at?: string | null
          role?: string | null
          status?: string | null
          team_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "team_memberships_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "team_memberships_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "team_memberships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      teams: {
        Row: {
          created_at: string | null
          monthly_message_limit: number
          monthly_messages_used: number | null
          product_focus: string | null
          reset_date: string | null
          status: string | null
          subscription_id: string | null
          team_id: string
          team_name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          monthly_message_limit: number
          monthly_messages_used?: number | null
          product_focus?: string | null
          reset_date?: string | null
          status?: string | null
          subscription_id?: string | null
          team_id?: string
          team_name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          monthly_message_limit?: number
          monthly_messages_used?: number | null
          product_focus?: string | null
          reset_date?: string | null
          status?: string | null
          subscription_id?: string | null
          team_id?: string
          team_name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "teams_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["subscription_id"]
          },
        ]
      }
      usage_tracking: {
        Row: {
          created_at: string | null
          id: number
          messages_archived: number | null
          messages_generated: number | null
          messages_sent: number | null
          research_performed: number | null
          team_id: string | null
          usage_date: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: number
          messages_archived?: number | null
          messages_generated?: number | null
          messages_sent?: number | null
          research_performed?: number | null
          team_id?: string | null
          usage_date?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: number
          messages_archived?: number | null
          messages_generated?: number | null
          messages_sent?: number | null
          research_performed?: number | null
          team_id?: string | null
          usage_date?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "usage_tracking_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "usage_tracking_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          created_at: string | null
          id: number
          job_title: string | null
          linkedin_connected: boolean | null
          linkedin_premium: boolean | null
          linkedin_profile_data: Json | null
          linkedin_profile_hash: string | null
          linkedin_profile_scraped_at: string | null
          linkedin_profile_updated_at: string | null
          linkedin_url: string | null
          personal_bio: string | null
          phone_number: string | null
          territory: string | null
          unipile_account_id: string | null
          updated_at: string | null
          user_id: string | null
          user_role: string | null
        }
        Insert: {
          created_at?: string | null
          id?: number
          job_title?: string | null
          linkedin_connected?: boolean | null
          linkedin_premium?: boolean | null
          linkedin_profile_data?: Json | null
          linkedin_profile_hash?: string | null
          linkedin_profile_scraped_at?: string | null
          linkedin_profile_updated_at?: string | null
          linkedin_url?: string | null
          personal_bio?: string | null
          phone_number?: string | null
          territory?: string | null
          unipile_account_id?: string | null
          updated_at?: string | null
          user_id?: string | null
          user_role?: string | null
        }
        Update: {
          created_at?: string | null
          id?: number
          job_title?: string | null
          linkedin_connected?: boolean | null
          linkedin_premium?: boolean | null
          linkedin_profile_data?: Json | null
          linkedin_profile_hash?: string | null
          linkedin_profile_scraped_at?: string | null
          linkedin_profile_updated_at?: string | null
          linkedin_url?: string | null
          personal_bio?: string | null
          phone_number?: string | null
          territory?: string | null
          unipile_account_id?: string | null
          updated_at?: string | null
          user_id?: string | null
          user_role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      user_sessions: {
        Row: {
          auth_initiated_at: string | null
          auth_message_ts: string | null
          auth_status: string | null
          awaiting_callback: boolean | null
          channel_type: string | null
          created_at: string | null
          expires_at: string | null
          id: number
          is_dm: boolean | null
          session_active: boolean | null
          session_token: string | null
          slack_channel_id: string | null
          slack_thread_ts: string | null
          slack_user_id: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          auth_initiated_at?: string | null
          auth_message_ts?: string | null
          auth_status?: string | null
          awaiting_callback?: boolean | null
          channel_type?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: number
          is_dm?: boolean | null
          session_active?: boolean | null
          session_token?: string | null
          slack_channel_id?: string | null
          slack_thread_ts?: string | null
          slack_user_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          auth_initiated_at?: string | null
          auth_message_ts?: string | null
          auth_status?: string | null
          awaiting_callback?: boolean | null
          channel_type?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: number
          is_dm?: boolean | null
          session_active?: boolean | null
          session_token?: string | null
          slack_channel_id?: string | null
          slack_thread_ts?: string | null
          slack_user_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      users: {
        Row: {
          analysis_completed_at: string | null
          created_at: string | null
          email: string | null
          email_verified: boolean | null
          first_name: string | null
          last_name: string | null
          onboarding_completed: boolean | null
          onboarding_completed_at: string | null
          onboarding_step: number | null
          onboarding_urls_collected: boolean | null
          profile_analyzed: boolean | null
          profile_completion: Json | null
          ready_for_outreach: boolean | null
          slack_team_id: string | null
          status: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          analysis_completed_at?: string | null
          created_at?: string | null
          email?: string | null
          email_verified?: boolean | null
          first_name?: string | null
          last_name?: string | null
          onboarding_completed?: boolean | null
          onboarding_completed_at?: string | null
          onboarding_step?: number | null
          onboarding_urls_collected?: boolean | null
          profile_analyzed?: boolean | null
          profile_completion?: Json | null
          ready_for_outreach?: boolean | null
          slack_team_id?: string | null
          status?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          analysis_completed_at?: string | null
          created_at?: string | null
          email?: string | null
          email_verified?: boolean | null
          first_name?: string | null
          last_name?: string | null
          onboarding_completed?: boolean | null
          onboarding_completed_at?: string | null
          onboarding_step?: number | null
          onboarding_urls_collected?: boolean | null
          profile_analyzed?: boolean | null
          profile_completion?: Json | null
          ready_for_outreach?: boolean | null
          slack_team_id?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      webhook_events: {
        Row: {
          completed_at: string | null
          created_at: string | null
          error_message: string | null
          event_type: string | null
          id: number
          idempotency_key: string | null
          payload: Json | null
          processed: boolean | null
          result: Json | null
          retry_count: number | null
          source: string | null
          status: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          event_type?: string | null
          id?: number
          idempotency_key?: string | null
          payload?: Json | null
          processed?: boolean | null
          result?: Json | null
          retry_count?: number | null
          source?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          event_type?: string | null
          id?: number
          idempotency_key?: string | null
          payload?: Json | null
          processed?: boolean | null
          result?: Json | null
          retry_count?: number | null
          source?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "webhook_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
        ]
      }
    }
    Views: {
      recent_conversations: {
        Row: {
          channel_id: string | null
          conversation_key: string | null
          current_plan: string | null
          id: string | null
          last_message_at: string | null
          last_updated: string | null
          message_count: number | null
          user_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      binary_quantize: {
        Args: { "": string } | { "": unknown }
        Returns: unknown
      }
      can_generate_message: {
        Args: { p_user_id: string }
        Returns: boolean
      }
      check_email_verified: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      cleanup_expired_conversations: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      cleanup_old_idempotency_keys: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      cleanup_old_webhook_events: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      get_max_teams: {
        Args: { plan_type: string }
        Returns: number
      }
      get_message_limit: {
        Args: { plan_type: string }
        Returns: number
      }
      halfvec_avg: {
        Args: { "": number[] }
        Returns: unknown
      }
      halfvec_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      halfvec_send: {
        Args: { "": unknown }
        Returns: string
      }
      halfvec_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
      hnsw_bit_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnsw_halfvec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnsw_sparsevec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnswhandler: {
        Args: { "": unknown }
        Returns: unknown
      }
      increment_usage_tracking: {
        Args: {
          p_field: string
          p_increment?: number
          p_usage_date: string
          p_user_id: string
        }
        Returns: undefined
      }
      ivfflat_bit_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      ivfflat_halfvec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      ivfflathandler: {
        Args: { "": unknown }
        Returns: unknown
      }
      l2_norm: {
        Args: { "": unknown } | { "": unknown }
        Returns: number
      }
      l2_normalize: {
        Args: { "": string } | { "": unknown } | { "": unknown }
        Returns: string
      }
      manually_process_icp_reviews: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      register_user_from_slack: {
        Args: { p_email?: string; p_slack_team_id?: string; p_user_id: string }
        Returns: Json
      }
      reset_monthly_usage: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      reset_webhook_sequence: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      sparsevec_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      sparsevec_send: {
        Args: { "": unknown }
        Returns: string
      }
      sparsevec_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
      track_message_usage: {
        Args: { p_message_count?: number; p_user_id: string }
        Returns: Json
      }
      user_can_manage_team_memberships: {
        Args: { team_id_param: string }
        Returns: boolean
      }
      vector_avg: {
        Args: { "": number[] }
        Returns: string
      }
      vector_dims: {
        Args: { "": string } | { "": unknown }
        Returns: number
      }
      vector_norm: {
        Args: { "": string }
        Returns: number
      }
      vector_out: {
        Args: { "": string }
        Returns: unknown
      }
      vector_send: {
        Args: { "": string }
        Returns: string
      }
      vector_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
    }
    Enums: {
      icp_workflow_status:
        | "form"
        | "generating"
        | "draft"
        | "reviewing"
        | "approved"
        | "failed"
        | "archived"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      icp_workflow_status: [
        "form",
        "generating",
        "draft",
        "reviewing",
        "approved",
        "failed",
        "archived",
      ],
    },
  },
} as const
