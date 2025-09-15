# Cold AI Free - Widget-Based Outreach Automation

🎆 **Live at: [free.coldai.uk](https://free.coldai.uk)**

A beautiful, widget-based interface for AI-powered LinkedIn, email, and call script generation. Designed specifically for free tier users with a focus on user experience and simplicity.

## ✨ Features

### Free Tier Includes:
- **25 AI-generated messages per month**
- **1 Knowledge Base entry** for your product/service
- **1 Ideal Customer Profile (ICP)**
- **Prospect tracking** (up to 50)
- **Usage analytics** with visual progress tracking
- **Personalisation preferences** for message tone and style

### Widget-Based Interface
Each feature is a self-contained widget that can be:
- 👆 Clicked to expand for detailed interaction
- 👁️ Viewed at a glance in minimised state
- 🎨 Beautifully animated with smooth transitions

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ and npm
- Supabase account (for database)
- Environment variables (see `.env.example`)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/Nudge-AI-UK/cold-ai-free.git
cd cold-ai-free
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env.local
# Edit .env.local with your Supabase credentials
```

4. Run the development server:
```bash
npm run dev
```

The app will be available at `http://localhost:5174`

## 🏗️ Architecture

### Tech Stack
- **Frontend**: React 18 + TypeScript + Vite
- **UI Components**: shadcn/ui + Tailwind CSS
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **State Management**: Zustand + React Query
- **Deployment**: Lovable.dev platform

### Project Structure
```
src/
├── components/
│   ├── widgets/        # Feature widgets
│   ├── ui/            # shadcn/ui components
│   ├── layout/        # Layout components
│   └── auth/          # Authentication
├── hooks/             # Custom React hooks
├── lib/               # Utilities and constants
├── integrations/      # Supabase client
├── contexts/          # React contexts
└── types/             # TypeScript definitions
```

## 🌈 Widgets

### Profile Widget
- Personal information management
- LinkedIn URL integration
- Bio and job title configuration

### Company Widget
- Company details and description
- Value proposition
- Target market definition

### Communication Widget
- Message tone selection (Professional, Casual, Friendly, Direct)
- Style preferences (Concise, Detailed, Storytelling)
- Emoji usage toggle
- Personalisation level control

### Knowledge Base Widget
- Product/service information (1 entry for free tier)
- Detailed content for AI context
- Category tagging

### ICP Widget
- Define ideal customer profile
- Job titles and industries
- Pain points and goals
- Company size targeting

### Message Generator Widget
- AI-powered message creation
- LinkedIn, Email, and Call Script options
- Usage tracking (25/month limit)
- Copy to clipboard functionality

### Analytics Widget
- Monthly usage visualisation
- Message history
- Progress tracking
- Usage tips and recommendations

### Upgrade Widget
- Premium features showcase
- Pricing tiers display
- Direct upgrade link
- Feature comparison

## 🔐 Environment Variables

```env
# Supabase Configuration
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# App Configuration
VITE_APP_VERSION=free
VITE_APP_URL=https://free.coldai.uk
VITE_UPGRADE_URL=https://app.coldai.uk

# Free Tier Limits
VITE_MAX_FREE_MESSAGES=25
VITE_MAX_FREE_ICPS=1
VITE_MAX_FREE_KNOWLEDGE_ENTRIES=1
```

## 📄 Database Schema

The app uses the following main tables:
- `profiles` - User profile information
- `company_profiles` - Company details
- `communication_preferences` - Message style settings
- `knowledge_base` - Product/service information
- `icps` - Ideal Customer Profiles
- `prospects` - Prospect tracking
- `messages` - Generated message history
- `usage` - Monthly usage tracking
- `subscriptions` - User subscription status

## 🎆 Deployment

### Deploy to Production

1. Build the application:
```bash
npm run build
```

2. Preview the build:
```bash
npm run preview
```

3. Deploy to your hosting platform (Vercel, Netlify, etc.)

### Deploy to Lovable.dev

The app is configured for deployment on Lovable.dev platform. Simply push to the main branch and the deployment will trigger automatically.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

This project is proprietary software owned by Nudge AI UK.

## 📧 Contact

**Nudge AI UK**
- Website: [nudgeai.uk](https://nudgeai.uk)
- Email: admin@nudgeai.uk
- GitHub: [@Nudge-AI-UK](https://github.com/Nudge-AI-UK)

## 🙏 Acknowledgments

- [shadcn/ui](https://ui.shadcn.com/) for the beautiful components
- [Supabase](https://supabase.com/) for the backend infrastructure
- [Tailwind CSS](https://tailwindcss.com/) for the utility-first CSS framework
- [Radix UI](https://www.radix-ui.com/) for accessible component primitives

---

**Built with ❤️ by Nudge AI UK**