# n8n Workflow Integration Plan
## Quota Tracking System Implementation

This document outlines the step-by-step integration of the new quota tracking system into existing n8n workflows.

---

## Prerequisites

### ✅ Step 0: Run Database Migration

**Action Required:** Run the migration file to create all quota tracking tables and functions.

```bash
# Connect to your Supabase project
cd supabase
supabase db push

# Or run the migration directly:
psql -h YOUR_SUPABASE_HOST -U postgres -d postgres -f migrations/20250120_create_outreach_sequences.sql
```

**What This Creates:**
- `linkedin_accounts` - Account config and InMail credits
- `message_quotas` - Real-time quota tracking
- `connection_requests` - Connection request management
- `quota_violations` - Violation logging
- `outreach_sequences` - Campaign tables
- Functions: `check_message_quota()`, `increment_message_quota()`, reset functions

---

## Integration Tasks

### 📝 Task 1: Update Unipile Account Status Callback

**File/Workflow:** `Unipile Account Status Callback`

**Current Behavior:**
- Receives profile data from Unipile
- Saves to `research_cache` table
- Updates `user_profiles.linkedin_profile_data`

**Required Changes:**

#### 1.1 Add New Postgres Node: "Initialize LinkedIn Account"

**Position:** After saving profile data, before response
**Operation:** Execute Query
**Query:**

```sql
-- Create or update linkedin_accounts record
INSERT INTO linkedin_accounts (
  user_id,
  account_type,
  inmail_credits_remaining,
  inmail_credits_max,
  account_status,
  created_at,
  updated_at
)
VALUES (
  '{{$json["user_id"]}}',
  -- Detect account type from profile metadata
  CASE
    WHEN '{{$json["account_data"]["premium"]}}' = 'true' THEN 'premium'
    ELSE 'free'
  END,
  0,  -- Will be synced by InMail credit workflow
  0,
  'active',
  NOW(),
  NOW()
)
ON CONFLICT (user_id)
DO UPDATE SET
  account_type = CASE
    WHEN '{{$json["account_data"]["premium"]}}' = 'true' THEN 'premium'
    ELSE 'free'
  END,
  updated_at = NOW();
```

#### 1.2 Add New Postgres Node: "Initialize Message Quotas"

**Position:** After "Initialize LinkedIn Account"
**Operation:** Execute Query
**Query:**

```sql
-- Create message_quotas record (if not exists from user creation trigger)
INSERT INTO message_quotas (
  user_id,
  created_at,
  updated_at
)
VALUES (
  '{{$json["user_id"]}}',
  NOW(),
  NOW()
)
ON CONFLICT (user_id) DO NOTHING;
```

#### 1.3 Update user_profiles.linkedin_premium

**Query:**
```sql
UPDATE user_profiles
SET
  linkedin_premium = {{$json["account_data"]["premium"]}},
  linkedin_profile_updated_at = NOW()
WHERE user_id = '{{$json["user_id"]}}';
```

---

### 📝 Task 2: Replace Current Limit Checking Flow

**File/Workflow:** `Limit Checking Flow` (or similar name)

**Current Implementation:**
```sql
-- Old query - checking basic usage_tracking
SELECT
  messages_sent,
  connection_requests_sent
FROM usage_tracking
WHERE user_id = $1
  AND usage_date = CURRENT_DATE;
```

**New Implementation:**

#### 2.1 Replace with Single Postgres Node: "Check Message Quota"

**Operation:** Execute Query
**Query:**

```sql
SELECT
  can_send,
  reason,
  wait_until
FROM check_message_quota(
  p_user_id := '{{$json["user_id"]}}',
  p_message_type := '{{$json["message_type"]}}',  -- 'connection_request', 'direct_message', 'inmail', 'open_profile'
  p_is_personalised := {{$json["is_personalised"]}}
);
```

#### 2.2 Update IF Node: "Can Send?"

