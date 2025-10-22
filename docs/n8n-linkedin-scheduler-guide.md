# LinkedIn Message Scheduler - Database Integration Guide

## Overview

This document explains the database schema and PostgreSQL queries needed to build a LinkedIn message scheduler that:
- Respects daily, weekly, and monthly LinkedIn limits
- Implements randomization to avoid detection
- Tracks quota usage across all message types
- Integrates with Unipile API for actual message sending

## Database Architecture

### Core Tables

#### 1. `linkedin_accounts`
Stores user's LinkedIn account configuration and limits.

```sql
SELECT
  user_id,
  account_type,                    -- 'free', 'premium', 'sales_navigator', etc.
  inmail_credits_remaining,
  inmail_credits_max,
  inmail_renewal_date,
  account_status                   -- 'active', 'warning', 'restricted', 'suspended'
FROM linkedin_accounts
WHERE user_id = 'USER_ID_HERE';
```

**Account Type Limits:**
- **Free**: 100 DMs/day, 20 personalized connections/month, 100 connections/week
- **Premium**: 150 DMs/day, 100+ connections/week, InMail credits
- **Sales Navigator**: Higher limits + advanced features

#### 2. `message_quotas`
Real-time tracking of all quota usage with automatic resets.

```sql
SELECT
  -- Daily quotas
  daily_direct_messages,
  daily_connection_requests,
  daily_inmails,
  daily_open_profile,
  daily_total_actions,
  daily_reset_at,

  -- Weekly quotas
  weekly_connection_requests,
  weekly_reset_at,

  -- Monthly quotas
  monthly_personalised_connections,
  monthly_open_profile_messages,
  monthly_reset_at,

  -- Rate limiting
  last_action_at,
  hourly_action_count,
  hourly_reset_at,

  -- Pending counts
  pending_connections
FROM message_quotas
WHERE user_id = 'USER_ID_HERE';
```

#### 3. `message_generation_logs`
Complete message lifecycle from AI generation to sending. Enhanced with LinkedIn-specific fields.

**Key columns for scheduler:**
- `message_status` - Current state: 'generated', 'approved', 'sent', 'failed'
- `message_type` - LinkedIn message type: 'connection_request', 'direct_message', 'inmail', 'open_profile'
- `recipient_linkedin_id` - Target LinkedIn profile ID
- `unipile_message_id` - Unipile's message identifier after sending
- `is_personalised` - Affects quota limits for free accounts
- `sequence_id` - Link to outreach sequence (if part of campaign)

#### 4. `connection_requests`
Tracks connection requests with auto-withdrawal after 14 days.

```sql
SELECT
  recipient_linkedin_id,
  status,                          -- 'pending', 'accepted', 'ignored', 'withdrawn'
  sent_at,
  withdrawal_scheduled_for,        -- Auto-withdraws after 14 days
  auto_withdrawn
FROM connection_requests
WHERE user_id = 'USER_ID_HERE'
  AND status = 'pending';
```

#### 5. `outreach_sequences`
Campaign configuration for automated sequences.

```sql
SELECT
  id,
  sequence_name,
  sequence_type,                   -- 'connection_request', 'inmail', 'message'
  status,                          -- 'draft', 'active', 'paused', 'completed'
  daily_limit,                     -- User-defined limit (max 100)
  delay_between_min,               -- Minimum minutes between sends
  delay_between_max,               -- Maximum minutes between sends
  working_hours_only,              -- Boolean
  working_days,                    -- Array: [1,2,3,4,5] = Mon-Fri
  timezone,                        -- User's timezone
  sent_count,
  total_targets
FROM outreach_sequences
WHERE user_id = 'USER_ID_HERE'
  AND status = 'active';
```

#### 6. `sequence_prospects`
Individual targets within sequences, with scheduling information.

```sql
SELECT
  id,
  sequence_id,
  linkedin_public_id,
  linkedin_messaging_id,
  prospect_name,
  status,                          -- 'pending', 'scheduled', 'sending', 'sent', 'failed'
  scheduled_for,                   -- When to send (calculated by scheduler)
  current_step                     -- 0 = initial, 1+ = follow-ups
FROM sequence_prospects
WHERE sequence_id = 123
  AND status = 'scheduled'
  AND scheduled_for <= NOW()
ORDER BY scheduled_for ASC;
```

