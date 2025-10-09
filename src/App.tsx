// src/App.tsx
import { Toaster } from 'sonner'
import { AuthProvider } from '@/contexts/AuthContext'
import { LoadingProvider } from '@/contexts/LoadingContext'
import { WidgetDashboard } from '@/components/dashboard/WidgetDashboard'
import { LoginPage } from '@/components/auth/LoginPage'
import { useAuth } from '@/hooks/useAuth'
import { ModalFlowProvider } from '@/components/modals/ModalFlowManager'

function AppContent() {
  const { user, loading } = useAuth()

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

  if (!user) {
    return <LoginPage />
  }

  return <WidgetDashboard />
}

function App() {
  return (
    <AuthProvider>
      <LoadingProvider>
        <ModalFlowProvider>
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
        </ModalFlowProvider>
      </LoadingProvider>
    </AuthProvider>
  )
}

export default App
