# LinkedIn Duplicate Detection - Simplified Deployment Guide

## Overview
This guide covers deploying the **simplified** LinkedIn duplicate detection system that uses **existing tables with added columns** instead of creating 3 new tables.

## Architecture Changes

### Before (Original Approach - NOT USED)
- Created 3 new tables: `linkedin_profile_registry`, `linkedin_connection_history`, `linkedin_profile_usage`
- Required managing relationships between multiple tables

### After (Simplified Approach - CURRENT)
- Uses existing tables: `user_profiles`, `webhook_events`, `auth_login_attempts`, `knowledge_base_ai_usage`
- Adds columns to existing tables
- Uses unique index on `user_profiles.linkedin_public_identifier` as core protection

## How It Works

### Duplicate Detection Flow
1. User connects LinkedIn via Unipile
2. Webhook extracts `linkedin_public_identifier` from profile URL (e.g., "john-doe" from linkedin.com/in/john-doe)
3. Checks if this identifier is already connected (`linkedin_connected = true`) to a different `user_id`
4. If duplicate detected:
   - Logs rejection to `webhook_events` table
   - Deletes the new Unipile account
   - Returns error to user: "This LinkedIn account is already registered to another email"
5. If not duplicate:
   - Updates `user_profiles` with LinkedIn data (including organizations)
   - Logs successful connection to `webhook_events`

### Key Protection Mechanism
The **unique partial index** on `user_profiles.linkedin_public_identifier` prevents the same LinkedIn profile from being connected to multiple users:

```sql
CREATE UNIQUE INDEX idx_linkedin_public_identifier_active
  ON public.user_profiles(linkedin_public_identifier)
  WHERE linkedin_connected = true AND linkedin_public_identifier IS NOT NULL;
```

This index only applies when `linkedin_connected = true`, allowing users to reconnect after disconnecting.

## Deployment Steps

### 1. Run Database Migration

Navigate to Supabase Dashboard → SQL Editor and run:

```
/supabase/migrations/20250111_linkedin_deduplication_simplified.sql
```

This will:
- Add 6 new columns to `user_profiles` table
- Add 3 new columns to `auth_login_attempts` table
- Add 3 new columns to `webhook_events` table
- Add 1 new column to `knowledge_base_ai_usage` table
- Create unique index for duplicate detection
- Create helper functions for extracting LinkedIn ID and normalizing Gmail
- Create 2 views for monitoring (`linkedin_connection_audit`, `potential_duplicate_signups`)

**Columns Added:**

**user_profiles:**
- `linkedin_public_identifier` - Unique LinkedIn URL slug (e.g., "john-doe")
- `linkedin_first_connected_at` - First connection timestamp
- `linkedin_connection_count` - Number of times connected/reconnected
- `linkedin_last_disconnected_at` - Last disconnection timestamp
- `linkedin_profile_snapshot` - Latest Unipile profile data (JSONB)
- `linkedin_organizations` - Organizations from Unipile data (JSONB array)

**webhook_events:**
- `linkedin_event_type` - Type: connected, disconnected, duplicate_rejected, error
- `connection_status` - Status: active, disconnected, duplicate_rejected, failed
- `rejection_reason` - Reason if connection was blocked

**auth_login_attempts:**
- `is_signup` - True for signup attempts
- `email_base` - Normalized email (Gmail alias detection)
- `is_gmail_alias` - True if email is a Gmail alias

**knowledge_base_ai_usage:**
- `linkedin_public_identifier` - For cross-user usage tracking

### 2. Deploy Edge Functions

Deploy 3 edge functions:

```bash
# 1. Deploy updated unipile-webhook (duplicate detection)
supabase functions deploy unipile-webhook

# 2. Deploy server-knowledge-action (LinkedIn validation for Product)
supabase functions deploy server-knowledge-action

# 3. Deploy server-icp-action (LinkedIn validation for ICP)
supabase functions deploy server-icp-action
```

### 3. Verify Deployment

Check that all 3 functions are live:

```bash
supabase functions list
```

Expected output:
```
┌─────────────────────────────┬─────────┬──────────────┐
│ NAME                        │ STATUS  │ UPDATED AT   │
├─────────────────────────────┼─────────┼──────────────┤
│ unipile-webhook            │ ACTIVE  │ just now     │
│ server-knowledge-action    │ ACTIVE  │ just now     │
│ server-icp-action          │ ACTIVE  │ just now     │
└─────────────────────────────┴─────────┴──────────────┘
```

