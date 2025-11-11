# LinkedIn Duplicate Detection - Implementation Summary

## What Was Built

This implementation prevents users from creating multiple Cold AI accounts with different emails to bypass rate limits by connecting the same LinkedIn profile multiple times. It uses a **simplified approach** with existing tables instead of creating new ones.

## Key Changes Made

### 1. Database Migration (NEW)
**File:** `/supabase/migrations/20250111_linkedin_deduplication_simplified.sql`

**What it does:**
- Adds 6 columns to `user_profiles` table to track LinkedIn connections
- Adds 3 columns to `webhook_events` table for connection audit trail
- Adds 3 columns to `auth_login_attempts` for signup pattern detection
- Adds 1 column to `knowledge_base_ai_usage` for cross-user tracking
- Creates **unique index** on `linkedin_public_identifier` to prevent duplicates
- Adds helper functions for LinkedIn ID extraction and Gmail alias detection
- Creates monitoring views (`linkedin_connection_audit`, `potential_duplicate_signups`)

**Status:** ⚠️ NOT RUN YET - You need to run this in Supabase SQL Editor

### 2. Webhook Handler (UPDATED)
**File:** `/supabase/functions/unipile-webhook/index.ts`

**What it does:**
- Detects duplicate LinkedIn connections when user connects
- Automatically deletes duplicate Unipile accounts
- Logs all connection events to `webhook_events` table
- Stores LinkedIn organizations data for potential fraud detection
- Handles reconnections by same user (legitimate use case)

**Status:** ⚠️ NOT DEPLOYED YET - Needs `supabase functions deploy unipile-webhook`

### 3. Product Validation (ALREADY EXISTS)
**File:** `/supabase/functions/server-knowledge-action/index.ts`

**What it does:**
- Backend validation before Product/Service AI operations
- Returns 403 if LinkedIn not connected
- Prevents users from burning through AI costs before duplicate detection

**Status:** ⚠️ NOT DEPLOYED YET - Needs `supabase functions deploy server-knowledge-action`

### 4. ICP Validation (ALREADY EXISTS)
**File:** `/supabase/functions/server-icp-action/index.ts`

**What it does:**
- Backend validation before ICP AI operations
- Returns 403 if LinkedIn not connected
- Prevents users from burning through AI costs before duplicate detection

**Status:** ⚠️ NOT DEPLOYED YET - Needs `supabase functions deploy server-icp-action`

### 5. Product Widget Lock (UPDATED)
**File:** `/src/components/widgets/KnowledgeWidget.tsx`

**What it does:**
- Shows lock overlay when LinkedIn not connected
- Prevents interaction until LinkedIn is connected
- Matches ICP widget lock styling exactly

**Status:** ✅ ALREADY DEPLOYED (frontend code)

### 6. Modal Flow Update (UPDATED)
**File:** `/src/components/modals/ProfileCommunicationModal.tsx`

**What it does:**
- Checks LinkedIn connection before auto-opening Product modal
- Directs users to connect LinkedIn first if not connected

**Status:** ✅ ALREADY DEPLOYED (frontend code)

### 7. Onboarding Flow (UPDATED)
**File:** `/src/hooks/useOnboardingState.ts`

**What it does:**
- Enforces LinkedIn connection BEFORE Product/ICP access
- Reordered steps: Settings → **LinkedIn** → Product → ICP

**Status:** ✅ ALREADY DEPLOYED (frontend code)

### 8. LinkedIn Widget - Switch Account (NEW)
**File:** `/src/components/widgets/LinkedInWidget.tsx`

**What it does:**
- Added "Switch Account" button in LinkedIn management modal
- Disconnects current account and immediately opens connection flow for new account
- Provides seamless account switching experience

**Status:** ✅ ALREADY DEPLOYED (frontend code)

## How It Works

### Duplicate Detection Flow
```
1. User connects LinkedIn via Unipile
2. Webhook receives account.connected event
3. Extract linkedin_public_identifier from URL (e.g., "john-doe")
4. Check if this identifier already connected to different user_id
   - Query: user_profiles WHERE linkedin_public_identifier = 'john-doe' AND linkedin_connected = true
5. If duplicate detected:
   ✗ Log rejection to webhook_events
   ✗ Delete new Unipile account via API
   ✗ Return error: "This LinkedIn account is already registered to another email"
6. If NOT duplicate:
   ✓ Update user_profiles with LinkedIn data + organizations
   ✓ Log successful connection to webhook_events
   ✓ User can now access Product/ICP features
```

