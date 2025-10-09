# Cold AI Free - Database Schema Reference

This file contains the database schema for reference when writing queries.

## Key Table Relationships

### User Management
- **`users`** - Main user table with `user_id` as primary key
- **`user_profiles`** - Personal profile info (linkedin_url, job_title, phone_number, etc.)
- **`subscriptions`** - User subscription status and plan types

### Business/Company Profiles
- **`business_profiles`** - For individual/solo users (references `user_id`)
- **`company_profiles`** - For team users (references `team_id`)

### Communication & Preferences
- **`communication_preferences`** - User communication style and preferences

### Knowledge & Content
- **`knowledge_base`** - Product/service information and content
- **`icps`** - Ideal Customer Profiles

### Teams & Collaboration
- **`teams`** - Team information
- **`team_memberships`** - User-team relationships

## Important Schema Notes

### Solo vs Team Users
- **Solo users** use `business_profiles` table with `user_id` foreign key
- **Team users** use `company_profiles` table with `team_id` foreign key

### Common Column Patterns
- Most tables use `user_id` as foreign key reference to `users.user_id`
- Team-related tables use `team_id`
- Knowledge base and ICPs use `created_by` field referencing `users.user_id`

### Key Tables for Settings Widget

#### `user_profiles`
- Primary key: `id`
- Foreign key: `user_id` → `users.user_id`
- Contains: linkedin_url, job_title, phone_number, personal_bio, territory

#### `business_profiles` (for solo users)
- Primary key: `id`
- Foreign key: `user_id` → `users.user_id`
- Contains: company_name, industry, company_size, website, product_description, etc.

#### `communication_preferences`
- Primary key: `id`
- Foreign key: `user_id` → `users.user_id`
- Contains: communication_style, message_length, message_types, signature_style, etc.

## Complete Schema (Context Only)

