import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { User } from '@supabase/supabase-js'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'

interface AuthContextType {
  user: User | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const ensureFreeSubscription = async (userId: string) => {
    // Skipping subscription setup - will be handled by microservices
    return;
  }

  useEffect(() => {
    console.log('AuthContext: Starting session check...')
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      console.log('AuthContext: Session response:', { session, error })
      setUser(session?.user ?? null)
      if (session?.user) {
        console.log('AuthContext: User found')
        // Skip subscription setup - will be handled by microservices
      }
      console.log('AuthContext: Setting loading to false')
      setLoading(false)
    }).catch(err => {
      console.error('AuthContext: Error getting session:', err)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('AuthContext: Auth state changed:', event)
      setUser(session?.user ?? null)
      if (session?.user && event === 'SIGNED_IN') {
        // Skip subscription setup - will be handled by microservices
      }
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signIn = async (email: string, password: string) => {
    const { error, data } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      toast.error(error.message)
      throw error
    }

    // Skip subscription setup - will be handled by microservices
    toast.success('Welcome back!')
  }

  const signUp = async (email: string, password: string) => {
    const { error, data } = await supabase.auth.signUp({
      email,
      password,
    })

    if (error) {
      toast.error(error.message)
      throw error
    }

    if (data?.user) {
      // Skip subscription setup - will be handled by microservices
      toast.success('Account created! Please check your email to verify your account.')
    }
  }

  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) {
      toast.error(error.message)
      throw error
    }
    toast.success('Signed out successfully')
  }

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })

    if (error) {
      toast.error(error.message)
      throw error
    }

    toast.success('Password reset email sent!')
  }

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut, resetPassword }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuthContext() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuthContext must be used within an AuthProvider')
  }
  return context
}