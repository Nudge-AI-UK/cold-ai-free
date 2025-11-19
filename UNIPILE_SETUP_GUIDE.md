# Unipile Outreach Sequences - Setup Guide

## 🎯 What We've Built

You now have a complete LinkedIn outreach automation system that:
- ✅ Searches for prospects on LinkedIn
- ✅ Sends connection requests with personalized messages
- ✅ Automatically follows up after connections are accepted
- ✅ Respects LinkedIn rate limits (80-100 requests/day)
- ✅ Schedules sends to appear human-like
- ✅ Tracks all activity in your database

---

## 📋 Step-by-Step Setup

### 1. Get Your Unipile API Key

1. Go to https://unipile.com and sign up
2. Navigate to your dashboard
3. Copy your API key
4. Save it somewhere safe

### 2. Configure Supabase Secrets

Run these commands in your terminal:

```bash
cd /Users/philip/Desktop/cold-ai-outreach-hub/cold-ai-free

# Set Unipile API credentials
supabase secrets set UNIPILE_API_URL=https://api.unipile.com
supabase secrets set UNIPILE_API_KEY=your_actual_key_here
```

### 3. Run Database Migrations

```bash
# Apply the outreach sequences schema
supabase db push

# Or if that doesn't work:
supabase migration up
```

This creates three new tables:
- `outreach_sequences` - Your campaigns
- `sequence_prospects` - Individual targets
- `sequence_messages` - Message tracking

### 4. Deploy Edge Functions

```bash
# Deploy the LinkedIn search function
supabase functions deploy linkedin-search

# Deploy the sequence scheduler
supabase functions deploy sequence-scheduler
```

### 5. Set Up Cron Job (Scheduler)

The sequence scheduler needs to run every 5-10 minutes to send messages.

**Option A: Supabase Cron (Recommended)**
1. Go to your Supabase Dashboard
2. Navigate to Database → Cron Jobs
3. Create a new cron job:
   - **Name**: `sequence-scheduler`
   - **Schedule**: `*/5 * * * *` (every 5 minutes)
   - **Command**:
   ```sql
   SELECT
     net.http_post(
       url:='https://your-project-ref.supabase.co/functions/v1/sequence-scheduler',
       headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb
     ) as request_id;
   ```

**Option B: External Cron (cron-job.org, etc.)**
- URL: `https://your-project-ref.supabase.co/functions/v1/sequence-scheduler`
- Method: POST
- Interval: Every 5 minutes
- Headers: `Authorization: Bearer YOUR_SERVICE_ROLE_KEY`

---

## 🚀 How to Use

### Creating Your First Sequence

```typescript
// Example: Create a connection request sequence
const { data, error } = await supabase
  .from('outreach_sequences')
  .insert({
    user_id: userId,
    sequence_name: 'Software Engineer Outreach - Q1 2025',
    sequence_type: 'connection_request',
    status: 'draft', // Start as draft
    message_template: `Hi {firstName},

I noticed your experience in {company}. I'm working on something that could help engineering teams ship faster.

Would you be open to a quick chat?

Best,
Philip`,
    follow_up_messages: [
      {
        delay_days: 3,
        message: `Hi {firstName}, just following up on my previous message. Would love to connect!`
      }
    ],
    daily_limit: 50, // Send max 50/day
    delay_between_min: 5, // Wait 5-15 min between sends
    delay_between_max: 15,
    icp_id: yourIcpId // Optional: link to ICP
  })
```

### Adding Prospects to Sequence

```typescript
// Option 1: Search LinkedIn and add results
const searchResponse = await supabase.functions.invoke('linkedin-search', {
  body: {
    user_id: userId,
    search_query: 'software engineer',
    filters: {
      location: 'San Francisco',
      title: 'Senior Engineer'
    },
    limit: 100
  }
})

const prospects = searchResponse.data.prospects

// Option 2: Manually add prospects
const { error } = await supabase
  .from('sequence_prospects')
  .insert(
    prospects.map((p, index) => ({
      sequence_id: sequenceId,
      user_id: userId,
      linkedin_url: p.linkedin_url,
      linkedin_public_id: p.public_identifier,
      linkedin_messaging_id: p.messaging_id,
      prospect_name: p.name,
      prospect_headline: p.headline,
      prospect_company: p.company,
      status: 'pending',
      // Schedule sends throughout the day
      scheduled_for: new Date(Date.now() + index * 15 * 60 * 1000).toISOString()
    }))
  )
```

### Activating a Sequence

```typescript
// Once prospects are added and scheduled, activate it
await supabase
  .from('outreach_sequences')
  .update({ status: 'active', started_at: new Date().toISOString() })
  .eq('id', sequenceId)

// The cron job will now start sending automatically!
```