## What Each File Does

### Database Migration
**File:** `/supabase/migrations/20250111_linkedin_deduplication_simplified.sql`

- Extends existing tables with new columns
- Creates unique index to prevent duplicate LinkedIn connections
- Adds helper functions for LinkedIn ID extraction and Gmail alias detection
- Creates monitoring views for audit trail

### Webhook Handler
**File:** `/supabase/functions/unipile-webhook/index.ts`

- Detects duplicate LinkedIn connections in real-time
- Deletes duplicate Unipile accounts automatically
- Logs all connection attempts to `webhook_events` table
- Stores organizations data from Unipile profiles

### Product Validation
**File:** `/supabase/functions/server-knowledge-action/index.ts`

- Backend validation before Product/Service AI operations
- Returns 403 error if LinkedIn not connected
- Prevents AI cost abuse

### ICP Validation
**File:** `/supabase/functions/server-icp-action/index.ts`

- Backend validation before ICP AI operations
- Returns 403 error if LinkedIn not connected
- Prevents AI cost abuse

## Testing the Flow

### Test Case 1: Normal First-Time User
1. New user signs up with email: `user1@example.com`
2. User connects LinkedIn: `linkedin.com/in/john-doe`
3. ✅ **Expected:** Connection succeeds
4. Check `user_profiles` table:
   - `linkedin_connected = true`
   - `linkedin_public_identifier = 'john-doe'`
   - `linkedin_first_connected_at` is set
   - `linkedin_connection_count = 1`
   - `linkedin_organizations` contains organizations data
5. Check `webhook_events` table:
   - New row with `linkedin_event_type = 'connected'`
   - `connection_status = 'active'`

### Test Case 2: Duplicate LinkedIn Detection
1. New user signs up with email: `user2@example.com` (different from user1)
2. User tries to connect LinkedIn: `linkedin.com/in/john-doe` (SAME as user1)
3. ✅ **Expected:** Connection fails with error message
4. Check `webhook_events` table:
   - New row with `linkedin_event_type = 'duplicate_rejected'`
   - `connection_status = 'duplicate_rejected'`
   - `rejection_reason` is set
5. Check Unipile dashboard:
   - New account should be automatically deleted

### Test Case 3: Backend Protection (403 Errors)
1. User who has NOT connected LinkedIn tries to create Product
2. Frontend should show lock overlay
3. If user bypasses frontend (via API call), backend should return 403
4. ✅ **Expected:** `server-knowledge-action` returns:
   ```json
   {
     "success": false,
     "error": "LinkedIn connection required",
     "requiresLinkedIn": true
   }
   ```

### Test Case 4: User Reconnection (Legitimate)
1. User1 disconnects LinkedIn
2. Check `user_profiles`:
   - `linkedin_connected = false` (releases unique constraint)
   - `linkedin_last_disconnected_at` is set
3. User1 reconnects same LinkedIn
4. ✅ **Expected:** Connection succeeds
5. Check `user_profiles`:
   - `linkedin_connected = true`
   - `linkedin_connection_count` incremented
6. Check `webhook_events`:
   - New row with `linkedin_event_type = 'reconnected'`

### Test Case 5: Different LinkedIn Accounts (Legitimate)
1. User1 has connected `linkedin.com/in/john-doe-personal`
2. User1 disconnects and connects `linkedin.com/in/john-doe-business`
3. ✅ **Expected:** Both connections work fine
4. Different `linkedin_public_identifier` values = different profiles

## Monitoring & Debugging

### View LinkedIn Connection Audit Trail
```sql
SELECT * FROM linkedin_connection_audit
ORDER BY created_at DESC
LIMIT 50;
```

Shows all LinkedIn connection events with user email and status.

### View Potential Duplicate Signups
```sql
SELECT * FROM potential_duplicate_signups
ORDER BY signup2_time DESC;
```

Shows users who signed up from same IP with Gmail aliases.

