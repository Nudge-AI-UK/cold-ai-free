# n8n Hard Deletion Workflow

## Overview
This workflow runs daily to permanently delete accounts that have been in `pending_deletion` status for 30+ days.

## Workflow Configuration

**Name:** Account Hard Deletion Cleanup
**Schedule:** Daily at 2:00 AM UTC
**Trigger Type:** Cron/Schedule

---

## Node Structure

```
1. Schedule Trigger (Cron)
   ↓
2. Supabase: Get Pending Hard Deletions
   ↓
3. IF: Check if any deletions pending
   ↓ TRUE
4. Loop Over Items
   ↓
5. Supabase: Execute Hard Delete
   ↓
6. Supabase: Mark as Hard Deleted
   ↓
7. (Optional) Notification/Logging
```

---

## Node Configurations

### Node 1: Schedule Trigger
- **Type:** Schedule Trigger
- **Mode:** Every Day
- **Hour:** 2
- **Minute:** 0
- **Timezone:** UTC

---

### Node 2: Supabase - Get Pending Hard Deletions
- **Type:** Supabase
- **Operation:** Execute SQL Query
- **Query:**

```sql
SELECT * FROM get_pending_hard_deletions();
```

**Returns:**
- `deleted_account_id` - UUID of the tracking record
- `email_hash` - Hashed email (for reference)
- `original_user_id` - User ID to delete (as TEXT)
- `deleted_at` - When deletion was requested
- `soft_delete_until` - Grace period end date
- `user_email` - Email address (for logging)

---

### Node 3: IF - Check Results
- **Type:** IF
- **Condition Type:** Number
- **Value 1:** `{{ $json["query_result"].length }}`
- **Operation:** Larger Than
- **Value 2:** `0`

**Branches:**
- **TRUE:** Continue to deletion
- **FALSE:** End workflow (nothing to delete)

---

### Node 4: Split In Batches / Loop
- **Type:** Split In Batches (or Code node with loop)
- **Batch Size:** 1
- **Input:** `{{ $json["query_result"] }}`

This processes each pending deletion one at a time.

---

### Node 5: Supabase - Execute Hard Delete
- **Type:** Supabase
- **Operation:** Execute SQL Query
- **Query:**

```sql
-- Hard delete user account
DO $$
DECLARE
  target_user_id TEXT := '{{ $json.original_user_id }}';
  target_user_id_uuid UUID := '{{ $json.original_user_id }}'::uuid;
BEGIN
  RAISE NOTICE 'Starting hard deletion for user: %', target_user_id;

  -- Delete from public schema tables (in order of dependencies)

  -- Message and outreach related
  DELETE FROM public.sequence_messages WHERE user_id = target_user_id;
  DELETE FROM public.sequence_prospects WHERE user_id = target_user_id;
  DELETE FROM public.connection_requests WHERE user_id = target_user_id;
  DELETE FROM public.message_generation_logs WHERE user_id = target_user_id;
  DELETE FROM public.outreach_sequences WHERE user_id = target_user_id;

  -- Research and profiles
  DELETE FROM public.research_cache WHERE user_id = target_user_id;
  DELETE FROM public.user_prospect_relationships WHERE user_id = target_user_id_uuid;

  -- ICP and Knowledge Base
  DELETE FROM public.icps WHERE created_by = target_user_id;
  DELETE FROM public.knowledge_base_ai_usage WHERE user_id = target_user_id;
  DELETE FROM public.knowledge_base_edits WHERE user_id = target_user_id;
  DELETE FROM public.knowledge_base_lifecycle WHERE user_id = target_user_id;
  DELETE FROM public.knowledge_base WHERE created_by = target_user_id;
  DELETE FROM public.knowledge_base_wiki WHERE user_id = target_user_id_uuid;

  -- User profiles and settings
  DELETE FROM public.communication_preferences WHERE user_id = target_user_id;
  DELETE FROM public.business_profiles WHERE user_id = target_user_id;
  DELETE FROM public.user_profiles WHERE user_id = target_user_id;
  DELETE FROM public.product_profiles WHERE user_id = target_user_id;

  -- Quotas and tracking
  DELETE FROM public.message_quotas WHERE user_id = target_user_id;
  DELETE FROM public.quota_violations WHERE user_id = target_user_id;
  DELETE FROM public.usage_tracking WHERE user_id = target_user_id;
  DELETE FROM public.usage WHERE user_id = target_user_id;

  -- LinkedIn and integrations
  DELETE FROM public.linkedin_accounts WHERE user_id = target_user_id;

  -- Team memberships (if any)
  DELETE FROM public.team_memberships WHERE user_id = target_user_id;

  -- Sessions and auth
  DELETE FROM public.user_sessions WHERE user_id = target_user_id;
  DELETE FROM public.auth_login_attempts WHERE user_id = target_user_id;
  DELETE FROM public.auth_account_lockouts WHERE user_id = target_user_id;

  -- Agent conversations
  DELETE FROM public.agent_messages
  WHERE conversation_id IN (
    SELECT id FROM public.agent_conversations WHERE user_id = target_user_id
  );

  DELETE FROM public.agent_executions
  WHERE conversation_id IN (
    SELECT id FROM public.agent_conversations WHERE user_id = target_user_id
  );

  DELETE FROM public.agent_conversations WHERE user_id = target_user_id;

  -- Webhook events
  DELETE FROM public.webhook_events WHERE user_id = target_user_id;

  -- Subscriptions (if any)
  DELETE FROM public.subscriptions WHERE user_id = target_user_id;

  -- Delete from auth.users (cascades to auth.identities, auth.sessions, etc.)
  DELETE FROM auth.users WHERE id = target_user_id_uuid;

  RAISE NOTICE 'Hard deletion complete for user: %', target_user_id;
END $$;

SELECT
  '{{ $json.original_user_id }}' as deleted_user_id,
  '{{ $json.user_email }}' as deleted_email,
  NOW() as deleted_at,
  'success' as status;
```