-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.agent_conversations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  conversation_key character varying NOT NULL UNIQUE,
  user_id character varying NOT NULL,
  channel_id character varying NOT NULL,
  channel_type character varying,
  current_plan text,
  metadata jsonb DEFAULT '{}'::jsonb,
  started_at timestamp with time zone DEFAULT now(),
  last_updated timestamp with time zone DEFAULT now(),
  expires_at timestamp with time zone DEFAULT (now() + '7 days'::interval),
  is_active boolean DEFAULT true,
  CONSTRAINT agent_conversations_pkey PRIMARY KEY (id)
);
CREATE TABLE public.agent_executions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  conversation_id uuid,
  execution_type character varying,
  status character varying,
  error_details jsonb,
  execution_time_ms integer,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT agent_executions_pkey PRIMARY KEY (id),
  CONSTRAINT agent_executions_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.agent_conversations(id)
);
CREATE TABLE public.agent_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  conversation_id uuid,
  role character varying NOT NULL CHECK (role::text = ANY (ARRAY['user'::character varying, 'assistant'::character varying, 'system'::character varying]::text[])),
  content text NOT NULL,
  message_metadata jsonb DEFAULT '{}'::jsonb,
  token_count integer,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT agent_messages_pkey PRIMARY KEY (id),
  CONSTRAINT agent_messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.agent_conversations(id)
);
CREATE TABLE public.business_profiles (
  user_id character varying UNIQUE,
  company_name character varying NOT NULL,
  industry character varying,
  company_size character varying,
  website character varying,
  company_linkedin_url character varying,
  product_description text,
  value_proposition text,
  target_market text,
  pain_points_addressed ARRAY,
  key_differentiators ARRAY,
  pricing_model character varying,
  id integer NOT NULL DEFAULT nextval('business_profiles_id_seq'::regclass),
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  product_page_1 character varying,
  product_page_2 character varying,
  product_page_3 character varying,
  case_studies_url character varying,
  about_page_url character varying,
  additional_resource_url character varying,
  urls_collected_at timestamp without time zone,
  unique_selling_points text,
  CONSTRAINT business_profiles_pkey PRIMARY KEY (id),
  CONSTRAINT business_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id)
);
CREATE TABLE public.communication_preferences (
  id integer NOT NULL DEFAULT nextval('communication_preferences_id_seq'::regclass),
  user_id character varying UNIQUE,
  communication_style character varying DEFAULT 'professional'::character varying CHECK (communication_style::text = ANY (ARRAY['professional'::character varying, 'casual'::character varying, 'consultative'::character varying]::text[])),
  message_length character varying DEFAULT 'medium'::character varying CHECK (message_length::text = ANY (ARRAY['short'::character varying::text, 'medium'::character varying::text, 'long'::character varying::text, 'brief'::character varying::text, 'moderate'::character varying::text, 'detailed'::character varying::text])),
  cta_preference character varying DEFAULT 'meeting'::character varying CHECK (cta_preference::text = ANY (ARRAY['meeting'::character varying, 'call'::character varying, 'email'::character varying, 'soft'::character varying]::text[])),
  signature_style text DEFAULT 'Best regards'::text,
  avoid_phrases ARRAY,
  calendar_link character varying,
  personalization_elements jsonb,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  message_types jsonb,
  primary_style character varying,
  custom_cta text,
  CONSTRAINT communication_preferences_pkey PRIMARY KEY (id),
  CONSTRAINT communication_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id)
);
CREATE TABLE public.company_profiles (
  id integer NOT NULL DEFAULT nextval('company_profiles_id_seq'::regclass),
  team_id character varying,
  company_name character varying NOT NULL,
  industry character varying,
  company_size character varying,
  website character varying,
  business_linkedin_url character varying,
  product_description text,
  key_benefits text,
  unique_selling_points text,
  target_market text,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  product_page_1 character varying,
  product_page_2 character varying,
  product_page_3 character varying,
  case_studies_url character varying,
  about_page_url character varying,
  additional_resource_url character varying,
  urls_collected_at timestamp without time zone,
  CONSTRAINT company_profiles_pkey PRIMARY KEY (id),
  CONSTRAINT company_profiles_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(team_id)
);
CREATE TABLE public.icps (
  id integer NOT NULL DEFAULT nextval('icps_id_seq'::regclass),
  team_id character varying,
  icp_name character varying NOT NULL,
  description text,
  job_titles ARRAY,
  company_characteristics text,
  pain_points ARRAY,
  value_drivers ARRAY,
  industry_focus ARRAY,
  company_size_range character varying,
  is_active boolean DEFAULT true,
  created_by character varying,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  geographic_focus ARRAY,
  budget_range character varying,
  decision_making_process text,
  objections_and_concerns ARRAY,
  success_metrics ARRAY,
  sales_cycle_length character varying,
  preferred_communication_channels ARRAY,
  technology_stack ARRAY,
  competitive_alternatives ARRAY,
  product_link_id integer,
  workflow_status USER-DEFINED DEFAULT 'form'::icp_workflow_status,
  review_status text DEFAULT 'pending'::text,
  reviewed_at timestamp with time zone,
  reviewed_by character varying,
  review_notes text,
  metadata jsonb DEFAULT '{}'::jsonb,
  generation_attempts integer DEFAULT 0,
  last_error text,
  deleted_at timestamp with time zone,
  can_restore_until timestamp with time zone,
  buying_signals ARRAY,
  key_messaging_points ARRAY,
  call_to_action text,
  market_trends text,
  competitive_landscape text,
  growth_opportunities ARRAY,
  risk_factors ARRAY,
  last_used timestamp with time zone,
  CONSTRAINT icps_pkey PRIMARY KEY (id),
  CONSTRAINT icps_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(team_id),
  CONSTRAINT icps_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(user_id),
  CONSTRAINT icps_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.users(user_id),
  CONSTRAINT icps_product_link_id_fkey FOREIGN KEY (product_link_id) REFERENCES public.knowledge_base(id)
);
CREATE TABLE public.integrations (
  id integer NOT NULL DEFAULT nextval('integrations_id_seq'::regclass),
  team_id character varying,
  integration_type character varying CHECK (integration_type::text = ANY (ARRAY['unipile'::character varying, 'salesforce'::character varying, 'hubspot'::character varying, 'pipedrive'::character varying, 'calendar'::character varying]::text[])),
  config_data jsonb,
  is_active boolean DEFAULT true,
  last_sync_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT integrations_pkey PRIMARY KEY (id),
  CONSTRAINT integrations_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(team_id)
);
CREATE TABLE public.interactive_message_tracking (
  id integer NOT NULL DEFAULT nextval('interactive_message_tracking_id_seq'::regclass),
  message_ts character varying NOT NULL,
  channel_id character varying NOT NULL,
  thread_ts character varying,
  user_id character varying NOT NULL,
  message_type character varying NOT NULL,
  message_context jsonb NOT NULL,
  expires_at timestamp without time zone NOT NULL,
  created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT interactive_message_tracking_pkey PRIMARY KEY (id)
);
CREATE TABLE public.knowledge_base (
  id integer NOT NULL DEFAULT nextval('knowledge_base_id_seq'::regclass),
  team_id character varying,
  knowledge_type character varying CHECK (knowledge_type::text = ANY (ARRAY['product'::character varying::text, 'company'::character varying::text, 'case_study'::character varying::text, 'service'::character varying::text, 'pain_point'::character varying::text, 'objection'::character varying::text])),
  title character varying NOT NULL,
  content text NOT NULL,
  metadata jsonb,
  embedding USER-DEFINED,
  created_by character varying,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  deleted_at timestamp with time zone,
  can_restore_until timestamp with time zone,
  ai_generation_count integer DEFAULT 0,
  last_ai_generation timestamp with time zone,
  workflow_status character varying DEFAULT 'active'::character varying,
  workflow_metadata jsonb,
  last_enhanced_at timestamp with time zone,
  review_status character varying,
  review_notes text,
  reviewed_by uuid,
  reviewed_at timestamp with time zone,
  summary text,
  CONSTRAINT knowledge_base_pkey PRIMARY KEY (id),
  CONSTRAINT knowledge_base_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES auth.users(id),
  CONSTRAINT knowledge_base_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(team_id),
  CONSTRAINT knowledge_base_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(user_id)
);
CREATE TABLE public.knowledge_base_ai_usage (
  id integer NOT NULL DEFAULT nextval('knowledge_base_ai_usage_id_seq'::regclass),
  user_id character varying NOT NULL,
  knowledge_base_id integer,
  generation_type character varying,
  tokens_used integer,
  cost_estimate numeric,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  CONSTRAINT knowledge_base_ai_usage_pkey PRIMARY KEY (id),
  CONSTRAINT knowledge_base_ai_usage_knowledge_base_id_fkey FOREIGN KEY (knowledge_base_id) REFERENCES public.knowledge_base(id)
);
CREATE TABLE public.knowledge_base_edits (
  id integer NOT NULL DEFAULT nextval('knowledge_base_edits_id_seq'::regclass),
  user_id character varying NOT NULL,
  knowledge_base_id integer NOT NULL,
  edit_type character varying NOT NULL CHECK (edit_type::text = ANY (ARRAY['create'::character varying, 'update'::character varying, 'delete'::character varying]::text[])),
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  CONSTRAINT knowledge_base_edits_pkey PRIMARY KEY (id),
  CONSTRAINT knowledge_base_edits_knowledge_base_id_fkey FOREIGN KEY (knowledge_base_id) REFERENCES public.knowledge_base(id)
);
CREATE TABLE public.knowledge_base_lifecycle (
  id integer NOT NULL DEFAULT nextval('knowledge_base_lifecycle_id_seq'::regclass),
  user_id character varying NOT NULL,
  entry_type character varying NOT NULL,
  action character varying NOT NULL,
  entry_data jsonb,
  knowledge_base_id integer,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  CONSTRAINT knowledge_base_lifecycle_pkey PRIMARY KEY (id)
);
CREATE TABLE public.knowledge_base_wiki (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  team_id character varying UNIQUE,
  title text NOT NULL,
  summary text,
  compiled_content text NOT NULL,
  table_of_contents jsonb,
  entry_ids ARRAY NOT NULL DEFAULT ARRAY[]::integer[],
  entry_count integer DEFAULT 0,
  last_entry_added integer,
  wiki_metadata jsonb DEFAULT '{}'::jsonb,
  ai_insights jsonb,
  status character varying DEFAULT 'building'::character varying CHECK (status::text = ANY (ARRAY['building'::character varying, 'ready'::character varying, 'updating'::character varying]::text[])),
  completeness_score integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  last_compiled_at timestamp with time zone,
  CONSTRAINT knowledge_base_wiki_pkey PRIMARY KEY (id),
  CONSTRAINT knowledge_base_wiki_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT knowledge_base_wiki_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(team_id)
);
CREATE TABLE public.landing_interest (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  created_at timestamp with time zone DEFAULT now(),
  source text DEFAULT 'coldai.uk'::text,
  ip_address text,
  user_agent text,
  referrer text,
  processed boolean DEFAULT false,
  CONSTRAINT landing_interest_pkey PRIMARY KEY (id)
);
CREATE TABLE public.message_generation_logs (
  id integer NOT NULL DEFAULT nextval('message_generation_logs_id_seq'::regclass),
  message_id character varying DEFAULT (gen_random_uuid())::text UNIQUE,
  user_id character varying,
  team_id character varying,
  linkedin_url character varying,
  prospect_name character varying,
  prospect_company character varying,
  generated_message text,
  edited_message text,
  message_status character varying DEFAULT 'generated'::character varying CHECK (message_status::text = ANY (ARRAY['generated'::character varying, 'approved'::character varying, 'sent'::character varying, 'archived'::character varying, 'failed'::character varying]::text[])),
  communication_style character varying,
  message_length character varying,
  cta_preference character varying,
  ai_model_used character varying,
  generation_cost numeric,
  sent_at timestamp with time zone,
  response_received_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT message_generation_logs_pkey PRIMARY KEY (id),
  CONSTRAINT message_generation_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id),
  CONSTRAINT message_generation_logs_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(team_id)
);
CREATE TABLE public.message_templates (
  id integer NOT NULL DEFAULT nextval('message_templates_id_seq'::regclass),
  team_id character varying,
  template_name character varying NOT NULL,
  channel character varying CHECK (channel::text = ANY (ARRAY['linkedin'::character varying, 'email'::character varying, 'call_script'::character varying]::text[])),
  template_content text NOT NULL,
  personalization_tokens jsonb,
  performance_metrics jsonb DEFAULT '{"sent": 0, "responded": 0, "meetings_booked": 0}'::jsonb,
  a_b_test_variant character varying,
  is_active boolean DEFAULT true,
  created_by character varying,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT message_templates_pkey PRIMARY KEY (id),
  CONSTRAINT message_templates_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(team_id),
  CONSTRAINT message_templates_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(user_id)
);
CREATE TABLE public.product_links (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  team_id text,
  name text NOT NULL,
  url text NOT NULL,
  status text DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'researching'::text, 'completed'::text, 'error'::text])),
  research_data jsonb,
  last_researched timestamp with time zone,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT product_links_pkey PRIMARY KEY (id)
);
CREATE TABLE public.product_profiles (
  id integer NOT NULL DEFAULT nextval('product_profiles_id_seq'::regclass),
  user_id character varying UNIQUE,
  products jsonb DEFAULT '[]'::jsonb,
  features ARRAY,
  benefits ARRAY,
  use_cases ARRAY,
  integrations ARRAY,
  pricing_tiers jsonb,
  demo_link character varying,
  documentation_link character varying,
  case_study_links ARRAY,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT product_profiles_pkey PRIMARY KEY (id),
  CONSTRAINT product_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id)
);
CREATE TABLE public.product_research_queue (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  product_link_id uuid NOT NULL,
  status text DEFAULT 'queued'::text CHECK (status = ANY (ARRAY['queued'::text, 'processing'::text, 'completed'::text, 'failed'::text])),
  webhook_response jsonb,
  attempts integer DEFAULT 0,
  error_message text,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  processed_at timestamp with time zone,
  CONSTRAINT product_research_queue_pkey PRIMARY KEY (id),
  CONSTRAINT product_research_queue_product_link_id_fkey FOREIGN KEY (product_link_id) REFERENCES public.product_links(id)
);
CREATE TABLE public.research_cache (
  id integer NOT NULL DEFAULT nextval('research_cache_id_seq'::regclass),
  profile_url character varying UNIQUE,
  profile_type character varying CHECK (profile_type::text = ANY (ARRAY['personal'::character varying, 'company'::character varying]::text[])),
  research_data jsonb,
  research_depth character varying CHECK (research_depth::text = ANY (ARRAY['basic'::character varying, 'standard'::character varying, 'deep'::character varying]::text[])),
  last_researched_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  research_version integer DEFAULT 1,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT research_cache_pkey PRIMARY KEY (id)
);
CREATE TABLE public.subscriptions (
  subscription_id character varying NOT NULL,
  squarespace_subscription_id character varying UNIQUE,
  billing_email character varying NOT NULL UNIQUE,
  plan_type character varying NOT NULL CHECK (plan_type::text = ANY (ARRAY['free'::character varying, 'basic'::character varying, 'standard'::character varying, 'pro'::character varying, 'team_basic'::character varying, 'team_xl'::character varying]::text[])),
  status character varying DEFAULT 'active'::character varying CHECK (status::text = ANY (ARRAY['active'::character varying, 'trialing'::character varying, 'past_due'::character varying, 'cancelled'::character varying, 'expired'::character varying]::text[])),
  billing_cycle_start date,
  billing_cycle_end date,
  max_teams_allowed integer DEFAULT 1,
  teams_created integer DEFAULT 0,
  stripe_customer_id character varying,
  stripe_subscription_id character varying,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  user_id character varying,
  CONSTRAINT subscriptions_pkey PRIMARY KEY (subscription_id),
  CONSTRAINT subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id)
);
CREATE TABLE public.sync_status (
  sync_type character varying NOT NULL,
  last_check_timestamp timestamp with time zone,
  last_order_id character varying,
  orders_processed integer DEFAULT 0,
  last_error text,
  updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT sync_status_pkey PRIMARY KEY (sync_type)
);
CREATE TABLE public.team_memberships (
  id integer NOT NULL DEFAULT nextval('team_memberships_id_seq'::regclass),
  team_id character varying,
  user_id character varying,
  role character varying DEFAULT 'member'::character varying CHECK (role::text = ANY (ARRAY['manager'::character varying, 'member'::character varying]::text[])),
  can_manage_icps boolean DEFAULT false,
  can_manage_company_profile boolean DEFAULT false,
  can_view_team_stats boolean DEFAULT true,
  can_invite_members boolean DEFAULT false,
  status character varying DEFAULT 'active'::character varying CHECK (status::text = ANY (ARRAY['active'::character varying, 'inactive'::character varying, 'invited'::character varying]::text[])),
  invited_by character varying,
  joined_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  can_manage_knowledge_base boolean DEFAULT false,
  CONSTRAINT team_memberships_pkey PRIMARY KEY (id),
  CONSTRAINT team_memberships_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(team_id),
  CONSTRAINT team_memberships_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id),
  CONSTRAINT team_memberships_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES public.users(user_id)
);
CREATE TABLE public.teams (
  team_id character varying NOT NULL DEFAULT (gen_random_uuid())::text,
  team_name character varying NOT NULL,
  subscription_id character varying,
  product_focus character varying,
  monthly_message_limit integer NOT NULL,
  monthly_messages_used integer DEFAULT 0,
  reset_date date DEFAULT CURRENT_DATE,
  status character varying DEFAULT 'active'::character varying CHECK (status::text = ANY (ARRAY['active'::character varying, 'inactive'::character varying, 'suspended'::character varying]::text[])),
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT teams_pkey PRIMARY KEY (team_id),
  CONSTRAINT teams_subscription_id_fkey FOREIGN KEY (subscription_id) REFERENCES public.subscriptions(subscription_id)
);
CREATE TABLE public.usage_tracking (
  id integer NOT NULL DEFAULT nextval('usage_tracking_id_seq'::regclass),
  user_id character varying,
  team_id character varying,
  usage_date date DEFAULT CURRENT_DATE,
  messages_generated integer DEFAULT 0,
  messages_sent integer DEFAULT 0,
  messages_archived integer DEFAULT 0,
  research_performed integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT usage_tracking_pkey PRIMARY KEY (id),
  CONSTRAINT usage_tracking_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id),
  CONSTRAINT usage_tracking_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(team_id)
);
CREATE TABLE public.user_profiles (
  id integer NOT NULL DEFAULT nextval('user_profiles_id_seq'::regclass),
  user_id character varying UNIQUE,
  linkedin_url character varying,
  linkedin_connected boolean DEFAULT false,
  unipile_account_id character varying,
  user_role character varying,
  territory character varying,
  personal_bio text,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  job_title character varying,
  phone_number character varying,
  linkedin_profile_data jsonb,
  linkedin_profile_updated_at timestamp with time zone,
  linkedin_profile_scraped_at timestamp with time zone,
  linkedin_profile_hash character varying,
  CONSTRAINT user_profiles_pkey PRIMARY KEY (id),
  CONSTRAINT user_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id)
);
CREATE TABLE public.user_sessions (
  id integer NOT NULL DEFAULT nextval('user_sessions_id_seq'::regclass),
  user_id character varying,
  session_token character varying DEFAULT (gen_random_uuid())::text UNIQUE,
  slack_channel_id character varying,
  slack_thread_ts character varying,
  slack_user_id character varying,
  auth_message_ts character varying,
  auth_status character varying DEFAULT 'pending'::character varying,
  auth_initiated_at timestamp with time zone,
  awaiting_callback boolean DEFAULT false,
  session_active boolean DEFAULT true,
  expires_at timestamp with time zone DEFAULT (CURRENT_TIMESTAMP + '01:00:00'::interval),
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  channel_type character varying DEFAULT 'channel'::character varying,
  is_dm boolean DEFAULT false,
  CONSTRAINT user_sessions_pkey PRIMARY KEY (id),
  CONSTRAINT user_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id)
);
CREATE TABLE public.users (
  user_id character varying NOT NULL,
  email character varying UNIQUE,
  first_name character varying,
  last_name character varying,
  slack_team_id character varying,
  status character varying DEFAULT 'active'::character varying CHECK (status::text = ANY (ARRAY['active'::character varying, 'inactive'::character varying, 'suspended'::character varying]::text[])),
  onboarding_completed boolean DEFAULT false,
  onboarding_step integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  onboarding_completed_at timestamp without time zone,
  onboarding_urls_collected boolean DEFAULT false,
  profile_analyzed boolean DEFAULT false,
  analysis_completed_at timestamp without time zone,
  ready_for_outreach boolean DEFAULT false,
  profile_completion jsonb DEFAULT '{"company": false, "product": false, "personal": false, "percentage": 0, "communication": false}'::jsonb,
  email_verified boolean DEFAULT false,
  CONSTRAINT users_pkey PRIMARY KEY (user_id)
);
CREATE TABLE public.webhook_events (
  id integer NOT NULL DEFAULT nextval('webhook_events_id_seq'::regclass),
  user_id text,
  event_type text,
  source text DEFAULT 'other'::text CHECK (source = ANY (ARRAY['knowledge_base'::text, 'icp'::text, 'message'::text, 'other'::text])),
  status text DEFAULT 'processing'::text,
  payload jsonb,
  result jsonb,
  error_message text,
  processed boolean DEFAULT false,
  retry_count integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  completed_at timestamp with time zone,
  updated_at timestamp with time zone,
  idempotency_key text,
  CONSTRAINT webhook_events_pkey PRIMARY KEY (id),
  CONSTRAINT webhook_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id)
);