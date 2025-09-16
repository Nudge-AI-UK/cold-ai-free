import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { BarChart3, TrendingUp, Calendar, MessageSquare } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/integrations/supabase/client'
import { formatDate } from '@/lib/utils'
import { FREE_TIER_LIMITS } from '@/lib/constants'
import type { Usage, Message } from '@/types'

interface AnalyticsWidgetProps {
  isActive: boolean
  onActivate: () => void
}

export function AnalyticsWidget({ isActive, onActivate }: AnalyticsWidgetProps) {
  const { user } = useAuth()
  const [usage, setUsage] = useState<Usage | null>(null)
  const [recentMessages, setRecentMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (user) {
      fetchUsage()
      fetchRecentMessages()
    }
  }, [user])

  const fetchUsage = async () => {
    if (!user) return
    
    setLoading(true)
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
    setLoading(false)
  }

  const fetchRecentMessages = async () => {
    if (!user) return
    
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5)

    if (data) {
      setRecentMessages(data)
    }
  }

  const usagePercentage = usage 
    ? (usage.messages_sent / FREE_TIER_LIMITS.MAX_MESSAGES) * 100
    : 0

  if (!isActive) {
    return (
      <Card 
        className="cursor-pointer hover:shadow-lg transition-shadow widget-fade-in"
        onClick={onActivate}
      >
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Analytics</CardTitle>
            </div>
            {usage && (
              <Badge variant={usage.messages_remaining > 5 ? 'secondary' : 'destructive'}>
                {usage.messages_remaining} left
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Progress value={usagePercentage} className="h-2" />
            <p className="text-xs text-muted-foreground">
              {usage?.messages_sent || 0} of {FREE_TIER_LIMITS.MAX_MESSAGES} messages used
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="lg:col-span-3 widget-fade-in">
      <CardHeader>
        <CardTitle>Usage Analytics</CardTitle>
        <CardDescription>Track your monthly message usage</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Usage Overview */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">Monthly Usage</h3>
            <Badge variant={usage && usage.messages_remaining > 5 ? 'secondary' : 'destructive'}>
              {usage?.messages_remaining || FREE_TIER_LIMITS.MAX_MESSAGES} remaining
            </Badge>
          </div>
          
          <div className="space-y-2">
            <Progress value={usagePercentage} className="h-3" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{usage?.messages_sent || 0} sent</span>
              <span>{FREE_TIER_LIMITS.MAX_MESSAGES} monthly limit</span>
            </div>
          </div>
          
          {usage && (
            <div className="rounded-lg bg-muted p-3 space-y-1">
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span>Period: {formatDate(usage.period_start)} - {formatDate(usage.period_end)}</span>
              </div>
              {usage.messages_remaining <= 5 && (
                <div className="flex items-center gap-2 text-sm text-orange-600">
                  <TrendingUp className="h-4 w-4" />
                  <span>Running low! Consider upgrading for unlimited messages</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Recent Activity */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium">Recent Messages</h3>
          {recentMessages.length > 0 ? (
            <div className="space-y-2">
              {recentMessages.map((message) => (
                <div key={message.id} className="flex items-center gap-3 p-2 rounded-lg border">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10">
                    <MessageSquare className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium capitalize">{message.type} Message</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {formatDate(message.created_at)}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {message.type}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 rounded-lg border border-dashed">
              <MessageSquare className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                No messages generated yet
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Your message history will appear here
              </p>
            </div>
          )}
        </div>

        {/* Usage Tips */}
        <div className="rounded-lg bg-blue-50 p-3">
          <p className="text-sm font-medium text-blue-900">💡 Usage Tips</p>
          <ul className="text-xs text-blue-700 mt-2 space-y-1">
            <li>• Your usage resets on the 1st of each month</li>
            <li>• Unused messages don't roll over</li>
            <li>• Upgrade for unlimited messages and advanced features</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}
