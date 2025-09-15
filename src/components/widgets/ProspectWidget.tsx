import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Users, Plus, ExternalLink } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/integrations/supabase/client'
import { PROSPECT_STATUSES } from '@/lib/constants'
import type { Prospect } from '@/types'

interface ProspectWidgetProps {
  isActive: boolean
  onActivate: () => void
}

export function ProspectWidget({ isActive, onActivate }: ProspectWidgetProps) {
  const { user } = useAuth()
  const [prospects, setProspects] = useState<Prospect[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (user) {
      fetchProspects()
    }
  }, [user])

  const fetchProspects = async () => {
    if (!user) return
    
    setLoading(true)
    const { data } = await supabase
      .from('prospects')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5)

    if (data) {
      setProspects(data)
    }
    setLoading(false)
  }

  const getStatusBadge = (status: string) => {
    const statusConfig = PROSPECT_STATUSES.find(s => s.value === status)
    return statusConfig ? statusConfig.color : 'bg-gray-100 text-gray-800'
  }

  if (!isActive) {
    return (
      <Card 
        className="cursor-pointer hover:shadow-lg transition-shadow widget-fade-in"
        onClick={onActivate}
      >
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Users className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Prospects</CardTitle>
            </div>
            <Badge variant="secondary">{prospects.length}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {prospects.length > 0
              ? `${prospects.length} prospects tracked`
              : 'Start tracking prospects'}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Manage your outreach list
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="lg:col-span-2 widget-fade-in">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Prospect List</CardTitle>
            <CardDescription>Track your outreach targets</CardDescription>
          </div>
          <Button size="sm" disabled>
            <Plus className="h-4 w-4 mr-1" />
            Add Prospect
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">
            Loading prospects...
          </div>
        ) : prospects.length > 0 ? (
          <div className="space-y-3">
            {prospects.map((prospect) => (
              <div key={prospect.id} className="flex items-center justify-between p-3 rounded-lg border">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm">{prospect.name}</p>
                    <Badge className={getStatusBadge(prospect.status)} variant="secondary">
                      {PROSPECT_STATUSES.find(s => s.value === prospect.status)?.label}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {prospect.job_title} at {prospect.company}
                  </p>
                </div>
                {prospect.linkedin_url && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => window.open(prospect.linkedin_url, '_blank')}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <Users className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              No prospects yet
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Prospects will appear here after generating messages
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}