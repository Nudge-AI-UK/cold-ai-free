// src/App.tsx
import { Toaster } from 'sonner'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from '@/contexts/AuthContext'
import { LoadingProvider } from '@/contexts/LoadingContext'
import { WidgetDashboard } from '@/components/dashboard/WidgetDashboard'
import { OutreachPage } from '@/pages/OutreachPage'
import { ProspectsPage } from '@/pages/ProspectsPage'
// import { InboxPage } from '@/pages/InboxPage'
import { LoginPage } from '@/components/auth/LoginPage'
import { PasswordResetPage } from '@/components/auth/PasswordResetPage'
import { useAuth } from '@/hooks/useAuth'
import { ModalFlowProvider } from '@/components/modals/ModalFlowManager'
import { ProspectModalProvider } from '@/components/modals/ProspectModalManager'
import { MobileBlocker } from '@/components/MobileBlocker'
import { MaintenanceBlocker } from '@/components/MaintenanceBlocker'
import { FeedbackWidget } from '@/components/feedback/FeedbackWidget'
import { FeedbackProvider } from '@/contexts/FeedbackContext'
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/react'

function AppContent() {
  const { user, loading } = useAuth()
  const isResetPasswordPage = window.location.pathname === '/reset-password'

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-2xl mb-4">
            <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
          <p className="text-lg text-muted-foreground">Loading Cold AI Free...</p>
        </div>
      </div>
    )
  }

  // Allow unauthenticated access to password reset page
  if (!user && !isResetPasswordPage) {
    return <LoginPage />
  }

  if (!user && isResetPasswordPage) {
    return <PasswordResetPage />
  }

  return (
    <>
      <Routes>
        <Route path="/" element={<WidgetDashboard />} />
        <Route path="/outreach" element={<OutreachPage />} />
        <Route path="/prospects" element={<ProspectsPage />} />
        {/* <Route path="/inbox" element={<InboxPage />} /> */}
        <Route path="/reset-password" element={<PasswordResetPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <FeedbackWidget />
    </>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <LoadingProvider>
          <FeedbackProvider>
            <ModalFlowProvider>
              <ProspectModalProvider>
                <MobileBlocker />
                <MaintenanceBlocker />
                <AppContent />
                <Toaster
                  position="bottom-right"
                  toastOptions={{
                    style: {
                      background: 'hsl(222 41% 11%)',
                      border: '1px solid hsl(217 33% 18%)',
                      color: 'hsl(210 20% 95%)',
                    },
                  }}
                />
                <Analytics />
                <SpeedInsights />
              </ProspectModalProvider>
            </ModalFlowProvider>
          </FeedbackProvider>
        </LoadingProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
