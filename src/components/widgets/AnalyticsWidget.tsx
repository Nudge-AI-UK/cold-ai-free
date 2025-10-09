import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/integrations/supabase/client'
import { FREE_TIER_LIMITS } from '@/lib/constants'
import type { Usage } from '@/types'

interface AnalyticsWidgetProps {
  forceEmpty?: boolean
  className?: string
}

export function AnalyticsWidget({ forceEmpty, className }: AnalyticsWidgetProps) {
  const { user } = useAuth()
  const [usage, setUsage] = useState<Usage | null>(null)

  useEffect(() => {
    if (user && !forceEmpty) {
      fetchUsage()
    }
  }, [user, forceEmpty])

  // Real-time subscription for usage tracking updates
  useEffect(() => {
    if (!user) return

    const userId = user?.id || user?.user_id

    const channel = supabase
      .channel('usage_tracking_updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'usage_tracking',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          console.log('🔄 Usage tracking updated:', payload)
          fetchUsage()
        }
      )
      .subscribe((status) => {
        console.log('🔌 Usage tracking subscription status:', status)
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user])

  const fetchUsage = async () => {
    if (!user) return

    const userId = user?.id || user?.user_id

    try {
      const currentDate = new Date()
      const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
      const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0)

      // Format dates as YYYY-MM-DD for PostgreSQL date comparison
      const startDate = startOfMonth.toISOString().split('T')[0]
      const endDate = endOfMonth.toISOString().split('T')[0]

      // Query all daily rows for the current month
      const { data, error } = await supabase
        .from('usage_tracking')
        .select('messages_generated, messages_sent, messages_archived, research_performed')
        .eq('user_id', userId)
        .gte('usage_date', startDate)
        .lte('usage_date', endDate)

      if (error) {
        // Table might not exist or columns missing - use default values
        console.warn('Usage tracking not available:', error.message)
        setUsage({
          user_id: userId,
          messages_sent: 0,
          messages_remaining: FREE_TIER_LIMITS.MAX_MESSAGES,
          period_start: startOfMonth.toISOString(),
          period_end: endOfMonth.toISOString()
        } as any)
        return
      }

      // Sum up all daily values for the month
      const totalMessagesGenerated = data?.reduce((sum, row) => sum + (row.messages_generated || 0), 0) || 0
      const totalMessagesSent = data?.reduce((sum, row) => sum + (row.messages_sent || 0), 0) || 0
      const totalMessagesArchived = data?.reduce((sum, row) => sum + (row.messages_archived || 0), 0) || 0
      const totalResearchPerformed = data?.reduce((sum, row) => sum + (row.research_performed || 0), 0) || 0

      console.log('📊 Monthly usage:', {
        generated: totalMessagesGenerated,
        sent: totalMessagesSent,
        archived: totalMessagesArchived,
        research: totalResearchPerformed,
        dailyRows: data?.length
      })

      setUsage({
        user_id: userId,
        messages_sent: totalMessagesGenerated, // Using messages_generated for the limit tracking
        messages_remaining: Math.max(0, FREE_TIER_LIMITS.MAX_MESSAGES - totalMessagesGenerated),
        period_start: startOfMonth.toISOString(),
        period_end: endOfMonth.toISOString()
      } as any)
    } catch (error) {
      console.warn('Usage tracking error:', error)
      // Fallback to default values
      setUsage({
        user_id: userId,
        messages_sent: 0,
        messages_remaining: FREE_TIER_LIMITS.MAX_MESSAGES,
        period_start: new Date().toISOString(),
        period_end: new Date().toISOString()
      } as any)
    }
  }

  const usagePercentage = usage 
    ? (usage.messages_sent / FREE_TIER_LIMITS.MAX_MESSAGES) * 100
    : 0

  // Calculate days until reset
  const daysUntilReset = () => {
    const now = new Date()
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
    const diff = nextMonth.getTime() - now.getTime()
    return Math.ceil(diff / (1000 * 60 * 60 * 24))
  }

  return (
    <div className={`relative shadow-2xl rounded-2xl p-4 overflow-hidden border border-white/10 text-white widget-fade-in ${className}`}
         style={{
           background: 'linear-gradient(135deg, rgba(251, 174, 28, 0.1) 0%, rgba(221, 104, 0, 0.05) 100%)',
           backdropFilter: 'blur(10px)',
           WebkitBackdropFilter: 'blur(10px)'
         }}>
      
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">📊</span>
          <h3 className="text-sm font-semibold text-white/90">Monthly Usage</h3>
        </div>
        <span className="text-xs text-gray-400">Free Plan</span>
      </div>

      {/* Usage Counter */}
      <div className="mb-3">
        <div className="flex items-baseline justify-between mb-2">
          <div>
            <span className="text-2xl font-bold text-[#FBAE1C]">
              {forceEmpty ? '0' : (usage?.messages_sent || 0)}
            </span>
            <span className="text-lg text-gray-400"> / {FREE_TIER_LIMITS.MAX_MESSAGES || 25}</span>
          </div>
          <span className="text-xs text-gray-500">messages</span>
        </div>
        
        {/* Progress Bar */}
        <div className="w-full bg-white/10 rounded-full h-2">
          <div className="h-2 rounded-full transition-all duration-300"
               style={{
                 width: forceEmpty ? '0%' : `${usagePercentage}%`,
                 background: 'linear-gradient(90deg, #FBAE1C 0%, #FC9109 50%, #DD6800 100%)'
               }}></div>
        </div>
      </div>

      {/* Reset Info */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500">
          {forceEmpty ? 'Start tracking your usage' : `Resets in ${daysUntilReset()} days`}
        </span>
        <button className="text-xs text-[#FBAE1C] hover:text-white transition-colors">
          Upgrade →
        </button>
      </div>
      
      {/* Decorative Elements */}
      <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-[#FBAE1C]/10 to-transparent rounded-bl-full blur-xl"></div>
    </div>
  )
}