**Condition:** `{{$json["can_send"]}}` equals `true`

**If TRUE:** → Proceed to Message Router
**If FALSE:** → Return Error Response

#### 2.3 Add Error Response Node (for FALSE branch)

**Node Type:** Respond to Webhook (or return to previous workflow)
**Response Body:**

```json
{
  "success": false,
  "error": "quota_exceeded",
  "message": "{{$json["reason"]}}",
  "wait_until": "{{$json["wait_until"]}}",
  "retry_after_seconds": {{Math.floor((new Date($json["wait_until"]) - new Date()) / 1000)}}
}
```

---

### 📝 Task 3: Update Message Router

**File/Workflow:** `Message Router` (routes based on connection type)

**Current Behavior:**
- Checks Unipile connection status
- Routes to appropriate send node (connection request, DM, InMail, open profile)

**Required Changes:**

#### 3.1 Add Postgres Node BEFORE Router: "Get Current Quotas"

**Operation:** Execute Query
**Query:**

```sql
SELECT
  la.account_type,
  la.inmail_credits_remaining,
  mq.daily_direct_messages,
  mq.daily_connection_requests,
  mq.daily_inmails,
  mq.daily_open_profile,
  mq.pending_connections,
  mq.last_action_at,

  -- Calculate available capacity
  CASE
    WHEN la.account_type = 'free' THEN 100 - mq.daily_direct_messages
    ELSE 150 - mq.daily_direct_messages
  END AS dm_capacity_remaining,

  20 - mq.daily_connection_requests AS connection_capacity_remaining,

  la.inmail_credits_remaining AS inmail_capacity_remaining

FROM linkedin_accounts la
JOIN message_quotas mq ON mq.user_id = la.user_id
WHERE la.user_id = '{{$json["user_id"]}}';
```

#### 3.2 Update Router Logic

Add these additional conditions to your router:

**For Connection Request Route:**
- Existing: Connection status = 'not_connected'
- **NEW:** AND `{{$json["connection_capacity_remaining"]}}` > 0
- **NEW:** AND `{{$json["pending_connections"]}}` < 400

**For InMail Route:**
- Existing: Connection status = 'not_connected' or 'inmail_preferred'
- **NEW:** AND `{{$json["inmail_capacity_remaining"]}}` > 0
- **NEW:** AND account_type != 'free'

**For Direct Message Route:**
- Existing: Connection status = 'connected'
- **NEW:** AND `{{$json["dm_capacity_remaining"]}}` > 0

**For Open Profile Route:**
- Existing: Open profile feature enabled
- **NEW:** AND `{{$json["daily_open_profile"]}}` < daily limit

---

### 📝 Task 4: Add Post-Send Quota Updates

**File/Workflow:** All message sending workflows (after Unipile success)

**Current Behavior:**
- Unipile sends message
- Success response received
- Workflow ends

**Required Changes:**

#### 4.1 Add Postgres Node: "Increment Quota" (After Unipile Success)

**Position:** After successful Unipile response, before final response
**Operation:** Execute Query
**Query:**

```sql
SELECT increment_message_quota(
  p_user_id := '{{$json["user_id"]}}',
  p_message_type := '{{$json["message_type"]}}',
  p_is_personalised := {{$json["is_personalised"]}}
);
```

#### 4.2 Update message_generation_logs Record

**Operation:** Execute Query
**Query:**

```sql
UPDATE message_generation_logs
SET
  message_status = 'sent',
  message_type = '{{$json["message_type"]}}',
  recipient_linkedin_id = '{{$json["unipile_response"]["recipient_id"]}}',
  recipient_name = '{{$json["unipile_response"]["recipient_name"]}}',
  unipile_message_id = '{{$json["unipile_response"]["message_id"]}}',
  unipile_thread_id = '{{$json["unipile_response"]["thread_id"]}}',
  is_personalised = {{$json["is_personalised"]}},
  message_length = LENGTH('{{$json["message_body"]}}'),
  sent_at = NOW(),
  updated_at = NOW()
WHERE message_id = '{{$json["message_id"]}}';
```

