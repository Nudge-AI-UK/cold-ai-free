# Cold AI Browser Extension - Planning Document

> **Last Updated**: 2025-10-28
> **Status**: Planning Phase
> **Priority**: Medium - To be built after UI improvements

---

## 🎯 Project Overview

**Goal**: Create a browser extension that adds a "Message with Cold AI" button to LinkedIn profiles, enabling one-click prospect message generation.

**User Flow**:
1. User browses LinkedIn and finds a prospect
2. Clicks "Message with Cold AI" button on their profile
3. Extension extracts the LinkedIn URL
4. Sends to Cold AI backend (existing message generation pipeline)
5. Message is generated automatically
6. User can view/edit in Cold AI dashboard

---

## ✅ Technical Approach

### Framework: Plasmo
- **Why**: Modern, TypeScript-first, supports all browsers
- **Browser Support**: Chrome, Firefox, Edge, Safari, Opera, Brave
- **Build Command**: `plasmo build --target=chrome-mv3` (auto-compiles for each browser)

### Architecture (Simplified)
```
LinkedIn Profile Page
    ↓ (extract window.location.href)
Extension Content Script
    ↓ (send to background)
Extension Service Worker
    ↓ (POST request with auth token)
Existing API: /functions/v1/server-message-generate
    ↓
Your existing pipeline (research → ICP → generation)
```

### What Gets Sent to Backend
```json
{
  "user_id": "uuid-from-token",
  "prospect_data": {
    "linkedin_url": "https://linkedin.com/in/username"
  },
  "message_type": "first_message",
  "outreach_goal": "meeting",
  "product_id": null,  // uses user's default
  "icp_id": null       // uses user's default
}
```

**This is the exact same payload the MessageWidget sends!** No backend changes needed.

---

## 🔐 Authentication Strategy

### Simple Token Copy/Paste (Phase 1)

#### Cold AI Web App Changes Needed:
1. Add new "Extensions" tab in Settings page
2. Add "Generate Extension Token" button
3. Generate JWT token (long-lived, extension-specific)
4. Display token for user to copy
5. Show active tokens list
6. Add "Revoke Token" functionality

#### Extension Flow:
1. User opens extension popup
2. Enters token from Settings page
3. Extension validates token with backend
4. Stores in `chrome.storage.sync` (encrypted, syncs across devices)
5. Ready to use!