### Check Active LinkedIn Connections
```sql
SELECT
  user_id,
  linkedin_public_identifier,
  linkedin_url,
  linkedin_connected,
  linkedin_connection_count,
  linkedin_first_connected_at,
  array_length(linkedin_organizations::json::text[]::text[], 1) as org_count
FROM user_profiles
WHERE linkedin_connected = true
ORDER BY linkedin_first_connected_at DESC;
```

### Check Duplicate Detection Rejections
```sql
SELECT
  user_id,
  created_at,
  linkedin_event_type,
  connection_status,
  rejection_reason,
  payload->>'account_id' as attempted_account_id,
  payload->'profile'->>'profile_url' as attempted_linkedin_url
FROM webhook_events
WHERE linkedin_event_type = 'duplicate_rejected'
ORDER BY created_at DESC;
```

### Check Organizations Data
```sql
SELECT
  user_id,
  linkedin_public_identifier,
  linkedin_organizations
FROM user_profiles
WHERE linkedin_organizations::text != '[]'::text
  AND linkedin_connected = true;
```

Shows which users have organizations data from LinkedIn.

## Key Benefits of Simplified Approach

### ✅ Advantages
1. **No new tables** - Uses existing schema
2. **Simpler to maintain** - Fewer moving parts
3. **Same protection level** - Unique index prevents duplicates
4. **Organizations tracking** - Stores Unipile organizations data
5. **Full audit trail** - Uses existing `webhook_events` table
6. **Gmail alias detection** - Extended `auth_login_attempts` for pattern detection

### ⚠️ Limitations
1. No dedicated history table (uses `webhook_events` which has mixed event types)
2. No cross-user usage tracking at LinkedIn level (though column exists in `knowledge_base_ai_usage`)

## Rollback Plan

If you need to rollback:

```sql
-- Remove columns from user_profiles
ALTER TABLE public.user_profiles
  DROP COLUMN IF EXISTS linkedin_public_identifier,
  DROP COLUMN IF EXISTS linkedin_first_connected_at,
  DROP COLUMN IF EXISTS linkedin_connection_count,
  DROP COLUMN IF EXISTS linkedin_last_disconnected_at,
  DROP COLUMN IF EXISTS linkedin_profile_snapshot,
  DROP COLUMN IF EXISTS linkedin_organizations;

-- Remove unique index
DROP INDEX IF EXISTS idx_linkedin_public_identifier_active;

-- Remove columns from other tables
ALTER TABLE public.auth_login_attempts
  DROP COLUMN IF EXISTS is_signup,
  DROP COLUMN IF EXISTS email_base,
  DROP COLUMN IF EXISTS is_gmail_alias;

ALTER TABLE public.webhook_events
  DROP COLUMN IF EXISTS linkedin_event_type,
  DROP COLUMN IF EXISTS connection_status,
  DROP COLUMN IF EXISTS rejection_reason;

ALTER TABLE public.knowledge_base_ai_usage
  DROP COLUMN IF EXISTS linkedin_public_identifier;

-- Remove views and functions
DROP VIEW IF EXISTS linkedin_connection_audit;
DROP VIEW IF EXISTS potential_duplicate_signups;
DROP FUNCTION IF EXISTS extract_linkedin_identifier;
DROP FUNCTION IF EXISTS normalize_gmail_email;
```

Then redeploy old versions of edge functions.

## Security Considerations

1. **Unique Index Protection** - Database-level constraint prevents duplicates even if edge function fails
2. **Backend Validation** - Server-side checks prevent AI cost abuse even if frontend is bypassed
3. **Audit Trail** - All connection attempts logged to `webhook_events` for monitoring
4. **Organizations Data** - Helps identify company affiliations for additional security context
5. **Gmail Alias Detection** - Tracks signup patterns to detect abuse attempts

## Next Steps

After deployment:

1. ✅ Test all 5 test cases above
2. ✅ Monitor `linkedin_connection_audit` view for first few days
3. ✅ Check for any duplicate rejection attempts
4. ⚠️ Consider adding "Switch Account" button to LinkedIn widget modal (future enhancement)
5. ⚠️ Evaluate if organizations data should trigger additional validation (future enhancement)

## Questions?

If you encounter issues:

1. Check Supabase logs for edge functions
2. Query `webhook_events` table for failed events
3. Verify unique index exists: `\d user_profiles` in SQL editor
4. Check frontend console for errors