#### 4.3 For Connection Requests ONLY: Track in connection_requests

**Operation:** Execute Query
**Condition:** Only run if `message_type` = 'connection_request'
**Query:**

```sql
INSERT INTO connection_requests (
  user_id,
  recipient_linkedin_id,
  message_text,
  message_length,
  is_personalised,
  status,
  sent_at,
  withdrawal_scheduled_for
)
VALUES (
  '{{$json["user_id"]}}',
  '{{$json["unipile_response"]["recipient_id"]}}',
  '{{$json["message_body"]}}',
  LENGTH('{{$json["message_body"]}}'),
  {{$json["is_personalised"]}},
  'pending',
  NOW(),
  NOW() + INTERVAL '14 days'
);
```

---

### 📝 Task 5: Create InMail Credit Sync Workflow

**New Workflow Name:** `Sync InMail Credits`

**Trigger:** Schedule (every 6 hours)
**Cron:** `0 */6 * * *`

#### 5.1 Get All Users with LinkedIn Connected

**Node Type:** Postgres
**Query:**

```sql
SELECT
  up.user_id,
  up.unipile_account_id,
  la.account_type
FROM user_profiles up
JOIN linkedin_accounts la ON la.user_id = up.user_id
WHERE up.linkedin_connected = true
  AND up.unipile_account_id IS NOT NULL
  AND la.account_type != 'free'  -- Free accounts don't have InMail
ORDER BY up.user_id;
```

#### 5.2 Loop Through Users

**Node Type:** Split In Batches
**Batch Size:** 10 (to avoid rate limits)

#### 5.3 Fetch InMail Balance from Unipile

**Node Type:** HTTP Request
**Method:** GET
**URL:** `https://api.unipile.com/api/v1/messaging/linkedin/inmails/balance`
**Headers:**
```json
{
  "X-API-KEY": "{{$env.UNIPILE_API_KEY}}",
  "account_id": "{{$json["unipile_account_id"]}}"
}
```

#### 5.4 Update linkedin_accounts

**Node Type:** Postgres
**Query:**

```sql
UPDATE linkedin_accounts
SET
  inmail_credits_remaining = {{$json["response"]["credits_remaining"]}},
  inmail_credits_max = {{$json["response"]["credits_max"]}},
  inmail_renewal_date = '{{$json["response"]["renewal_date"]}}',
  updated_at = NOW()
WHERE user_id = '{{$json["user_id"]}}';
```

#### 5.5 Add Error Handling

- Catch Unipile API errors
- Log to `error_events` table
- Continue to next user

---

### 📝 Task 6: Create Quota Reset Cron Jobs

Create 5 separate workflows with schedule triggers:

#### 6.1 Daily Quota Reset

**Name:** `Reset Daily Quotas`
**Trigger:** Schedule - `0 0 * * *` (midnight UTC)
**Node:** Postgres Execute Query

```sql
SELECT reset_daily_quotas();
```

#### 6.2 Hourly Quota Reset

**Name:** `Reset Hourly Quotas`
**Trigger:** Schedule - `0 * * * *` (top of every hour)
**Node:** Postgres Execute Query

```sql
SELECT reset_hourly_quotas();
```

#### 6.3 Weekly Quota Reset Check

**Name:** `Reset Weekly Quotas`
**Trigger:** Schedule - `0 1 * * *` (1 AM UTC daily)
**Node:** Postgres Execute Query

```sql
SELECT reset_weekly_quotas();
```

#### 6.4 Monthly Quota Reset Check

**Name:** `Reset Monthly Quotas`
**Trigger:** Schedule - `0 2 * * *` (2 AM UTC daily)
**Node:** Postgres Execute Query