---

## Key Database Functions

### 1. `check_message_quota()`
**Purpose:** Check if user can send a message right now.

**Usage:**
```sql
SELECT * FROM check_message_quota(
  p_user_id := 'user_abc123',
  p_message_type := 'connection_request',
  p_is_personalised := true
);
```

**Returns:**
| Column | Type | Description |
|--------|------|-------------|
| can_send | boolean | Whether user can send now |
| reason | text | Explanation if blocked |
| wait_until | timestamptz | When quota resets (null if can send) |

**Example Results:**

✅ **Can Send:**
```
can_send: true
reason: ''
wait_until: null
```

❌ **Rate Limited:**
```
can_send: false
reason: 'Rate limit: Must wait 2 minutes between actions'
wait_until: '2025-10-21 10:35:00+00'
```

❌ **Daily Limit:**
```
can_send: false
reason: 'Daily direct message limit reached (100/day for free)'
wait_until: '2025-10-22 00:00:00+00'
```

**Checks Performed:**
1. ✓ 2-minute rate limit between ANY actions
2. ✓ 25 actions per hour limit
3. ✓ Daily message type limits (100-150 DMs, varies by account)
4. ✓ Weekly connection request limit (100/week)
5. ✓ Monthly personalized connection limit (20/month for free)
6. ✓ InMail credits remaining
7. ✓ Pending connections < 500

### 2. `increment_message_quota()`
**Purpose:** Update all quota counters after successfully sending a message.

**Usage:**
```sql
SELECT increment_message_quota(
  p_user_id := 'user_abc123',
  p_message_type := 'connection_request',
  p_is_personalised := true
);
```

**What It Does:**
- Increments relevant daily/weekly/monthly counters
- Updates `last_action_at` timestamp
- Increments `hourly_action_count`
- Decrements InMail credits (if applicable)
- Updates legacy `usage_tracking` table for backwards compatibility

**⚠️ IMPORTANT:** Call this AFTER Unipile confirms message was sent successfully.

### 3. `reset_daily_quotas()`
**Purpose:** Reset all daily counters (run at midnight).

```sql
SELECT reset_daily_quotas();
```

### 4. `reset_weekly_quotas()`
**Purpose:** Reset weekly counters for users whose 7-day cycle has ended.

```sql
SELECT reset_weekly_quotas();
```

### 5. `reset_monthly_quotas()`
**Purpose:** Reset monthly counters at month boundaries.

```sql
SELECT reset_monthly_quotas();
```

### 6. `auto_withdraw_old_requests()`
**Purpose:** Automatically withdraw connection requests older than 14 days.

```sql
SELECT auto_withdraw_old_requests();
```

---

## Scheduler Implementation Guide

### Workflow Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    SCHEDULER WORKFLOW                        │
└─────────────────────────────────────────────────────────────┘

1. CRON Trigger (every 5 minutes)
   ↓
2. Get Active Sequences
   ↓
3. For Each Sequence:
   ├─→ Check Working Hours/Days
   ├─→ Check Sequence Daily Limit
   └─→ Get Next Scheduled Prospect
       ↓
4. For Each Prospect:
   ├─→ Check User Quota (check_message_quota)
   ├─→ If can_send = true:
   │   ├─→ Update status to 'sending'
   │   ├─→ Send via Unipile
   │   ├─→ If success:
   │   │   ├─→ Increment quota
   │   │   ├─→ Update message_generation_logs
   │   │   ├─→ Update prospect status to 'sent'
   │   │   └─→ Schedule next prospect with randomized delay
   │   └─→ If failure:
   │       └─→ Update prospect status to 'failed'
   └─→ If can_send = false:
       └─→ Reschedule for wait_until time
