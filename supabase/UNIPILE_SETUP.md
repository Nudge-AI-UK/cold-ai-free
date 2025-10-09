# Unipile Integration Setup Guide

This guide walks you through setting up secure Unipile LinkedIn integration with Supabase Edge Functions.

## 🔧 Prerequisites

1. **Supabase CLI installed** - [Install Guide](https://supabase.com/docs/guides/cli)
2. **Unipile Account** - Sign up at [unipile.com](https://unipile.com)
3. **Unipile API Key** - Get from your Unipile dashboard

## 🚀 Deployment Steps

### 1. Login to Supabase CLI
```bash
supabase login
```

### 2. Link to your Supabase project
```bash
supabase link --project-ref YOUR_PROJECT_REF
```
*Replace `YOUR_PROJECT_REF` with your actual Supabase project reference*

### 3. Set Supabase Secrets (Production)
```bash
# Set your Unipile API credentials
supabase secrets set UNIPILE_API_KEY="your_unipile_api_key_here"
supabase secrets set UNIPILE_API_URL="https://apiXXX.unipile.com:XXX"

# Verify secrets are set
supabase secrets list
```

### 4. Deploy Edge Functions
```bash
# Deploy the auth function
supabase functions deploy unipile-auth

# Deploy the webhook function
supabase functions deploy unipile-webhook
```

### 5. Update Environment Variables
Add to your `.env` file:
```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## 🔐 Security Features

- ✅ **API Key Protection** - Stored securely in Supabase secrets
- ✅ **Server-side Processing** - All Unipile calls happen on Edge Functions
- ✅ **Authentication Required** - Users must be logged in to connect LinkedIn
- ✅ **CORS Configured** - Proper cross-origin handling
- ✅ **Webhook Security** - Callbacks handled server-side only

## 🧪 Testing

### Local Development
```bash
# Start Supabase locally (optional)
supabase start

# Test the auth function
curl -i --location --request POST 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/unipile-auth' \
  --header 'Authorization: Bearer YOUR_USER_TOKEN' \
  --header 'Content-Type: application/json' \
  --data '{
    "type": "create",
    "providers": ["LINKEDIN"],
    "api_url": "https://api.unipile.com",
    "expiresOn": "2024-12-22T12:00:00.701Z",
    "userId": "test-user-123"
  }'
```

### Frontend Testing
1. Login to your app
2. Click "Connect LinkedIn" in the widget
3. Complete authentication in popup window
4. Check user profile in Supabase dashboard

## 📊 Database Schema

The integration uses the `user_profiles` table:

```sql
-- Columns used for LinkedIn integration
linkedin_connected: boolean
linkedin_account_id: text
linkedin_username: text
linkedin_url: text
```

## 🔄 Webhook Flow

1. User completes LinkedIn auth in Unipile popup
2. Unipile sends webhook to `/functions/v1/unipile-webhook`
3. Edge Function updates `user_profiles` table
4. Frontend automatically refreshes connection status

## 🐛 Troubleshooting

### Edge Function Errors
```bash
# Check function logs
supabase functions logs unipile-auth
supabase functions logs unipile-webhook
```

### Common Issues
- **401 Unauthorized** - Check user authentication token
- **500 Internal Error** - Verify Unipile API key is set correctly
- **CORS Errors** - Ensure functions are deployed with correct headers

### Debug Mode
Add console logs in Edge Functions and monitor with:
```bash
supabase functions logs --follow
```

## 📚 Documentation Links

- [Unipile Hosted Auth Docs](https://developer.unipile.com/docs/hosted-auth)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [Supabase Secrets Management](https://supabase.com/docs/guides/cli/secrets)