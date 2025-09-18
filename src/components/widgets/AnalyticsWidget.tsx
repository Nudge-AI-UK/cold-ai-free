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

  const fetchUsage = async () => {
    if (!user) return
    
    const currentDate = new Date()
    const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
    const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0)
    
    const { data } = await supabase
      .from('usage_tracking')
      .select('*')
      .eq('user_id', user.id)
      .gte('period_start', startOfMonth.toISOString())
      .lte('period_end', endOfMonth.toISOString())
      .single()

    if (!data) {
      // Create usage record if it doesn't exist
      const { data: newUsage } = await supabase
        .from('usage_tracking')
        .insert({
          user_id: user.id,
          messages_sent: 0,
          messages_remaining: FREE_TIER_LIMITS.MAX_MESSAGES,
          period_start: startOfMonth.toISOString(),
          period_end: endOfMonth.toISOString(),
        })
        .select()
        .single()
      
      if (newUsage) {
        setUsage(newUsage)
      }
    } else {
      setUsage(data)
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