```

### Critical SQL Queries for Scheduler

#### 1. Get Active Sequences to Process

```sql
-- Get all active sequences that have pending prospects
SELECT
  s.id AS sequence_id,
  s.user_id,
  s.sequence_name,
  s.sequence_type,
  s.daily_limit,
  s.delay_between_min,
  s.delay_between_max,
  s.working_hours_only,
  s.working_days,
  s.timezone,
  s.sent_count,
  -- Calculate how many sent today
  COALESCE(
    (SELECT COUNT(*)
     FROM sequence_prospects sp
     WHERE sp.sequence_id = s.id
       AND sp.sent_at >= DATE_TRUNC('day', NOW())
    ), 0
  ) AS sent_today,
  -- Count remaining prospects
  COALESCE(
    (SELECT COUNT(*)
     FROM sequence_prospects sp
     WHERE sp.sequence_id = s.id
       AND sp.status IN ('pending', 'scheduled')
    ), 0
  ) AS prospects_remaining
FROM outreach_sequences s
WHERE s.status = 'active'
  AND EXISTS (
    SELECT 1 FROM sequence_prospects sp
    WHERE sp.sequence_id = s.id
      AND sp.status IN ('pending', 'scheduled')
  )
ORDER BY s.id;
```

#### 2. Check Working Hours

```sql
-- Check if current time is within working hours for a sequence
-- Example: Working hours 9 AM - 5 PM, Mon-Fri, timezone 'Europe/London'

SELECT
  -- Current time in user's timezone
  NOW() AT TIME ZONE 'Europe/London' AS current_time_local,

  -- Current day of week (1=Monday, 7=Sunday)
  EXTRACT(ISODOW FROM NOW() AT TIME ZONE 'Europe/London') AS current_day,

  -- Current hour (0-23)
  EXTRACT(HOUR FROM NOW() AT TIME ZONE 'Europe/London') AS current_hour,

  -- Is it a working day?
  EXTRACT(ISODOW FROM NOW() AT TIME ZONE 'Europe/London')::INTEGER = ANY(ARRAY[1,2,3,4,5]) AS is_working_day,

  -- Is it working hours? (9 AM - 5 PM)
  EXTRACT(HOUR FROM NOW() AT TIME ZONE 'Europe/London') BETWEEN 9 AND 16 AS is_working_hours;
```

**Use in n8n:**
```javascript
// In n8n Function node
const timezone = '{{$json["timezone"]}}';
const workingDays = {{$json["working_days"]}}; // e.g., [1,2,3,4,5]
const workingHoursOnly = {{$json["working_hours_only"]}};

// Check if we should process this sequence now
// If workingHoursOnly is false, always process
// If true, check day and hours
```

#### 3. Get Next Prospect to Send

```sql
-- Get the next prospect ready to send for a specific sequence
SELECT
  sp.id AS prospect_id,
  sp.sequence_id,
  sp.user_id,
  sp.linkedin_public_id,
  sp.linkedin_messaging_id,
  sp.prospect_name,
  sp.prospect_headline,
  sp.prospect_company,
  sp.status,
  sp.scheduled_for,
  sp.current_step,
  -- Get the message template from sequence
  s.sequence_type,
  s.message_template,
  -- Get research data if available
  rc.research_data
FROM sequence_prospects sp
JOIN outreach_sequences s ON s.id = sp.sequence_id
LEFT JOIN research_cache rc ON rc.profile_url = sp.linkedin_url
WHERE sp.sequence_id = 123
  AND sp.status = 'scheduled'
  AND sp.scheduled_for <= NOW()
ORDER BY sp.scheduled_for ASC
LIMIT 1;
```

#### 4. Check User's Current Quota Status

```sql
-- Get current quota usage for a user
SELECT
  la.account_type,
  la.inmail_credits_remaining,

  -- Daily stats
  mq.daily_direct_messages,
  mq.daily_connection_requests,
  mq.daily_inmails,
  mq.daily_total_actions,

  -- Limits based on account type
  CASE
    WHEN la.account_type = 'free' THEN 100
    ELSE 150
  END AS daily_dm_limit,

  CASE
    WHEN la.account_type = 'free' THEN 20
    ELSE 100
  END AS daily_connection_limit,

  -- Weekly stats
  mq.weekly_connection_requests,

  -- Monthly stats
  mq.monthly_personalised_connections,

  -- Rate limiting
  mq.last_action_at,
  NOW() - mq.last_action_at AS time_since_last_action,
  CASE
    WHEN mq.last_action_at IS NULL THEN true
    WHEN mq.last_action_at < NOW() - INTERVAL '2 minutes' THEN true
    ELSE false
  END AS can_send_now,

  mq.hourly_action_count,
  mq.pending_connections

