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

  useEffect(() => {
    // Check active sessions and sets the user
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        ensureFreeSubscription(session.user.id)
      }
      setLoading(false)
    })

    // Listen for changes on auth state (sign in, sign out, etc.)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user && _event === 'SIGNED_IN') {
        await ensureFreeSubscription(session.user.id)
      }
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  const ensureFreeSubscription = async (userId: string) => {
    // Check if user has a subscription
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .single()

    const currentDate = new Date()
    const endDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0)

    if (!subscription) {
      // Create free tier subscription for new users
      await supabase.from('subscriptions').insert({
        user_id: userId,
        plan_type: 'free',
        status: 'active',
        current_period_start: currentDate.toISOString(),
        current_period_end: endDate.toISOString(),
      })
    }

    // Ensure usage record exists
    const { data: usage } = await supabase
      .from('usage')
      .select('*')
      .eq('user_id', userId)
      .gte('period_start', new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).toISOString())
      .lte('period_end', endDate.toISOString())
      .single()

    if (!usage) {
      // Create usage record for current period
      await supabase.from('usage').insert({
        user_id: userId,
        messages_sent: 0,
        messages_remaining: 25,
        period_start: new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).toISOString(),
        period_end: endDate.toISOString(),
      })
    }
  }

  const signIn = async (email: string, password: string) => {
    const { error, data } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      toast.error(error.message)
      throw error
    }

    // Ensure free tier setup for existing users
    if (data?.user) {
      await ensureFreeSubscription(data.user.id)
    }

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
      await ensureFreeSubscription(data.user.id)
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