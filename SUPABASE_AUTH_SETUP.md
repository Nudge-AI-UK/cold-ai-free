# Supabase Authentication Setup Guide

This guide covers setting up SMTP, CAPTCHA, and social logins for your Supabase project.

---

## 1. Mailchimp SMTP Setup

### Step 1: Get Mailchimp SMTP Credentials
1. Log in to your Mailchimp account
2. Go to **Account** → **Settings** → **Extras** → **SMTP & API**
3. Create a new SMTP username and password
4. Note down your credentials:
   - **SMTP Server**: `smtp.mandrillapp.com`
   - **Port**: `587` (or `2525`)
   - **Username**: Your Mailchimp username
   - **Password**: Your Mandrill API key

### Step 2: Configure Supabase SMTP
1. Go to your Supabase project dashboard
2. Navigate to **Authentication** → **Email Templates**
3. Scroll down to **SMTP Settings**
4. Enable **Custom SMTP**
5. Fill in the settings:
   ```
   Host: smtp.mandrillapp.com
   Port: 587
   Username: [Your Mailchimp SMTP username]
   Password: [Your Mandrill API key]
   Sender email: noreply@yourdomain.com
   Sender name: Cold AI
   ```
6. Click **Save**

### Step 3: Verify Domain (Optional but Recommended)
1. In Mailchimp, add and verify your sending domain
2. Add the required DNS records (SPF, DKIM, DMARC)
3. This improves email deliverability

---

## 2. Cloudflare Turnstile CAPTCHA Setup

### Step 1: Get Turnstile Keys
1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Select **Turnstile** from the sidebar
3. Create a new site
4. Choose **Managed** mode
5. Add your domain(s):
   - `localhost` (for development)
   - `yourdomain.com` (for production)
6. Copy your:
   - **Site Key** (public)
   - **Secret Key** (private)

### Step 2: Configure Supabase
1. Go to Supabase dashboard → **Authentication** → **Settings**
2. Scroll to **Security and Protection**
3. Enable **CAPTCHA Protection**
4. Select **Turnstile** as the provider
5. Enter your **Secret Key**
6. Click **Save**

### Step 3: Add Environment Variable
Add to your `.env.local`:
```env
NEXT_PUBLIC_TURNSTILE_SITE_KEY=your_site_key_here
```

---

## 3. Apple Sign In