---

## 📊 Monitoring & Analytics

### Check Sequence Progress

```typescript
const { data: sequence } = await supabase
  .from('outreach_sequences')
  .select(`
    *,
    sequence_prospects(
      status,
      connection_accepted,
      response_received
    )
  `)
  .eq('id', sequenceId)
  .single()

console.log(`Sequence: ${sequence.sequence_name}`)
console.log(`Sent: ${sequence.sent_count}/${sequence.total_targets}`)
console.log(`Accepted: ${sequence.accepted_count}`)
console.log(`Replied: ${sequence.replied_count}`)
```

### View All Messages

```typescript
const { data: messages } = await supabase
  .from('sequence_messages')
  .select(`
    *,
    sequence_prospects(prospect_name, linkedin_url)
  `)
  .eq('sequence_id', sequenceId)
  .order('sent_at', { ascending: false })
```

---

## ⚠️ Important Rate Limits

LinkedIn enforces strict rate limits. Respect them or risk account suspension:

| Action | Daily Limit | Weekly Limit |
|--------|-------------|--------------|
| Connection Requests | 80-100 | 200 |
| Messages (to connections) | 100-150 | - |
| InMails | 50 | - |
| Profile Views | 100-200 | - |

**Best Practices:**
- ✅ Start with 30-50 requests/day, gradually increase
- ✅ Add 5-15 minute delays between sends
- ✅ Only send during business hours (9am-5pm)
- ✅ Take weekends off
- ✅ Personalize every message
- ❌ Don't spam the same message
- ❌ Don't send at odd hours (late night/early morning)
- ❌ Don't exceed 100 requests/day

---

## 🐛 Troubleshooting

### "LinkedIn account not connected"
- Make sure user has connected LinkedIn via Settings
- Check `user_profiles` table for `linkedin_connected = true`

### "Unipile API not configured"
- Verify secrets are set: `supabase secrets list`
- Re-deploy functions after setting secrets

### Messages not sending
- Check cron job is running: Look for function logs
- Verify prospects have `status = 'scheduled'` and `scheduled_for <= NOW()`
- Check daily limits haven't been exceeded in `usage_tracking` table

### Profile search fails
- The Unipile search API requires Sales Navigator for advanced filters
- Basic search works with free LinkedIn accounts

---

## 🔧 Advanced Features

### Custom Scheduling Logic

Edit the `sequence-scheduler` function to add:
- Skip weekends: Check `new Date().getDay()` before sending
- Business hours only: Check `getHours()` is between 9-17
- Timezone-aware scheduling
- A/B testing different message variations

### Webhook Integration

You can set up a webhook to receive updates when:
- Connection requests are accepted
- Prospects reply to messages
- Messages fail to send

Add to `unipile-webhook` function to handle these events.

---

## 📝 Next Steps

1. **Test with small batch**: Start with 10-20 prospects
2. **Monitor results**: Check acceptance rates, reply rates
3. **Optimize messaging**: A/B test different templates
4. **Scale gradually**: Increase daily limit as you gain confidence
5. **Build UI**: Create React components for sequence management

---

## 🎨 UI Component Example

```tsx
// SequenceDashboard.tsx
export function SequenceDashboard() {
  const [sequences, setSequences] = useState([])

  useEffect(() => {
    async function loadSequences() {
      const { data } = await supabase
        .from('outreach_sequences')
        .select('*, sequence_prospects(count)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      setSequences(data)
    }
    loadSequences()
  }, [])

  return (
    <div>
      <h1>Outreach Sequences</h1>
      {sequences.map(seq => (
        <div key={seq.id}>
          <h3>{seq.sequence_name}</h3>
          <p>Status: {seq.status}</p>
          <p>Progress: {seq.sent_count}/{seq.total_targets}</p>
          <p>Acceptance Rate: {((seq.accepted_count / seq.sent_count) * 100).toFixed(1)}%</p>
        </div>
      ))}
    </div>
  )
}
```

---

## 📚 Resources

- **Unipile Docs**: https://developer.unipile.com/docs
- **Unipile API Reference**: https://developer.unipile.com/reference
- **LinkedIn Best Practices**: https://business.linkedin.com/sales-solutions/resources

---

## ✅ Checklist

Before going live, ensure:

- [ ] Unipile API key is set in Supabase secrets
- [ ] Database migrations have been applied
- [ ] All 3 edge functions are deployed
- [ ] Cron job is configured and running
- [ ] User has connected LinkedIn account
- [ ] Test sequence created with 5-10 test prospects
- [ ] First few messages sent successfully
- [ ] Rate limits are configured conservatively (start low!)

---

**Questions? Issues?** Check the Supabase function logs for detailed error messages.
