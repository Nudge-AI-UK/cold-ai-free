# Auth Security Setup Guide

This document outlines the authentication security features implemented in Cold AI Free, including rate limiting, account lockouts, and password reset functionality.

## Features Implemented

### 1. ✅ Rate Limiting & Account Lockout
- Tracks failed login attempts per email
- Locks account after 5 failed attempts within 15 minutes
- Lockout duration: 30 minutes
- Automatic unlock after password reset

### 2. ✅ Password Reset Flow
- Secure email-based password reset
- Token validation with expiry
- Automatic account unlock on reset
- Beautiful UI with password match validation

### 3. ✅ Google SSO
- Already configured and working
- OAuth2 flow with offline access
- Seamless user experience

### 4. ⏳ 2FA/MFA (Next to implement)
- Supabase native TOTP support
- Optional user enrollment
- QR code setup
- Backup codes

## Database Setup

### Step 1: Run Migration

The migration file `003_auth_security.sql` creates the necessary tables and functions.

```bash
# Apply the migration
supabase db push

# Or manually run:
psql YOUR_DATABASE_URL < supabase/migrations/003_auth_security.sql
```

### Tables Created:
- `auth_login_attempts` - Tracks all login attempts
- `auth_account_lockouts` - Manages account lockouts

### Functions Created:
- `is_account_locked(p_email)` - Check if account is locked
- `record_login_attempt(...)` - Record login attempt
- `lock_account(...)` - Lock an account
- `unlock_account(p_email)` - Unlock an account
- `get_failed_attempts_count(...)` - Get failed attempt count
- `cleanup_old_login_attempts()` - Cleanup old records

## Edge Function Setup

### Step 2: Deploy Edge Function

Deploy the rate limiting edge function:

```bash
supabase functions deploy check-login-rate-limit
```

### Environment Variables Required:
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key for database operations

These are automatically available in Supabase edge functions.

## Configuration

### Rate Limiting Settings

In `supabase/functions/check-login-rate-limit/index.ts`:

```typescript
const MAX_FAILED_ATTEMPTS = 5      // Lock after 5 failed attempts
const LOCKOUT_DURATION_MINUTES = 30 // Lock for 30 minutes
const ATTEMPT_WINDOW_MINUTES = 15   // Count attempts in last 15 minutes
```

Adjust these constants based on your security requirements:
- **More strict**: Lower `MAX_FAILED_ATTEMPTS` to 3
- **More lenient**: Increase to 7-10 attempts
- **Longer lockout**: Increase `LOCKOUT_DURATION_MINUTES` to 60

### Password Reset Configuration

In Supabase Dashboard:
1. Go to Authentication → Email Templates
2. Customize the "Reset Password" email template
3. Ensure `SITE_URL` environment variable is set correctly

## Testing

### Test Rate Limiting

1. **Failed Login Test**:
```bash
# Try logging in with wrong password 5 times
# Expected: Account locked message
```

2. **Lockout Duration Test**:
```bash
# Get locked out
# Wait 30 minutes
# Try logging in
# Expected: Login should work
```

3. **Password Reset Unlock**:
```bash
# Get locked out
# Request password reset
# Account should be immediately unlocked
```

### Test Password Reset

1. Click "Forgot your password?" on login page
2. Enter email address
3. Check email for reset link
4. Click link (opens `/reset-password` page)
5. Enter new password
6. Verify redirect to login with new password

## Security Best Practices

### ✅ Already Implemented:
- JWT token authentication (Supabase handled)
- Secure session cookies (7-day expiry)
- HTTPS enforced
- Email verification on signup
- Password minimum length (6 characters)
- Rate limiting on login attempts
- Account lockout protection
- Secure password reset flow

### 🔒 Recommended Additional Steps:

1. **Enable Email Rate Limiting** in Supabase Dashboard:
   - Go to Authentication → Rate Limits
   - Set limits for signup, login, password reset

2. **Configure CAPTCHA** (optional):
   - Supabase supports hCaptcha/reCAPTCHA
   - Add to login form after 2-3 failed attempts

3. **Monitor Login Attempts**:
   ```sql
   -- Query to see recent failed attempts
   SELECT email, COUNT(*) as failed_attempts,
          MAX(attempt_time) as last_attempt
   FROM auth_login_attempts
   WHERE success = FALSE
     AND attempt_time > NOW() - INTERVAL '1 hour'
   GROUP BY email
   ORDER BY failed_attempts DESC;
   ```

4. **Set up Cleanup Cron**:
   ```sql
   -- Run cleanup weekly
   SELECT cron.schedule(
     'cleanup-login-attempts',
     '0 0 * * 0',  -- Every Sunday at midnight
     $$SELECT cleanup_old_login_attempts()$$
   );
   ```

## Monitoring & Alerts

### Key Metrics to Track:

1. **Login Failure Rate**:
```sql
SELECT
  DATE(attempt_time) as date,
  COUNT(*) FILTER (WHERE success = FALSE) as failures,
  COUNT(*) FILTER (WHERE success = TRUE) as successes,
  ROUND(100.0 * COUNT(*) FILTER (WHERE success = FALSE) / COUNT(*), 2) as failure_rate
FROM auth_login_attempts
WHERE attempt_time > NOW() - INTERVAL '7 days'
GROUP BY DATE(attempt_time)
ORDER BY date DESC;
```

2. **Active Lockouts**:
```sql
SELECT email, locked_until, failed_attempts
FROM auth_account_lockouts
WHERE locked_until > NOW()
ORDER BY locked_until DESC;
```

3. **Password Reset Requests**:
```sql
-- Check Auth logs in Supabase Dashboard
-- Look for 'password_recovery' events
```

## Troubleshooting

### Issue: Edge function not working

**Solution**:
```bash
# Check edge function logs
supabase functions logs check-login-rate-limit

# Redeploy if needed
supabase functions deploy check-login-rate-limit
```

### Issue: Account stuck in lockout

**Manual unlock**:
```sql
-- Unlock specific account
SELECT unlock_account('user@example.com');
```

### Issue: Password reset email not arriving

**Checklist**:
1. Check Supabase Dashboard → Authentication → Email Templates
2. Verify SMTP configuration
3. Check spam folder
4. Verify `SITE_URL` environment variable

### Issue: Rate limit check failing but login still works

This is **by design**. The system "fails open" to ensure availability. If the rate limiting check fails, login is still allowed to prevent legitimate users from being locked out due to system errors.

## Next Steps: 2FA/MFA

To complete the security implementation, add Two-Factor Authentication:

1. **Enrolment UI in Settings**: QR code scanner, backup codes
2. **Verification during Login**: TOTP code input
3. **Recovery Options**: Backup codes, email recovery

See `2FA_IMPLEMENTATION.md` (to be created) for detailed instructions.

## Support

For issues or questions:
- Check Supabase Auth documentation
- Review edge function logs
- Test with Supabase CLI locally before deploying

---

**Last Updated**: 2025-10-16
**Version**: 1.0.0