### Core Protection Mechanism
The **unique partial index** prevents database-level duplicates:

```sql
CREATE UNIQUE INDEX idx_linkedin_public_identifier_active
  ON public.user_profiles(linkedin_public_identifier)
  WHERE linkedin_connected = true AND linkedin_public_identifier IS NOT NULL;
```

This ensures that even if the edge function fails, the database will reject duplicate connections.

## What You Need to Do

### Step 1: Run Database Migration ⚠️ REQUIRED
```bash
# Navigate to Supabase Dashboard → SQL Editor
# Copy contents of: /supabase/migrations/20250111_linkedin_deduplication_simplified.sql
# Paste and execute
```

### Step 2: Deploy Edge Functions ⚠️ REQUIRED
```bash
supabase functions deploy unipile-webhook
supabase functions deploy server-knowledge-action
supabase functions deploy server-icp-action
```

### Step 3: Test the Flow ⚠️ RECOMMENDED
Run all test cases from `DEPLOYMENT_GUIDE_SIMPLIFIED.md`:
- Test Case 1: Normal first-time user
- Test Case 2: Duplicate LinkedIn detection
- Test Case 3: Backend protection (403 errors)
- Test Case 4: User reconnection (legitimate)
- Test Case 5: Different LinkedIn accounts (legitimate)

## New Database Columns

### user_profiles table
| Column | Type | Purpose |
|--------|------|---------|
| `linkedin_public_identifier` | TEXT | Unique LinkedIn URL slug (e.g., "john-doe") |
| `linkedin_first_connected_at` | TIMESTAMPTZ | First connection timestamp |
| `linkedin_connection_count` | INTEGER | Number of connections/reconnections |
| `linkedin_last_disconnected_at` | TIMESTAMPTZ | Last disconnection timestamp |
| `linkedin_profile_snapshot` | JSONB | Latest Unipile profile data |
| `linkedin_organizations` | JSONB | Organizations from Unipile (array) |

### webhook_events table
| Column | Type | Purpose |
|--------|------|---------|
| `linkedin_event_type` | TEXT | connected, disconnected, duplicate_rejected, error |
| `connection_status` | TEXT | active, disconnected, duplicate_rejected, failed |
| `rejection_reason` | TEXT | Reason if connection blocked |

### auth_login_attempts table
| Column | Type | Purpose |
|--------|------|---------|
| `is_signup` | BOOLEAN | True for signup attempts |
| `email_base` | TEXT | Normalized email (Gmail alias detection) |
| `is_gmail_alias` | BOOLEAN | True if Gmail alias detected |

### knowledge_base_ai_usage table
| Column | Type | Purpose |
|--------|------|---------|
| `linkedin_public_identifier` | TEXT | For cross-user usage tracking |

## Organizations Data

The system now stores `linkedin_organizations` from Unipile profile data. Example:

```json
[
  {
    "id": "108363936",
    "name": "Cold AI",
    "role": "Co-Founder",
    "start_date": "2024-01-01"
  }
]
```

This could be used for:
- Detecting users from same company creating multiple accounts
- Additional fraud detection signals
- Company affiliation tracking

**Current Status:** Data is collected but not actively used for validation yet.

## Monitoring Queries

### View all LinkedIn connection events
```sql
SELECT * FROM linkedin_connection_audit
ORDER BY created_at DESC
LIMIT 50;
```

### Check for duplicate detection rejections
```sql
SELECT
  user_id,
  created_at,
  rejection_reason,
  payload->'profile'->>'profile_url' as attempted_linkedin_url
FROM webhook_events
WHERE linkedin_event_type = 'duplicate_rejected'
ORDER BY created_at DESC;
```

### View potential duplicate signups (Gmail aliases from same IP)
```sql
SELECT * FROM potential_duplicate_signups
ORDER BY signup2_time DESC;
```