### Step 1: Apple Developer Setup
1. Go to [Apple Developer](https://developer.apple.com/)
2. Navigate to **Certificates, Identifiers & Profiles**
3. Click **Identifiers** → **+** to create a new App ID
4. Select **App IDs** → **Continue**
5. Select **App** → **Continue**
6. Fill in:
   - **Description**: Cold AI
   - **Bundle ID**: `com.coldai.app` (or your choice)
7. Enable **Sign in with Apple**
8. Click **Continue** → **Register**

### Step 2: Create Service ID
1. Go back to **Identifiers** → **+**
2. Select **Services IDs** → **Continue**
3. Fill in:
   - **Description**: Cold AI Web
   - **Identifier**: `com.coldai.service` (must be different from App ID)
4. Enable **Sign in with Apple**
5. Click **Configure**
6. Add domains and redirect URLs:
   - **Domains**: `yourdomain.com`
   - **Redirect URLs**: `https://[your-project-ref].supabase.co/auth/v1/callback`
   - For development, also add: `http://localhost:3000/auth/v1/callback` (if supported)
7. Click **Save** → **Continue** → **Register**

### Step 3: Create Private Key
1. Go to **Keys** → **+**
2. Fill in:
   - **Key Name**: Cold AI Sign In Key
3. Enable **Sign in with Apple**
4. Click **Configure** → Select your Service ID
5. Click **Save** → **Continue** → **Register**
6. **Download the .p8 key file** (you can only download once!)
7. Note your **Key ID** (10 characters)

### Step 4: Configure Supabase
1. Go to Supabase dashboard → **Authentication** → **Providers**
2. Find **Apple** and click to expand
3. Enable **Apple**
4. Fill in:
   - **Services ID**: Your Service ID (e.g., `com.coldai.service`)
   - **Team ID**: Found in Apple Developer account (top right)
   - **Key ID**: From the key you created
   - **Private Key**: Contents of the .p8 file you downloaded
5. Click **Save**

---

## 4. LinkedIn Sign In

### Step 1: Create LinkedIn App
1. Go to [LinkedIn Developers](https://www.linkedin.com/developers/apps)
2. Click **Create app**
3. Fill in:
   - **App name**: Cold AI
   - **LinkedIn Page**: Select your company page (or create one)
   - **Privacy policy URL**: Your privacy policy URL
   - **App logo**: Upload your logo
4. Click **Create app**

### Step 2: Configure OAuth Settings
1. In your app, go to **Auth** tab
2. Under **OAuth 2.0 settings**:
   - Add **Authorized redirect URLs for your app**:
     ```
     https://[your-project-ref].supabase.co/auth/v1/callback
     ```
3. Under **OAuth 2.0 scopes**, request:
   - `openid`
   - `profile`
   - `email`
4. Click **Update**

### Step 3: Get Credentials
1. Go to **Auth** tab
2. Copy your:
   - **Client ID**
   - **Client Secret**

### Step 4: Configure Supabase
1. Go to Supabase dashboard → **Authentication** → **Providers**
2. Find **LinkedIn** and expand
3. Enable **LinkedIn (OIDC)**
4. Fill in:
   - **Client ID**: From LinkedIn
   - **Client Secret**: From LinkedIn
5. Click **Save**

---

## 5. Notion Sign In

### Step 1: Create Notion Integration
1. Go to [Notion Integrations](https://www.notion.so/my-integrations)
2. Click **+ New integration**
3. Fill in:
   - **Name**: Cold AI
   - **Associated workspace**: Select your workspace
   - **Logo**: Upload your logo
4. Under **Capabilities**:
   - Enable **Read user information including email addresses**
5. Click **Submit**

### Step 2: Get OAuth Credentials
1. In your integration settings, scroll to **OAuth Domain & URIs**
2. Add **Redirect URIs**:
   ```
   https://[your-project-ref].supabase.co/auth/v1/callback
   ```
3. Copy your:
   - **OAuth client ID**
   - **OAuth client secret**

### Step 3: Configure Supabase
1. Go to Supabase dashboard → **Authentication** → **Providers**
2. Find **Notion** and expand
3. Enable **Notion**
4. Fill in:
   - **Client ID**: From Notion
   - **Client Secret**: From Notion
5. Click **Save**

---

## 6. Update Environment Variables

Add to your `.env.local`:
```env
# Turnstile CAPTCHA
NEXT_PUBLIC_TURNSTILE_SITE_KEY=your_turnstile_site_key

# Supabase (if not already present)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

---

## 7. Testing

### Test SMTP
1. Try signing up with a new email
2. Check if you receive the confirmation email
3. Verify the email comes from your custom sender

### Test CAPTCHA
1. Try signing up/in and verify Turnstile challenge appears
2. Complete the challenge and ensure auth works

### Test Social Logins
1. Try each social login provider
2. Verify user data is correctly captured
3. Check users table in Supabase dashboard

---

## Important Notes

- **Apple Sign In** is the most complex - make sure to save your .p8 key file securely
- **LinkedIn** requires a company page to create an app
- **Notion** sign in gives access to user's Notion data (use responsibly)
- Always test in development before deploying to production
- Keep all credentials secure and never commit them to version control

---

## Troubleshooting

### SMTP not working
- Verify Mailchimp/Mandrill account is active
- Check spam folder for test emails
- Verify DNS records if using custom domain

### CAPTCHA not appearing
- Check site key is correct
- Verify domain is added in Turnstile settings
- Clear browser cache

### Social login fails
- Verify redirect URLs match exactly (including protocol)
- Check provider credentials are correct
- Ensure scopes/permissions are granted

---

## Next Steps After Setup

Once everything is configured, you may want to:
1. Customize email templates in Supabase
2. Set up rate limiting
3. Configure password requirements
4. Set up email link validation expiry
5. Add user metadata fields as needed