```sql
SELECT reset_monthly_quotas();
```

#### 6.5 Auto-Withdraw Old Connection Requests

**Name:** `Auto Withdraw Connections`
**Trigger:** Schedule - `0 3 * * *` (3 AM UTC daily)
**Node:** Postgres Execute Query

```sql
SELECT auto_withdraw_old_requests();
```

---

## Testing Checklist

### ✅ Pre-Integration Testing

1. **Run Migration Successfully**
   - [ ] All tables created
   - [ ] All functions created without errors
   - [ ] Triggers active
   - [ ] RLS policies enabled

2. **Test Database Functions Manually**

```sql
-- Test 1: Check quota for test user
SELECT * FROM check_message_quota(
  'test_user_id',
  'connection_request',
  true
);
-- Expected: can_send = true (if user has no quota records yet)

-- Test 2: Increment quota
SELECT increment_message_quota(
  'test_user_id',
  'connection_request',
  true
);

-- Test 3: Check quota again
SELECT * FROM check_message_quota(
  'test_user_id',
  'connection_request',
  true
);
-- Expected: Daily count should be 1

-- Test 4: Check quota state
SELECT * FROM message_quotas WHERE user_id = 'test_user_id';
```

### ✅ Post-Integration Testing

**Test Scenario 1: New User Connects LinkedIn**
1. User connects LinkedIn via Unipile
2. Verify `linkedin_accounts` record created
3. Verify `message_quotas` record created
4. Check account_type is correct (free/premium)

**Test Scenario 2: Send Connection Request**
1. Generate message for prospect
2. Workflow calls `check_message_quota()`
3. Verify returns `can_send = true`
4. Send via Unipile
5. Verify `increment_message_quota()` called
6. Check `message_quotas.daily_connection_requests` = 1
7. Check `connection_requests` table has record

**Test Scenario 3: Hit Daily Limit**
1. Manually set `daily_connection_requests = 20` for test user
2. Try to send another connection request
3. Verify `check_message_quota()` returns `can_send = false`
4. Verify reason message explains limit reached
5. Verify workflow returns error to user

**Test Scenario 4: Rate Limiting**
1. Send a message
2. Immediately try to send another
3. Verify blocked by 2-minute rule
4. Wait 2+ minutes
5. Verify can send again

**Test Scenario 5: InMail Credit Sync**
1. Trigger InMail sync workflow manually
2. Verify Unipile API called for all premium users
3. Check `linkedin_accounts.inmail_credits_remaining` updated
4. Verify free users skipped

**Test Scenario 6: Daily Reset**
1. Set `daily_connection_requests = 20` for test user
2. Trigger "Reset Daily Quotas" workflow
3. Verify all daily counters reset to 0
4. Verify `daily_reset_at` updated to next midnight

---

## Rollback Plan

If issues arise after integration:

### Option 1: Disable Quota Checking (Quick Fix)

Update the limit checking flow to always return `can_send = true`:

```javascript
// In a Function node before quota check
return [{
  json: {
    can_send: true,
    reason: '',
    wait_until: null
  }
}];
```

This allows workflows to continue while you fix issues.

### Option 2: Revert to Old Limit Checking

Temporarily switch back to querying `usage_tracking` table directly:

```sql
SELECT
  COALESCE(connection_requests_sent, 0) as connection_requests_sent,
  COALESCE(messages_sent, 0) as messages_sent
FROM usage_tracking
WHERE user_id = '{{$json["user_id"]}}'
  AND usage_date = CURRENT_DATE;
```

### Option 3: Drop New Tables (Last Resort)