FROM linkedin_accounts la
JOIN message_quotas mq ON mq.user_id = la.user_id
WHERE la.user_id = 'USER_ID_HERE';
```

#### 5. Update Prospect to 'Sending' Status

```sql
-- Mark prospect as 'sending' before calling Unipile
UPDATE sequence_prospects
SET
  status = 'sending',
  updated_at = NOW()
WHERE id = 456
  AND status = 'scheduled'
RETURNING *;
```

#### 6. Record Successful Send

```sql
-- After Unipile confirms send was successful
BEGIN;

-- Update the message_generation_logs record
UPDATE message_generation_logs
SET
  message_status = 'sent',
  message_type = 'connection_request',
  recipient_linkedin_id = 'linkedin_profile_id_123',
  recipient_name = 'John Doe',
  unipile_message_id = 'unipile_msg_xyz',
  unipile_thread_id = 'unipile_thread_abc',
  is_personalised = true,
  message_length = 150,
  sent_at = NOW(),
  updated_at = NOW()
WHERE message_id = 'msg_uuid_here';

-- Update the prospect status
UPDATE sequence_prospects
SET
  status = 'sent',
  sent_at = NOW(),
  last_message_at = NOW(),
  updated_at = NOW()
WHERE id = 456;

-- Increment the quota counters
SELECT increment_message_quota(
  p_user_id := 'user_abc123',
  p_message_type := 'connection_request',
  p_is_personalised := true
);

-- If it's a connection request, create tracking record
INSERT INTO connection_requests (
  user_id,
  recipient_linkedin_id,
  message_text,
  is_personalised,
  status,
  sequence_id,
  prospect_id
) VALUES (
  'user_abc123',
  'linkedin_profile_id_123',
  'Your personalized message here...',
  true,
  'pending',
  123,
  456
);

-- Update sequence sent count
UPDATE outreach_sequences
SET
  sent_count = sent_count + 1,
  updated_at = NOW()
WHERE id = 123;

COMMIT;
```

#### 7. Schedule Next Prospect with Randomization

```sql
-- Calculate next send time with randomization
-- This query generates a random delay and schedules the next prospect

WITH next_prospect AS (
  SELECT id
  FROM sequence_prospects
  WHERE sequence_id = 123
    AND status = 'pending'
  ORDER BY id
  LIMIT 1
),
random_delay AS (
  -- Generate random minutes between delay_between_min and delay_between_max
  SELECT
    5 AS min_delay,      -- From sequence config
    15 AS max_delay,     -- From sequence config
    (5 + RANDOM() * (15 - 5))::INTEGER AS delay_minutes
)
UPDATE sequence_prospects
SET
  status = 'scheduled',
  scheduled_for = NOW() + (SELECT delay_minutes FROM random_delay) * INTERVAL '1 minute',
  updated_at = NOW()
WHERE id = (SELECT id FROM next_prospect)
RETURNING
  id,
  scheduled_for,
  EXTRACT(EPOCH FROM (scheduled_for - NOW()))/60 AS minutes_until_send;
```

#### 8. Handle Failed Sends

```sql
-- Mark prospect as failed and log the error
UPDATE sequence_prospects
SET
  status = 'failed',
  error_message = 'Unipile API error: Rate limit exceeded',
  updated_at = NOW()
WHERE id = 456;

-- Update message status
UPDATE message_generation_logs
SET
  message_status = 'failed',
  updated_at = NOW()
WHERE message_id = 'msg_uuid_here';

-- Also update sequence failure count
UPDATE outreach_sequences
SET
  failed_count = failed_count + 1,
  updated_at = NOW()
WHERE id = 123;
```

---

## Anti-Detection Best Practices

### 1. Randomized Delays

**Never use fixed intervals.** LinkedIn's algorithm detects patterns.

```sql
-- BAD: Fixed 5-minute delays
scheduled_for = NOW() + INTERVAL '5 minutes'

-- GOOD: Random delays between 5-15 minutes
scheduled_for = NOW() + (5 + RANDOM() * 10)::INTEGER * INTERVAL '1 minute'

