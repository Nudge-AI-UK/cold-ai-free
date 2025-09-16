import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Target, MoreVertical, Plus } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/integrations/supabase/client'
import { formatDistanceToNow } from 'date-fns'
import type { ICP } from '@/types'

interface ICPWidgetProps {
  isActive: boolean
  onActivate: () => void
}

export function ICPWidget({ isActive, onActivate }: ICPWidgetProps) {
  const { user } = useAuth()
  const [icp, setIcp] = useState<any>({})
  const [loading, setLoading] = useState(false)
  const [hasICP, setHasICP] = useState(false)

  useEffect(() => {
    if (user) {
      fetchICP()
    }
  }, [user])

  const fetchICP = async () => {
    if (!user) return
    
    const { data } = await supabase
      .from('icps')
      .select('*')
      .eq('created_by', user.id)
      .eq('is_active', true)
      .limit(1)
      .single()

    if (data) {
      setIcp(data)
      setHasICP(true)
    }
  }

  // Get quality scores from metadata or use defaults
  const qualityScores = icp.metadata?.ai_feedback?.quality_assessment?.scores || {
    completeness: 0,
    specificity: 0,
    overall: 0
  }

  // Get personas count from metadata
  const personasCount = icp.metadata?.personas?.length || 0

  // Get AI summary from metadata
  const aiSummary = icp.metadata?.ai_feedback?.summary || null

  // Collapsed state (small card)
  if (!isActive) {
    return (
      <Card 
        className="cursor-pointer hover:shadow-lg transition-shadow widget-fade-in hover:border-orange-500/50"
        onClick={onActivate}
      >
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Target className="h-5 w-5 text-orange-400" />
              <CardTitle className="text-lg">ICP</CardTitle>
            </div>
            {hasICP ? (
              <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 mr-1 animate-pulse"></span>
                Active
              </Badge>
            ) : (
              <Badge variant="outline">0/1</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {hasICP ? icp.icp_name : 'Define your ideal customer'}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Free: 1 profile allowed
          </p>
        </CardContent>
      </Card>
    )
  }

  // Expanded state (glassmorphic widget)
  return (
    <div className="lg:col-span-3 widget-fade-in">
      <div className="relative bg-gradient-to-br from-orange-900/40 via-amber-900/30 to-yellow-900/40 backdrop-blur-lg shadow-2xl rounded-3xl p-6 overflow-hidden border border-white/10 text-white">
        
        {/* Header Section */}
        <div className="relative z-20">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#FBAE1C] to-[#FC9109] flex items-center justify-center shadow-lg">
                <span className="text-2xl">🎯</span>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold leading-tight">
                  {hasICP ? icp.icp_name : 'Create Your ICP'}
                </h3>
                {hasICP && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/20 text-green-400 border border-green-500/30 mt-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 mr-1 animate-pulse"></span>
                    Active
                  </span>
                )}
              </div>
            </div>
            <button className="text-white/50 hover:text-white/80 transition-colors">
              <MoreVertical className="w-5 h-5" />
            </button>
          </div>
          
          {/* Last Used and Product */}
          {hasICP && (
            <>
              <div className="text-sm font-light opacity-80 mb-1 tracking-wide">
                Last used: {icp.updated_at ? formatDistanceToNow(new Date(icp.updated_at), { addSuffix: true }) : 'Never'}
              </div>
              <div className="text-sm opacity-90 mb-4 tracking-wide">
                Product: Cold AI Free
              </div>
            </>
          )}

          {hasICP ? (
            <>
              {/* Description */}
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 flex items-start mb-4 border border-white/5 shadow-sm">
                <div className="text-2xl mr-2 text-[#FBAE1C] drop-shadow-lg">📝</div>
                <div className="text-sm opacity-90">
                  {icp.description || `Targeting ${icp.industry_focus?.join(', ') || 'various industries'}`}
                </div>
              </div>

              {/* Quality Assessment */}
              <div className="bg-black/20 backdrop-blur-sm rounded-2xl p-4 mb-4 border border-white/5">
                <h4 className="text-xs font-medium text-white/50 uppercase tracking-wide mb-3">Quality Assessment</h4>
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs text-white/70">Completeness</span>
                      <span className="text-xs font-semibold text-[#FBAE1C]">{qualityScores.completeness || 0}%</span>
                    </div>
                    <Progress 
                      value={qualityScores.completeness || 0} 
                      className="h-1.5 bg-white/10"
                      indicatorClassName="bg-gradient-to-r from-[#FBAE1C] to-[#FC9109]"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs text-white/70">Specificity</span>
                      <span className="text-xs font-semibold text-[#FC9109]">{qualityScores.specificity || 0}%</span>
                    </div>
                    <Progress 
                      value={qualityScores.specificity || 0} 
                      className="h-1.5 bg-white/10"
                      indicatorClassName="bg-gradient-to-r from-[#FC9109] to-[#DD6800]"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs text-white/70">Overall</span>
                      <span className="text-xs font-semibold text-[#DD6800]">{qualityScores.overall || 0}%</span>
                    </div>
                    <Progress 
                      value={qualityScores.overall || 0} 
                      className="h-1.5 bg-white/10"
                      indicatorClassName="bg-gradient-to-r from-[#DD6800] to-[#FBAE1C]"
                    />
                  </div>
                </div>
              </div>

              {/* Key Metrics */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-white/5 backdrop-blur-sm rounded-xl p-3 border border-white/10">
                  <div className="text-2xl mb-1">🏢</div>
                  <div className="text-xs text-white/50">Company Size</div>
                  <div className="text-sm font-semibold">{icp.company_size_range || '1-50'}</div>
                </div>
                <div className="bg-white/5 backdrop-blur-sm rounded-xl p-3 border border-white/10">
                  <div className="text-2xl mb-1">💰</div>
                  <div className="text-xs text-white/50">Budget Range</div>
                  <div className="text-sm font-semibold">{icp.budget_range || '£2K-10K/mo'}</div>
                </div>
              </div>

              {/* Industries */}
              {icp.industry_focus && icp.industry_focus.length > 0 && (
                <div className="mb-4">
                  <div className="flex flex-wrap gap-2">
                    {icp.industry_focus.slice(0, 2).map((industry: string, i: number) => (
                      <span 
                        key={i}
                        className="px-3 py-1 bg-gradient-to-r from-[#FBAE1C]/20 to-[#FC9109]/20 border border-[#FBAE1C]/30 rounded-full text-xs font-medium"
                      >
                        {industry}
                      </span>
                    ))}
                    {icp.industry_focus.length > 2 && (
                      <span className="px-3 py-1 bg-gradient-to-r from-[#FBAE1C]/20 to-[#FC9109]/20 border border-[#FBAE1C]/30 rounded-full text-xs font-medium">
                        +{icp.industry_focus.length - 2} more
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* AI Summary */}
              <div className="bg-gradient-to-r from-[#FBAE1C]/10 to-[#FC9109]/10 rounded-xl p-3 mb-4 border border-[#FBAE1C]/20">
                <div className="flex items-start space-x-2">
                  <span className="text-lg">✨</span>
                  <div className="flex-1">
                    <div className="text-xs font-medium text-[#FBAE1C] mb-1">AI Insights</div>
                    <p className="text-xs text-white/70 leading-relaxed">
                      {aiSummary || `${qualityScores.overall || 0}% ready. ${personasCount > 0 ? `${personasCount} buyer personas identified.` : 'Add personas for better targeting.'}`}
                    </p>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex space-x-3">
                <Button 
                  className="flex-1 bg-gradient-to-r from-[#FBAE1C] to-[#FC9109] text-white font-medium hover:opacity-90 transition-all duration-200"
                  onClick={() => window.location.href = '/icps'}
                >
                  View Details
                </Button>
                <Button 
                  variant="secondary"
                  size="icon"
                  className="bg-white/5 backdrop-blur-sm border-white/10 hover:bg-white/10"
                  onClick={() => window.location.href = '/message-generation'}
                >
                  <Plus className="w-5 h-5" />
                </Button>
              </div>
            </>
          ) : (
            /* Empty State */
            <div className="text-center py-8">
              <div className="mb-4">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-r from-[#FBAE1C] to-[#FC9109] mb-4">
                  <Target className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-lg font-semibold mb-2">No ICP Created Yet</h3>
                <p className="text-sm text-white/70 mb-6">
                  Define your ideal customer profile to start generating targeted messages
                </p>
                <Button 
                  className="bg-gradient-to-r from-[#FBAE1C] to-[#FC9109] text-white font-medium hover:opacity-90"
                  onClick={() => window.location.href = '/icps'}
                >
                  Create Your First ICP
                </Button>
              </div>
            </div>
          )}
        </div>
        
        {/* Hover State Indicator */}
        <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-[#FBAE1C]/20 to-transparent rounded-bl-full blur-xl"></div>
      </div>
    </div>
  )
}
