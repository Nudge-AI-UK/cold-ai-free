# Delete Account Feature - Implementation Summary

## Overview
Implemented a secure account deletion system with 30-day soft delete period to prevent abuse of monthly free tier limits.

## Key Security Feature
**Prevents Limit Abuse:** Users cannot delete their account and immediately sign up again to bypass monthly message limits. The system tracks deleted accounts by email hash for 30 days.

## Architecture

### Database (Migration: `20250111_account_deletion.sql`)
**Table: `deleted_accounts`**
- `email_hash` (SHA-256) - Anonymized email for privacy
- `soft_delete_until` - 30 days from deletion
- `messages_sent_total` - Usage at deletion for limit restoration
- `icps_created_total`, `knowledge_entries_total`, `prospects_created_total`

**Functions:**
- `check_email_deletion_history(email)` - Checks if email was previously deleted
- `get_pending_hard_deletions()` - Returns accounts ready for hard delete (for n8n cron)
- `mark_account_hard_deleted(id)` - Marks record as hard deleted

### Backend (Edge Function: `request-account-deletion`)
**Handles:**
1. Calculates total usage metrics
2. Hashes email (SHA-256)
3. Inserts record into `deleted_accounts` with 30-day expiry
4. Deletes all user data immediately:
   - LinkedIn/Unipile integration
   - Messages, prospects, sequences
   - ICPs, knowledge base
   - User profiles, preferences
   - Auth account
5. Returns soft delete expiry date

### Frontend Components

#### `DeleteAccountModal.tsx`
- Warning about permanent deletion
- 30-day deletion notice
- Optional deletion reason dropdown
- Confirmation checkbox
- Type "DELETE" to confirm
- Red-themed danger UI

#### `Header.tsx`
- Added "Delete Account" button to profile dropdown
- Red styling to indicate danger
- Opens DeleteAccountModal

#### `accountDeletionService.ts`
- `requestDeletion(reason)` - Calls edge function
- `checkDeletionHistory(email)` - Checks if email was deleted

#### `LoginPage.tsx` (Signup Flow)
**Prevents Abuse:**
1. On signup, checks `check_email_deletion_history(email)`
2. **If deleted within 30 days:** Blocks signup, shows error with days remaining
3. **If deleted >30 days ago:** Allows signup, restores previous usage limits, shows welcome back message
4. **If never deleted:** Normal signup flow

## User Flow

### Deletion Flow
1. User clicks profile → "Delete Account"
2. Modal opens with warnings
3. User types "DELETE" and checks confirmation
4. Edge function:
   - Saves usage metrics to `deleted_accounts`
   - Deletes all user data
   - Deletes auth account
5. User signed out and redirected to login
6. **30-day waiting period begins**

### Re-signup Scenarios

**Scenario A: Deleted Within 30 Days**
```
User deletes account → Tries to sign up 5 days later
Result: ❌ Blocked
Message: "This email was recently deleted. You can create a new account in 25 days."
```

**Scenario B: Deleted >30 Days Ago**
```
User deletes account → Tries to sign up 35 days later
Result: ✅ Allowed
Behavior: Previous usage limits restored (e.g., 10 messages already used = start with 15 remaining)
Message: "Welcome back! Your usage limits have been restored from your previous account."
```

**Scenario C: Never Deleted**
```
New user signs up
Result: ✅ Allowed
Behavior: Fresh limits (25 messages, 1 ICP, 1 knowledge entry)
```

## n8n Integration (Required)

### Daily Cron Job
**Purpose:** Hard delete accounts after 30 days

**Workflow:**
1. Run daily at 2 AM UTC
2. Call `get_pending_hard_deletions()` function
3. For each account past `soft_delete_until`:
   - Already deleted from Supabase (done in edge function)
   - Call `mark_account_hard_deleted(id)` to update tracking
4. Log completion

**n8n Setup:**
```
Trigger: Schedule (daily at 2 AM UTC)
↓
Supabase Node: Call get_pending_hard_deletions()
↓
Loop through results
↓
For each: Call mark_account_hard_deleted(id)
↓
Log completion
```

## Security Benefits

✅ **Prevents Monthly Limit Abuse**
- Users can't delete/recreate accounts to get fresh monthly limits
- 30-day lockout ensures fair usage

✅ **GDPR Compliant**
- Email hashed (SHA-256) for privacy
- Data deleted immediately
- Tracking record auto-expires

✅ **User-Friendly**
- Clear warnings and confirmations
- No accidental deletions (type "DELETE" requirement)
- Limits restored if re-signup after 30 days

## Testing Checklist

- [ ] Delete account successfully
- [ ] Verify all data deleted from database
- [ ] Try to sign up with same email within 30 days (should fail)
- [ ] Try to sign up with same email after 30 days (should succeed with restored limits)
- [ ] n8n cron job marks accounts as hard deleted
- [ ] Modal validation (must type DELETE and check box)
- [ ] LinkedIn integration properly disconnected

## Files Created/Modified

**Created:**
- `supabase/migrations/20250111_account_deletion.sql`
- `supabase/functions/request-account-deletion/index.ts`
- `src/services/accountDeletionService.ts`
- `src/components/modals/DeleteAccountModal.tsx`

**Modified:**
- `src/components/layout/Header.tsx` - Added delete button
- `src/components/auth/LoginPage.tsx` - Added deletion history check
- `src/components/widgets/MessageWidget.tsx` - Fixed send button (separate fix)
- `src/components/modals/ProspectModal.tsx` - Fixed send button (separate fix)

## Additional Notes

- Soft delete = data deleted immediately, but can track within 30 days
- Hard delete = after 30 days, tracking record marked as complete
- Email hashing prevents PII storage while still enabling duplicate detection
- Usage limits carry over to prevent abuse but allow legitimate re-signups
