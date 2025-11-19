# Deployment Checklist - Delete Account & Bug Fixes

## ✅ Completed

### Database
- [x] Ran SQL alterations for account_status columns
- [x] Updated get_pending_hard_deletions() function
- [x] Added indexes for pending deletion queries

### Edge Functions
- [x] Deployed `request-account-deletion` (soft delete with Unipile cleanup)
- [x] Deployed `unipile-delete-account` (unchanged)

### Frontend Changes
- [x] Fixed MessageWidget send button (uses pending_scheduled)
- [x] Fixed ProspectModal send button (uses pending_scheduled)
- [x] Added DeleteAccountModal component
- [x] Added delete button to Header dropdown
- [x] Updated LoginPage for account recovery
- [x] Softened widget transition animation
- [x] Clarified delete modal 30-day recovery messaging

### Backend Services
- [x] Created accountDeletionService.ts

## 🔄 Pending

### n8n Workflow Setup
- [ ] Create "Account Hard Deletion Cleanup" workflow
- [ ] Set daily schedule (2 AM UTC)
- [ ] Add nodes per N8N_HARD_DELETION_WORKFLOW.md
- [ ] Test with manual execution
- [ ] Verify deletion in database

## 📋 n8n Setup Summary

**Follow the guide in:** `N8N_HARD_DELETION_WORKFLOW.md`

**Quick setup:**
1. Create new workflow
2. Add Schedule Trigger (daily 2 AM UTC)
3. Add Supabase node: `SELECT * FROM get_pending_hard_deletions();`
4. Add IF node: Check if results > 0
5. Add Loop/Split In Batches
6. Add Supabase node: Execute hard delete SQL
7. Add Supabase node: Mark as hard deleted
8. Test manually

## 🧪 Testing Plan

### Test Delete Account Flow
1. Create test account
2. Click "Delete Account" in header dropdown
3. Verify:
   - [ ] Modal shows 30-day recovery info
   - [ ] Must type "DELETE" to confirm
   - [ ] User signed out after confirmation
   - [ ] User can sign back in to recover
   - [ ] Account status returns to 'active' on recovery
   - [ ] Unipile account was deleted

### Test Limit Abuse Prevention
1. Delete account
2. Try to create fresh account with same email
3. Verify:
   - [ ] Signup allowed
   - [ ] Shows "Account recovered" message
   - [ ] Previous usage limits restored (not reset)

### Test n8n Hard Deletion
1. Manually set soft_delete_until to yesterday for test account
2. Run n8n workflow manually
3. Verify:
   - [ ] All user data deleted from database
   - [ ] Auth user deleted
   - [ ] deleted_accounts marked as hard_deleted = true
   - [ ] User cannot sign in anymore

## 🚀 Ready to Deploy

All code changes are ready to commit and push to testing branch.

**Next steps:**
1. Commit changes
2. Push to testing
3. Set up n8n workflow
4. Test complete flow