```sql
DROP TABLE IF EXISTS quota_violations CASCADE;
DROP TABLE IF EXISTS connection_requests CASCADE;
DROP TABLE IF EXISTS message_quotas CASCADE;
DROP TABLE IF EXISTS linkedin_accounts CASCADE;
DROP TABLE IF EXISTS sequence_messages CASCADE;
DROP TABLE IF EXISTS sequence_prospects CASCADE;
DROP TABLE IF EXISTS outreach_sequences CASCADE;

DROP FUNCTION IF EXISTS check_message_quota CASCADE;
DROP FUNCTION IF EXISTS increment_message_quota CASCADE;
DROP FUNCTION IF EXISTS reset_daily_quotas CASCADE;
DROP FUNCTION IF EXISTS reset_hourly_quotas CASCADE;
DROP FUNCTION IF EXISTS reset_weekly_quotas CASCADE;
DROP FUNCTION IF EXISTS reset_monthly_quotas CASCADE;
DROP FUNCTION IF EXISTS auto_withdraw_old_requests CASCADE;
```

---

## Monitoring & Observability

### Key Metrics to Track

1. **Quota Violations**
```sql
SELECT
  violation_type,
  COUNT(*) as count,
  DATE_TRUNC('hour', occurred_at) as hour
FROM quota_violations
WHERE occurred_at > NOW() - INTERVAL '24 hours'
GROUP BY violation_type, hour
ORDER BY hour DESC;
```

2. **Daily Send Volume**
```sql
SELECT
  user_id,
  daily_connection_requests,
  daily_direct_messages,
  daily_inmails,
  last_action_at
FROM message_quotas
ORDER BY last_action_at DESC;
```

3. **Pending Connections Health**
```sql
SELECT
  la.user_id,
  mq.pending_connections,
  la.connection_acceptance_rate,
  CASE
    WHEN mq.pending_connections > 400 THEN 'CRITICAL'
    WHEN mq.pending_connections > 200 THEN 'WARNING'
    ELSE 'HEALTHY'
  END as status
FROM linkedin_accounts la
JOIN message_quotas mq ON mq.user_id = la.user_id
WHERE mq.pending_connections > 0
ORDER BY mq.pending_connections DESC;
```

4. **Function Call Performance**
```sql
-- Monitor slow queries in Supabase dashboard
-- Look for check_message_quota() execution time
-- Should be < 50ms typically
```

---

## Timeline Estimate

| Task | Estimated Time | Priority |
|------|---------------|----------|
| Run Migration | 5 minutes | P0 - Critical |
| Update Unipile Callback | 30 minutes | P0 - Critical |
| Replace Limit Checking | 1 hour | P0 - Critical |
| Update Message Router | 45 minutes | P1 - High |
| Add Post-Send Updates | 1 hour | P1 - High |
| Create InMail Sync | 45 minutes | P2 - Medium |
| Create Cron Jobs | 30 minutes | P1 - High |
| Testing | 2-3 hours | P0 - Critical |

**Total:** ~6-8 hours for full integration and testing

---

## Support & Troubleshooting

### Common Issues

**Issue:** `check_message_quota()` returns error
- Check function exists: `\df check_message_quota`
- Check parameters are correct type
- Check user_id exists in users table

**Issue:** Quotas not incrementing
- Verify `increment_message_quota()` is being called
- Check transaction isn't rolling back
- Verify RLS policies allow updates

**Issue:** Reset functions not working
- Check cron jobs are active
- Verify function permissions
- Check Postgres logs for errors

**Issue:** InMail credits not syncing
- Verify Unipile API key is valid
- Check account_id is correct format
- Verify user has premium account

---

## Next Steps After Integration

1. **Monitor for 48 hours** - Watch for any errors or unexpected behavior
2. **Collect metrics** - Analyze quota violation patterns
3. **Optimize delays** - Adjust randomization ranges based on data
4. **Build dashboard** - Create Supabase dashboard for quota monitoring
5. **User feedback** - Gather feedback on limit messaging

---

## Questions or Issues?

Document any blockers or questions:
- Database migration errors
- n8n workflow issues
- Unipile API problems
- Performance concerns

Let's tackle them one by one!