-- BETTER: Use Gaussian distribution for more natural timing
scheduled_for = NOW() + (
  5 + (RANDOM() + RANDOM() + RANDOM() + RANDOM()) / 4 * 10
)::INTEGER * INTERVAL '1 minute'
```

**Recommended Delay Ranges:**
- **Connection Requests**: 5-20 minutes between sends
- **Direct Messages**: 3-10 minutes between sends
- **InMails**: 10-30 minutes between sends

### 2. Human-Like Activity Patterns

```sql
-- Query to determine if we should send based on "natural" patterns
WITH activity_pattern AS (
  SELECT
    EXTRACT(HOUR FROM NOW() AT TIME ZONE 'Europe/London') AS current_hour,
    EXTRACT(DOW FROM NOW() AT TIME ZONE 'Europe/London') AS current_dow,

    -- Higher probability during business hours
    CASE
      WHEN EXTRACT(HOUR FROM NOW() AT TIME ZONE 'Europe/London') BETWEEN 9 AND 17 THEN 0.8
      WHEN EXTRACT(HOUR FROM NOW() AT TIME ZONE 'Europe/London') BETWEEN 8 AND 9 THEN 0.4
      WHEN EXTRACT(HOUR FROM NOW() AT TIME ZONE 'Europe/London') BETWEEN 17 AND 19 THEN 0.4
      ELSE 0.1
    END AS hour_probability,

    -- Lower probability on weekends
    CASE
      WHEN EXTRACT(DOW FROM NOW() AT TIME ZONE 'Europe/London') IN (0, 6) THEN 0.2
      ELSE 1.0
    END AS day_probability,

    RANDOM() AS random_factor
)
SELECT
  current_hour,
  hour_probability * day_probability AS combined_probability,
  random_factor,
  CASE
    WHEN random_factor < (hour_probability * day_probability) THEN true
    ELSE false
  END AS should_send_now
FROM activity_pattern;
```

**Use in n8n:**
- Check `should_send_now` before processing each prospect
- If false, skip this cycle and try again in next cron run
- This creates natural "quiet periods" in activity

### 3. Velocity Control

**Don't send at maximum capacity every day.** Vary your daily send volume.

```sql
-- Calculate a "relaxed" daily limit (80-95% of max)
WITH daily_variance AS (
  SELECT
    daily_limit,
    (daily_limit * (0.80 + RANDOM() * 0.15))::INTEGER AS todays_limit
  FROM outreach_sequences
  WHERE id = 123
)
SELECT
  todays_limit,
  sent_today,
  CASE
    WHEN sent_today >= todays_limit THEN false
    ELSE true
  END AS can_send_more_today
FROM daily_variance
CROSS JOIN (
  SELECT COUNT(*) AS sent_today
  FROM sequence_prospects
  WHERE sequence_id = 123
    AND sent_at >= DATE_TRUNC('day', NOW())
) AS today;
```

### 4. Weekly Patterns

Gradually increase activity through the week, decrease on Friday.

```javascript
// In n8n Function node - Calculate weekly velocity modifier
const dayOfWeek = new Date().getDay(); // 0=Sun, 1=Mon, etc.

const velocityModifiers = {
  0: 0.3,  // Sunday - very low
  1: 0.7,  // Monday - ramp up
  2: 0.9,  // Tuesday - normal
  3: 1.0,  // Wednesday - peak
  4: 0.9,  // Thursday - normal
  5: 0.6,  // Friday - wind down
  6: 0.3   // Saturday - very low
};

const dailyLimit = {{$json["daily_limit"]}};
const adjustedLimit = Math.floor(dailyLimit * velocityModifiers[dayOfWeek]);

return { adjustedLimit };
```

### 5. Burst Prevention

**Never send multiple messages within 2 minutes.** Always check `last_action_at`.

```sql
-- This is already built into check_message_quota() but here's the logic:
SELECT
  user_id,
  last_action_at,
  NOW() - last_action_at AS time_since_last,
  CASE
    WHEN last_action_at IS NULL THEN true
    WHEN NOW() - last_action_at < INTERVAL '2 minutes' THEN false
    ELSE true
  END AS can_send