#### Token Storage:
- Stored in: `chrome.storage.sync` (syncs across user's devices)
- Format: JWT token
- Validation: Verify with backend on first use
- Expiry: Optional (recommend 90 days)

---

## 📦 Implementation Checklist

### Phase 1: Extension Core (Week 1)
- [ ] Set up Plasmo project
- [ ] Create content script for LinkedIn profile pages
- [ ] Inject "Message with Cold AI" button
- [ ] Extract LinkedIn profile URL
- [ ] Create background service worker
- [ ] Implement API call to `server-message-generate`
- [ ] Add loading/success/error states
- [ ] Create toast notifications

### Phase 2: Authentication (Week 1)
- [ ] Create extension popup UI
- [ ] Add token input field
- [ ] Validate token with backend
- [ ] Store token in `chrome.storage.sync`
- [ ] Handle token errors (expired, invalid, etc.)

### Phase 3: Backend Settings (Week 1)
- [ ] Add "Extensions" tab to Settings page
- [ ] Create "Generate Token" button
- [ ] Generate JWT token for extension use
- [ ] Display token for copying
- [ ] Add token management (list, revoke)
- [ ] Create API endpoint: `POST /api/extension/validate-token`

### Phase 4: Polish & Deploy (Week 2)
- [ ] Test on Chrome, Firefox, Edge
- [ ] Add extension icons (Cold AI logo)
- [ ] Write Chrome Web Store description
- [ ] Create promotional images
- [ ] Submit to Chrome Web Store
- [ ] Submit to Firefox Add-ons (optional)

---

## 🎨 UI/UX Design

### Button Design
```
┌────────────────────────────────┐
│  ⚡ Message with Cold AI       │
└────────────────────────────────┘
```
- **Color**: Gradient `#FBAE1C` → `#FC9109` (brand orange)
- **Position**: Next to LinkedIn's "Message" and "More" buttons
- **Style**: Rounded corners, matches LinkedIn button style

### Button States
- **Default**: Orange gradient, white text
- **Hover**: Darker orange (`#FC9109`), scale 1.02
- **Loading**: Spinner icon, "Generating..."
- **Success**: Green checkmark, "Message Queued ✓" (2s delay)
- **Error**: Red background, "Try Again"

### Extension Popup
```
┌─────────────────────────────────┐
│  Cold AI Extension              │
│                                 │
│  [Cold AI Logo]                 │
│                                 │
│  ┌───────────────────────────┐ │
│  │ Paste your token here     │ │
│  └───────────────────────────┘ │
│                                 │
│  [Validate Token]               │
│                                 │
│  Status: ⚠️ Not Connected       │
│                                 │
│  Get your token from:           │
│  Settings → Extensions          │
└─────────────────────────────────┘
```

---

## 🖥️ Code Structure

### Extension File Structure
```
cold-ai-extension/
├── manifest.json                    # Extension manifest (auto-generated by Plasmo)
├── package.json
├── tsconfig.json
│
├── contents/
│   └── linkedin-button.tsx          # Injects button on LinkedIn profiles
│
├── background/
│   └── messages/
│       └── add-prospect.ts          # Handles API calls to Cold AI backend
│
├── popup/
│   ├── index.tsx                    # Extension popup UI (token input)
│   └── styles.css                   # Popup styles
│
├── assets/
│   └── icon.png                     # Cold AI logo (128x128, 48x48, 16x16)
│
└── utils/
    ├── auth.ts                      # Token storage/validation
    └── api.ts                       # API helper functions
```

### Key Code Snippets

#### Content Script (linkedin-button.tsx)
```typescript
import { sendToBackground } from "@plasmohq/messaging"

// Runs on LinkedIn profile pages
const injectButton = () => {
  const actionsBar = document.querySelector('.pvs-profile-actions__action')

  const button = document.createElement('button')
  button.innerHTML = '⚡ Message with Cold AI'
  button.className = 'cold-ai-extension-button'
  button.onclick = handleAddProspect

  actionsBar?.appendChild(button)
}

const handleAddProspect = async () => {
  const linkedinUrl = window.location.href

  // Show loading state
  updateButtonState('loading')

  // Send to background script
  const response = await sendToBackground({
    name: "add-prospect",
    body: { linkedinUrl }
  })

  // Update UI based on response
  updateButtonState(response.success ? 'success' : 'error')
}
```

#### Background Service Worker (add-prospect.ts)
```typescript
export async function handler(req) {
  const { linkedinUrl } = req.body

  // Get stored auth token
  const { token } = await chrome.storage.sync.get('authToken')

  if (!token) {
    return { success: false, error: 'Not authenticated' }
  }

  // Call existing Cold AI endpoint
  const response = await fetch(
    'https://[your-supabase-url]/functions/v1/server-message-generate',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        prospect_data: { linkedin_url: linkedinUrl },
        message_type: 'first_message',
        outreach_goal: 'meeting',
        product_id: null,
        icp_id: null
      })
    }
  )

  return await response.json()
}
```

---

## 🔧 Backend Changes Required

### 1. Settings Page - New "Extensions" Tab

**Location**: `src/pages/SettingsPage.tsx` or create `src/components/settings/ExtensionsTab.tsx`

**Features**:
- "Generate Extension Token" button
- Display generated token in copyable input field
- List of active tokens (with created date)
- "Revoke Token" button for each token
- Instructions for installing extension

**Database Table** (optional, for token management):
```sql
CREATE TABLE extension_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(user_id) NOT NULL,
  token_hash TEXT NOT NULL,  -- hashed version for security
  name TEXT,  -- e.g., "Chrome - Work Laptop"
  created_at TIMESTAMP DEFAULT NOW(),
  last_used_at TIMESTAMP,
  revoked_at TIMESTAMP,
  expires_at TIMESTAMP
);
```

### 2. API Endpoints (Optional)

**If you want token validation:**
```typescript
// POST /api/extension/validate-token
// Verifies the token is valid and returns user info

export async function validateToken(req) {
  const { token } = req.body

  // Verify JWT token
  const decoded = jwt.verify(token, process.env.JWT_SECRET)

  // Check if token is revoked
  const { data, error } = await supabase
    .from('extension_tokens')
    .select('*')
    .eq('user_id', decoded.user_id)
    .eq('token_hash', hashToken(token))
    .is('revoked_at', null)
    .single()

  if (error || !data) {
    return { valid: false }
  }

  // Update last_used_at
  await supabase
    .from('extension_tokens')
    .update({ last_used_at: new Date() })
    .eq('id', data.id)

  return {
    valid: true,
    user: {
      id: decoded.user_id,
      email: decoded.email
    }
  }
}
```

**If you reuse existing auth:**
- Extension can use the same JWT tokens as the web app
- No new endpoints needed!
- Token is just a long-lived session token

---

## 📊 MVP Feature Scope

### Must Have (v1.0)
- ✅ Inject "Message with Cold AI" button on LinkedIn profiles
- ✅ Extract LinkedIn URL from current page
- ✅ Send to existing message generation pipeline
- ✅ Token-based authentication (copy/paste)
- ✅ Loading/success/error states
- ✅ Toast notifications
- ✅ Works on Chrome

### Should Have (v1.1)
- Extension popup with settings
- Firefox and Edge builds
- Check if prospect already exists (show different UI)
- Extension settings (default ICP/product)

### Could Have Later (v2.0)
- Bulk add from LinkedIn search results
- OAuth flow (better auth UX)
- Notes/tags before adding
- View prospect status in extension
- Chrome side panel with mini-dashboard

---

## 🚀 Installation & Deployment

### Development
```bash
npm create plasmo
cd cold-ai-extension
npm install
npm run dev  # Opens browser with extension loaded
```

### Building
```bash
npm run build -- --target=chrome-mv3
npm run build -- --target=firefox-mv3
npm run build -- --target=edge-mv3
```

### Distribution Options

#### Option 1: Chrome Web Store (Public)
- **Pros**: Easy for users, automatic updates
- **Cons**: $5 one-time fee, review process (1-3 days)
- **Best for**: Public release

#### Option 2: Self-Hosted (Private Beta)
- **Pros**: Free, instant updates, control
- **Cons**: Users need to "Load unpacked" (dev mode)
- **Best for**: Beta testing, internal use

#### Option 3: Chrome Web Store (Unlisted)
- **Pros**: Easy install, only via direct link
- **Cons**: $5 fee, review process
- **Best for**: Private release to select users

---

## ⏱️ Estimated Timeline

### Total Estimated Time: 2-3 weeks

**Week 1: Extension Core**
- Set up Plasmo project (2 hours)
- Inject button on LinkedIn (4 hours)
- API integration (3 hours)
- Auth implementation (4 hours)
- Testing (3 hours)

**Week 2: Backend Settings**
- Settings page "Extensions" tab (4 hours)
- Token generation UI (2 hours)
- Token management (revoke, list) (3 hours)
- API endpoints (if needed) (3 hours)
- Testing (2 hours)

**Week 3: Polish & Deploy**
- Multi-browser testing (4 hours)
- Extension icons & branding (2 hours)
- Chrome Web Store listing (2 hours)
- Documentation (2 hours)
- Final testing & fixes (4 hours)

---

## 🔍 Technical Notes

### LinkedIn Profile URL Formats
The extension needs to work on these URL patterns:
- `https://www.linkedin.com/in/username/`
- `https://linkedin.com/in/username`
- `https://www.linkedin.com/in/username/details/contact/`
- `https://www.linkedin.com/in/username?trk=...`

Extract using: `window.location.href.match(/linkedin\.com\/in\/[^/]+/)[0]`

### Extension Permissions Needed
```json
{
  "permissions": [
    "storage",          // Store auth token
    "activeTab"         // Access current LinkedIn tab
  ],
  "host_permissions": [
    "https://*.linkedin.com/*",           // Inject on LinkedIn
    "https://your-supabase-url.com/*"    // API calls
  ]
}
```

### Security Considerations
- Store token in `chrome.storage.sync` (encrypted by browser)
- Never expose token in content script (use background worker)
- Validate token on backend for every request
- Use HTTPS for all API calls
- Add rate limiting to prevent abuse

---

## 📝 User Documentation (To Write Later)

### Installation Guide
1. Install from Chrome Web Store
2. Open Cold AI → Settings → Extensions
3. Click "Generate Extension Token"
4. Copy token
5. Click extension icon in browser
6. Paste token and click "Validate"
7. Done! Visit any LinkedIn profile and click "Message with Cold AI"

### Troubleshooting
- **Button not showing**: Refresh LinkedIn page
- **"Not authenticated" error**: Re-enter token in extension popup
- **"Failed to generate message"**: Check Cold AI dashboard for error

---

## 🎯 Success Metrics (Track Later)

- Number of prospects added via extension
- Conversion rate (extension add → message sent)
- Daily active users of extension
- Most common error types
- Average time from profile view to message generation

---

## 🚧 Known Limitations

1. **LinkedIn Rate Limits**: LinkedIn may detect automated activity - keep usage reasonable
2. **LinkedIn DOM Changes**: If LinkedIn updates their UI, button injection may break
3. **Authentication**: Token copy/paste is less smooth than OAuth (can improve later)
4. **No Bulk Actions**: MVP only supports one profile at a time
5. **Chrome Only Initially**: Firefox/Edge support comes in v1.1

---

## 🔗 Useful Resources

- **Plasmo Docs**: https://docs.plasmo.com/
- **Chrome Extension Docs**: https://developer.chrome.com/docs/extensions/
- **Manifest V3 Migration**: https://developer.chrome.com/docs/extensions/migrating/
- **Chrome Web Store**: https://chrome.google.com/webstore/devconsole/

---

## 📞 Questions to Resolve Before Building

- [ ] Should we create a new API endpoint or reuse `server-message-generate`?
- [ ] Do we want to track extension-added prospects separately?
- [ ] Should the extension auto-open Cold AI dashboard after adding a prospect?
- [ ] What should happen if the prospect already exists in the system?
- [ ] Do we need different token types (extension vs web app)?

---

**Ready to build when you are!** Come back to this document when you're ready to start the extension project.