**Output:** Confirmation with user details

---

### Node 6: Supabase - Mark as Hard Deleted
- **Type:** Supabase
- **Operation:** Execute SQL Query
- **Query:**

```sql
SELECT mark_account_hard_deleted('{{ $json.deleted_account_id }}'::uuid);
```

This updates the `deleted_accounts` tracking record to mark it as permanently deleted.

---

### Node 7: (Optional) Notification
- **Type:** HTTP Request / Slack / Email
- **Purpose:** Log completion

**Example Slack message:**
```
✅ Account Hard Deletion Complete

Processed: {{ $('Split In Batches').itemMatches.length }} account(s)
Date: {{ $now }}

Details:
{{ $json.deleted_email }} - User ID: {{ $json.deleted_user_id }}
```

---

## Error Handling

### Add Error Workflow Path

**On Node 5 (Hard Delete) Error:**
1. Catch error
2. Log to Supabase error table (optional)
3. Send alert notification
4. **Do NOT mark as hard deleted** if deletion failed

**Error notification example:**
```
❌ Hard Deletion Failed

User: {{ $json.user_email }}
User ID: {{ $json.original_user_id }}
Error: {{ $json.error }}
Time: {{ $now }}

Action Required: Manual investigation
```

---

## Testing the Workflow

### Test Query
Run this in Supabase SQL editor to see pending deletions:

```sql
SELECT * FROM get_pending_hard_deletions();
```

### Create Test Deletion (for testing only)
```sql
-- Create a test pending deletion
INSERT INTO deleted_accounts (
  email_hash,
  original_user_id,
  deleted_at,
  soft_delete_until,
  messages_sent_total
) VALUES (
  'test_hash_123',
  'some-test-user-uuid',
  NOW() - INTERVAL '31 days',  -- 31 days ago
  NOW() - INTERVAL '1 day',     -- Grace period expired yesterday
  10
);
```

### Manual Trigger
1. In n8n, open the workflow
2. Click "Execute Workflow" button
3. Check execution log for success/errors
4. Verify in Supabase:

```sql
-- Check if marked as hard deleted
SELECT * FROM deleted_accounts WHERE hard_deleted = true;

-- Verify user data deleted
SELECT * FROM auth.users WHERE email = 'test@example.com';
```

---

## Monitoring & Logging

### Recommended Logging
Add a logging node that inserts to a custom table:

```sql
CREATE TABLE account_deletion_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_email TEXT,
  user_id TEXT,
  deleted_at TIMESTAMPTZ DEFAULT NOW(),
  workflow_run_id TEXT,
  status TEXT,
  error_message TEXT
);
```

Insert after each deletion:
```sql
INSERT INTO account_deletion_log (
  user_email,
  user_id,
  workflow_run_id,
  status
) VALUES (
  '{{ $json.user_email }}',
  '{{ $json.original_user_id }}',
  '{{ $execution.id }}',
  'success'
);
```

---

## Summary

**Flow:**
1. User clicks "Delete Account" → Edge function marks as `pending_deletion`
2. 30 days pass
3. n8n cron runs daily at 2 AM
4. Finds accounts past grace period
5. Executes comprehensive hard delete
6. Marks tracking record as complete
7. Sends notification

**Recovery Window:**
- Within 30 days: User can sign in → Account recovered automatically
- After 30 days: Account permanently deleted by n8n
- No recovery possible after hard deletion

**Security:**
- All user data completely removed
- Auth account deleted (can't sign in)
- Tracking record preserved for audit (email hash only)