FROM message_quotas
WHERE user_id = 'USER_ID';
```

### 6. Connection Request Hygiene

```sql
-- Check pending connection ratio (keep under 500, ideally under 200)
SELECT
  pending_connections,
  CASE
    WHEN pending_connections > 400 THEN 'critical'
    WHEN pending_connections > 200 THEN 'warning'
    ELSE 'healthy'
  END AS status,
  CASE
    WHEN pending_connections > 400 THEN false
    WHEN pending_connections > 200 THEN (RANDOM() < 0.3) -- Only 30% chance to send
    ELSE true
  END AS should_send_connections
FROM message_quotas
WHERE user_id = 'USER_ID';
```

---

## Scheduler Cron Jobs

Set up these recurring jobs in n8n:

### 1. Main Scheduler (Every 5 Minutes)
```
*/5 * * * *
```
- Processes active sequences
- Checks quotas
- Sends messages via Unipile
- Schedules next prospects

### 2. Daily Reset (Midnight UTC)
```
0 0 * * *
```
```sql
SELECT reset_daily_quotas();
```

### 3. Hourly Reset (Top of Each Hour)
```
0 * * * *
```
```sql
SELECT reset_hourly_quotas();
```

### 4. Weekly Reset Check (Daily at 1 AM UTC)
```
0 1 * * *
```
```sql
SELECT reset_weekly_quotas();
```

### 5. Monthly Reset Check (Daily at 2 AM UTC)
```
0 2 * * *
```
```sql
SELECT reset_monthly_quotas();
```

### 6. Connection Withdrawal (Daily at 3 AM UTC)
```
0 3 * * *
```
```sql
SELECT auto_withdraw_old_requests();
```

### 7. InMail Credit Sync (Every 6 Hours)
```
0 */6 * * *
```
- Fetch InMail balance from Unipile API
- Update `linkedin_accounts.inmail_credits_remaining`

---

## Example n8n Workflow Logic

### Main Scheduler Workflow Pseudocode

```
1. CRON Trigger (every 5 minutes)
   ↓
2. Postgres Node: Get Active Sequences
   Query: SELECT * FROM outreach_sequences WHERE status = 'active'
   ↓
3. Split Into Items (Loop each sequence)
   ↓
4. Function Node: Check Working Hours
   - Extract timezone, working_days, working_hours_only
   - Calculate if current time is valid
   - Return {should_process: true/false}
   ↓
5. IF Node: Should Process?
   ↓ (YES)
6. Postgres Node: Get Next Scheduled Prospect
   Query: SELECT * FROM sequence_prospects WHERE sequence_id = X AND status = 'scheduled' AND scheduled_for <= NOW() LIMIT 1
   ↓
7. Postgres Node: Check Message Quota
   Query: SELECT * FROM check_message_quota(user_id, message_type, is_personalised)
   ↓
8. IF Node: Can Send?
   ↓ (YES)
9. Postgres Node: Mark as 'sending'
   Query: UPDATE sequence_prospects SET status = 'sending' WHERE id = X
   ↓
10. HTTP Request: Send via Unipile
    POST https://api.unipile.com/api/v1/messaging/linkedin/send
    Headers: X-API-KEY: {{$env.UNIPILE_API_KEY}}
    Body: {account_id, recipient_id, message}
    ↓
11. IF Node: Send Successful?
    ↓ (YES)
12. Postgres Node: Record Success (Transaction)
    - UPDATE message_generation_logs
    - UPDATE sequence_prospects SET status = 'sent'
    - SELECT increment_message_quota(...)
    - INSERT INTO connection_requests (if applicable)
    - UPDATE outreach_sequences SET sent_count = sent_count + 1
    ↓
13. Function Node: Calculate Random Next Send Time
    const min = {{$json.delay_between_min}};
    const max = {{$json.delay_between_max}};
    const delay = min + Math.floor(Math.random() * (max - min));
    return {delay_minutes: delay};
    ↓
14. Postgres Node: Schedule Next Prospect
    Query: UPDATE sequence_prospects SET status='scheduled', scheduled_for = NOW() + X minutes WHERE id = (next pending prospect)
    ↓
15. END

    ↓ (NO - Send Failed)
