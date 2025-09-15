import { useEffect, useState } from 'react'
import { Toaster } from 'sonner'
import { AuthProvider } from '@/contexts/AuthContext'
import { WidgetGrid } from '@/components/layout/WidgetGrid'
import { Header } from '@/components/layout/Header'
import { LoginPage } from '@/components/auth/LoginPage'
import { ProfileWidget } from '@/components/widgets/ProfileWidget'
import { CompanyWidget } from '@/components/widgets/CompanyWidget'
import { CommunicationWidget } from '@/components/widgets/CommunicationWidget'
import { KnowledgeWidget } from '@/components/widgets/KnowledgeWidget'
import { ICPWidget } from '@/components/widgets/ICPWidget'
import { ProspectWidget } from '@/components/widgets/ProspectWidget'
import { AnalyticsWidget } from '@/components/widgets/AnalyticsWidget'
import { MessageWidget } from '@/components/widgets/MessageWidget'
import { UpgradeWidget } from '@/components/widgets/UpgradeWidget'
import { useAuth } from '@/hooks/useAuth'

function AppContent() {
  const { user, loading } = useAuth()
  const [activeWidget, setActiveWidget] = useState<string | null>(null)

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse text-lg text-muted-foreground">
          Loading Cold AI Free...
        </div>
      </div>
    )
  }

  if (!user) {
    return <LoginPage />
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        {/* Welcome Section */}
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Welcome to Cold AI Free
          </h1>
          <p className="text-muted-foreground mt-2">
            Your AI-powered outreach assistant - 25 free messages per month
          </p>
        </div>

        {/* Widget Grid */}
        <WidgetGrid>
          <ProfileWidget 
            isActive={activeWidget === 'profile'}
            onActivate={() => setActiveWidget('profile')}
          />
          <CompanyWidget 
            isActive={activeWidget === 'company'}
            onActivate={() => setActiveWidget('company')}
          />
          <CommunicationWidget 
            isActive={activeWidget === 'communication'}
            onActivate={() => setActiveWidget('communication')}
          />
          <KnowledgeWidget 
            isActive={activeWidget === 'knowledge'}
            onActivate={() => setActiveWidget('knowledge')}
          />
          <ICPWidget 
            isActive={activeWidget === 'icp'}
            onActivate={() => setActiveWidget('icp')}
          />
          <ProspectWidget 
            isActive={activeWidget === 'prospects'}
            onActivate={() => setActiveWidget('prospects')}
          />
          <AnalyticsWidget 
            isActive={activeWidget === 'analytics'}
            onActivate={() => setActiveWidget('analytics')}
          />
          <MessageWidget 
            isActive={activeWidget === 'messages'}
            onActivate={() => setActiveWidget('messages')}
          />
          <UpgradeWidget 
            isActive={activeWidget === 'upgrade'}
            onActivate={() => setActiveWidget('upgrade')}
          />
        </WidgetGrid>
      </main>

      <Toaster position="bottom-right" />
    </div>
  )
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}

export default App