### Check active LinkedIn connections
```sql
SELECT
  user_id,
  linkedin_public_identifier,
  linkedin_url,
  linkedin_connection_count,
  linkedin_first_connected_at,
  linkedin_organizations
FROM user_profiles
WHERE linkedin_connected = true
ORDER BY linkedin_first_connected_at DESC;
```

## Frontend Features

### Switch Account Button
- Located in LinkedIn widget management modal
- Automatically disconnects current account
- Opens connection flow for new account
- Provides seamless switching experience

### Widget Lock Overlays
- Product widget shows lock when LinkedIn not connected
- ICP widget shows lock when Product not approved
- Identical styling with 🔒 icon and orange gradient button

### Onboarding Flow
- Step 1: Settings (Personal, Company, Communication)
- Step 2: **LinkedIn** ← Must complete before AI features
- Step 3: Product/Service
- Step 4: ICP

## Security Layers

1. **Database-level protection** - Unique index prevents duplicates
2. **Webhook-level detection** - Checks for duplicates and deletes Unipile accounts
3. **Backend validation** - Edge functions verify LinkedIn before AI operations
4. **Frontend guidance** - Widget locks and onboarding flow guide users
5. **Audit trail** - All events logged to `webhook_events` for monitoring

## User Experience

### Normal Flow (No Duplicate)
1. User signs up → Completes settings
2. User connects LinkedIn → Success! ✓
3. User creates Product → AI generates content ✓
4. User creates ICP → AI generates ICP ✓

### Duplicate Flow (Blocked)
1. User2 signs up with different email
2. User2 tries to connect same LinkedIn as User1
3. System detects duplicate → Shows error message ✗
4. Unipile account automatically deleted ✗
5. User2 cannot access AI features ✗

### Switch Account Flow (New Feature)
1. User connected with personal LinkedIn
2. User clicks "Switch Account" button
3. Current account disconnected
4. Connection popup opens immediately
5. User connects business LinkedIn ✓

## Files Modified/Created

### Created
- `/supabase/migrations/20250111_linkedin_deduplication_simplified.sql`
- `/DEPLOYMENT_GUIDE_SIMPLIFIED.md`
- `/IMPLEMENTATION_SUMMARY.md` (this file)

### Modified
- `/supabase/functions/unipile-webhook/index.ts`
- `/src/components/widgets/KnowledgeWidget.tsx`
- `/src/components/widgets/LinkedInWidget.tsx`
- `/src/components/modals/ProfileCommunicationModal.tsx`
- `/src/hooks/useOnboardingState.ts`

### Already Exist (No Changes Needed)
- `/supabase/functions/server-knowledge-action/index.ts`
- `/supabase/functions/server-icp-action/index.ts`

## Rollback Plan

If you need to rollback, see the "Rollback Plan" section in `DEPLOYMENT_GUIDE_SIMPLIFIED.md`.

## Next Steps After Deployment

1. ✅ Monitor `linkedin_connection_audit` view for first few days
2. ✅ Check for duplicate rejection attempts
3. ✅ Test Switch Account feature
4. ⚠️ Consider using organizations data for additional validation (future)
5. ⚠️ Monitor Gmail alias signups via `potential_duplicate_signups` view (future)

## Questions & Support

If you encounter issues:
1. Check Supabase edge function logs
2. Query `webhook_events` table for failed events
3. Verify unique index exists: `\d user_profiles` in SQL editor
4. Check browser console for frontend errors

## Key Benefits

✅ No new tables - uses existing schema
✅ Database-level protection via unique index
✅ Automatic duplicate account deletion
✅ Full audit trail of all connection attempts
✅ Organizations data collected for future fraud detection
✅ Seamless account switching feature
✅ Multi-layer security (DB, webhook, backend, frontend)
✅ Supports legitimate use cases (personal + business LinkedIn)

## Important Notes

- The system tracks LinkedIn by `linkedin_public_identifier` (URL slug)
- Users with personal AND business LinkedIn profiles can use both
- Only blocks SAME LinkedIn profile on DIFFERENT user accounts
- Disconnecting releases the unique constraint (allows reconnection)
- All events logged to `webhook_events` for monitoring
- Organizations data collected but not actively used yet