16. Postgres Node: Mark as Failed
    Query: UPDATE sequence_prospects SET status='failed', error_message=X WHERE id=Y
    ↓
17. END

    ↓ (NO - Can't Send - Quota Exceeded)
18. Postgres Node: Reschedule
    Query: UPDATE sequence_prospects SET scheduled_for = {{$json.wait_until}} WHERE id = X
    ↓
19. END
```

---

## Testing Queries

### Get User's Current Status
```sql
SELECT
  'Account Type' AS metric,
  la.account_type AS value
FROM linkedin_accounts la
WHERE la.user_id = 'YOUR_USER_ID'

UNION ALL

SELECT
  'DMs Sent Today',
  mq.daily_direct_messages::TEXT
FROM message_quotas mq
WHERE mq.user_id = 'YOUR_USER_ID'

UNION ALL

SELECT
  'Connections Sent Today',
  mq.daily_connection_requests::TEXT
FROM message_quotas mq
WHERE mq.user_id = 'YOUR_USER_ID'

UNION ALL

SELECT
  'Connections Sent This Week',
  mq.weekly_connection_requests::TEXT
FROM message_quotas mq
WHERE mq.user_id = 'YOUR_USER_ID'

UNION ALL

SELECT
  'InMail Credits',
  la.inmail_credits_remaining::TEXT
FROM linkedin_accounts la
WHERE la.user_id = 'YOUR_USER_ID'

UNION ALL

SELECT
  'Pending Connections',
  mq.pending_connections::TEXT
FROM message_quotas mq
WHERE mq.user_id = 'YOUR_USER_ID'

UNION ALL

SELECT
  'Last Action',
  TO_CHAR(mq.last_action_at, 'YYYY-MM-DD HH24:MI:SS')
FROM message_quotas mq
WHERE mq.user_id = 'YOUR_USER_ID';
```

### Simulate Sending a Message
```sql
-- Test the full flow without actually sending
BEGIN;

-- 1. Check quota
SELECT * FROM check_message_quota(
  'YOUR_USER_ID',
  'connection_request',
  true
);

-- 2. If can_send = true, increment (for testing, we'll rollback)
SELECT increment_message_quota(
  'YOUR_USER_ID',
  'connection_request',
  true
);

-- 3. Check new quota state
SELECT
  daily_connection_requests,
  weekly_connection_requests,
  last_action_at
FROM message_quotas
WHERE user_id = 'YOUR_USER_ID';

-- ROLLBACK for testing (use COMMIT in production)
ROLLBACK;
```

---

## Error Handling

### Common Errors and Solutions

#### 1. Quota Check Returns False
```sql
-- Query the violation log to understand why
SELECT
  violation_type,
  message,
  occurred_at
FROM quota_violations
WHERE user_id = 'YOUR_USER_ID'
ORDER BY occurred_at DESC
LIMIT 10;
```

#### 2. Pending Connections Too High
```sql
-- Check connection acceptance rate
SELECT
  user_id,
  pending_connections,
  connection_acceptance_rate,
  CASE
    WHEN connection_acceptance_rate < 0.20 THEN 'Poor - Pause connections'
    WHEN connection_acceptance_rate < 0.40 THEN 'Low - Reduce volume'
    ELSE 'Healthy'
  END AS recommendation
FROM linkedin_accounts
WHERE user_id = 'YOUR_USER_ID';
```

#### 3. Account Restricted
```sql
-- Check account status
SELECT
  account_status,
  last_restriction_date
FROM linkedin_accounts
WHERE user_id = 'YOUR_USER_ID';

-- If 'restricted', pause all sequences
UPDATE outreach_sequences
SET status = 'paused'
WHERE user_id = 'YOUR_USER_ID'
  AND status = 'active';
```

---

## Contact & Support

For database schema questions, contact: [Your contact info]
For Unipile API questions, see: https://docs.unipile.com

**Key Points to Remember:**
1. Always call `check_message_quota()` before sending
2. Always call `increment_message_quota()` after successful send
3. Use randomization for ALL delays
4. Never exceed 2-minute minimum between actions
5. Monitor pending connections and acceptance rates
6. Respect working hours when configured
7. Handle Unipile errors gracefully and mark prospects as 'failed'
