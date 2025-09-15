# Setting Up Cold AI Free with Your Existing Supabase

This guide helps you connect the Cold AI Free app to your existing Supabase database that's already being used by your main Cold AI app.

## 📋 Prerequisites

- Your existing Supabase project credentials
- Access to run SQL migrations in Supabase
- Node.js 18+ installed locally

## 🔧 Step-by-Step Setup

### 1. Clone and Install

```bash
git clone https://github.com/Nudge-AI-UK/cold-ai-free.git
cd cold-ai-free
npm install
```

### 2. Configure Environment Variables

Create a `.env.local` file with your existing Supabase credentials:

```bash
# Copy from your main app's environment
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Free app specific settings
VITE_APP_VERSION=free
VITE_APP_URL=https://free.coldai.uk
VITE_UPGRADE_URL=https://app.coldai.uk

# Free tier limits
VITE_MAX_FREE_MESSAGES=25
VITE_MAX_FREE_ICPS=1
VITE_MAX_FREE_KNOWLEDGE_ENTRIES=1
```

### 3. Update Your Database

Since you're using an existing database, you need to update it to support both apps:

#### Option A: Quick Setup (Minimal Changes)
If your database already has all the tables from the main app, you only need to update the RLS policies:

1. Go to your Supabase Dashboard → SQL Editor
2. Run the migration from `supabase/migrations/002_shared_database.sql`
3. This will:
   - Update RLS policies to enforce free tier limits
   - Add message limit checking
   - Create helper functions

#### Option B: Full Setup (If Tables Don't Exist)
If any tables are missing, first run:
1. `supabase/migrations/001_initial_schema.sql` (skip existing tables)
2. Then `supabase/migrations/002_shared_database.sql`

### 4. Test Locally

```bash
npm run dev
```

Visit `http://localhost:5174` to test the app.

### 5. Deploy to Production

#### Using Vercel:
```bash
vercel --prod
```

#### Using Netlify:
```bash
netlify deploy --prod
```

#### Manual Build:
```bash
npm run build
# Upload dist folder to your hosting
```

## 🔍 How It Works

### User Flow
1. **New Users on Free App**: 
   - Sign up → Created with `plan_type: 'free'`
   - Automatically limited to 25 messages/month
   - Can only create 1 ICP and 1 Knowledge entry

2. **Existing Users from Main App**:
   - Can sign in with existing credentials
   - If they're on free plan: Same limits apply
   - If they're on paid plan: Consider redirecting to main app

3. **Upgrade Path**:
   - Users click upgrade → Redirected to main app
   - Main app handles payment and plan upgrade
   - User can then use full features in main app

### Database Sharing Strategy

The apps share the same database but distinguish users by:
- **plan_type**: 'free', 'basic', 'standard', 'pro', 'team'
- **RLS Policies**: Enforce limits based on plan_type
- **Usage Tracking**: Monthly limits reset automatically

### Important Tables

| Table | Purpose | Free Tier Limit |
|-------|---------|-----------------|
| profiles | User profile info | Unlimited |
| company_profiles | Company details | Unlimited |
| communication_preferences | Message style | Unlimited |
| knowledge_base | Product/service info | 1 entry |
| icps | Ideal Customer Profiles | 1 profile |
| prospects | Prospect tracking | 50 prospects |
| messages | Generated messages | 25/month |
| usage | Monthly usage tracking | Auto-created |
| subscriptions | Plan management | Auto-created |

## 🚨 Important Considerations

### RLS Policies
The free app relies on Row Level Security to enforce limits. Ensure RLS is enabled:

```sql
-- Check if RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public';
```

### Monthly Usage Reset
Usage records need to reset monthly. You can:
1. **Manual Reset**: Run this on the 1st of each month:
```sql
SELECT create_monthly_usage();
```

2. **Automatic Reset**: Enable pg_cron in Supabase and schedule it:
```sql
SELECT cron.schedule(
  'create-monthly-usage', 
  '0 0 1 * *',
  $$SELECT create_monthly_usage();$$
);
```

### Testing Different User Types

To test the app with different subscription tiers:

```sql
-- Make a user free tier
UPDATE subscriptions 
SET plan_type = 'free' 
WHERE user_id = 'user-uuid';

-- Reset their usage
UPDATE usage 
SET messages_sent = 0, messages_remaining = 25 
WHERE user_id = 'user-uuid' 
AND period_start <= CURRENT_DATE 
AND period_end >= CURRENT_DATE;
```

## 🔐 Security Notes

1. **Never expose service role key** in the free app
2. **Use anon key only** for client-side operations
3. **RLS policies** enforce all access control
4. **API rate limiting** recommended for production

## 📊 Monitoring

Monitor usage and performance:

```sql
-- Check free tier users
SELECT COUNT(*) FROM subscriptions WHERE plan_type = 'free';

-- Check message usage this month
SELECT 
  u.user_id,
  u.messages_sent,
  u.messages_remaining,
  s.plan_type
FROM usage u
JOIN subscriptions s ON u.user_id = s.user_id
WHERE u.period_start <= CURRENT_DATE 
AND u.period_end >= CURRENT_DATE
ORDER BY u.messages_sent DESC;

-- Check users hitting limits
SELECT * FROM usage 
WHERE messages_remaining = 0 
AND period_start <= CURRENT_DATE 
AND period_end >= CURRENT_DATE;
```

## 🆘 Troubleshooting

### "User has no subscription"
Run: `SELECT create_monthly_usage();` to create missing records

### "Monthly limit reached"
Check usage table and reset if needed for testing

### "Can't create second ICP/Knowledge entry"
This is by design for free tier. Check user's plan_type.

### RLS Policy Errors
Ensure all policies from migration 002 are applied

## 📚 Next Steps

1. **Set up domain**: Point free.coldai.uk to your deployment
2. **Configure SSL**: Ensure HTTPS is enabled
3. **Set up monitoring**: Use Supabase's built-in monitoring
4. **Email templates**: Customize auth emails in Supabase
5. **Analytics**: Add tracking for conversion from free to paid

## Support

For issues or questions:
- GitHub Issues: [cold-ai-free/issues](https://github.com/Nudge-AI-UK/cold-ai-free/issues)
- Main App Repo: [cold-ai-outreach-hub](https://github.com/Nudge-AI-UK/cold-ai-outreach-hub)