import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Plus, MoreVertical, Loader2, Sparkles, Edit2, Eye } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/integrations/supabase/client'
import { formatDistanceToNow } from 'date-fns'
import { ICPCreationModalV2 } from '@/components/states/ICPCreationModalV2'
import { ICPUnifiedModal } from '@/components/icps/ICPUnifiedModal'

interface ICPWidgetProps {
  className?: string
  isActive?: boolean
  onActivate?: () => void
}

type ICPState = 'empty' | 'generating' | 'draft' | 'reviewing' | 'active'

export function ICPWidget({ className, isActive, onActivate }: ICPWidgetProps) {
  const { user } = useAuth()
  const [icp, setIcp] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [icpState, setIcpState] = useState<ICPState>('empty')
  const [isCreationModalOpen, setIsCreationModalOpen] = useState(false)
  const [isUnifiedModalOpen, setIsUnifiedModalOpen] = useState(false)
  const [generatingProgress, setGeneratingProgress] = useState(0)

  useEffect(() => {
    if (user) {
      fetchICP()
    }
  }, [user])

  useEffect(() => {
    // Check for generating ICP in localStorage (matching main site pattern)
    const checkGenerating = () => {
      const stored = localStorage.getItem('generating_icps')
      if (stored) {
        const parsed = JSON.parse(stored)
        if (parsed.length > 0) {
          const genIcp = parsed[0]
          const elapsed = Date.now() - genIcp.startTime
          const progress = Math.min(95, (elapsed / 60000) * 100)
          
          setGeneratingProgress(progress)
          
          if (elapsed > 60000) {
            setIcpState('active')
            localStorage.removeItem('generating_icps')
            fetchICP()
          } else {
            setIcpState('generating')
          }
        }
      }
    }
    
    const interval = setInterval(checkGenerating, 1000)
    return () => clearInterval(interval)
  }, [])

  const fetchICP = async () => {
    if (!user) return
    
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('icps')
        .select('*')
        .eq('created_by', user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (data) {
        setIcp(data)
        // Determine state based on actual workflow_status
        if (data.workflow_status === 'generating' || data.workflow_status === 'form') {
          setIcpState('generating')
        } else if (data.workflow_status === 'processing' || data.workflow_status === 'reviewing') {
          setIcpState('reviewing')
        } else if (data.review_status === 'approved') {
          setIcpState('active')
        } else {
          setIcpState('draft')
        }
      } else if (!error) {
        setIcpState('empty')
      }
    } catch (error) {
      console.error('Error fetching ICP:', error)
      setIcpState('empty')
    } finally {
      setLoading(false)
    }
  }

  const handleGenerate = (icpData: any) => {
    // Store in localStorage like main site
    const newGenerating = {
      id: Date.now().toString(),
      title: icpData.icp_name || 'New ICP',
      productName: 'Cold AI Free',
      productId: '',
      progress: 0,
      status: 'generating',
      startTime: Date.now()
    }
    localStorage.setItem('generating_icps', JSON.stringify([newGenerating]))
    setIcpState('generating')
  }

  if (loading) {
    return (
      <Card className={`relative overflow-hidden backdrop-blur-md bg-gradient-to-br from-gray-900/90 via-gray-800/90 to-gray-900/90 border-white/10 ${className}`}>
        <div className="flex items-center justify-center h-[320px]">
          <Loader2 className="w-8 h-8 animate-spin text-[#FBAE1C]" />
        </div>
      </Card>
    )
  }

  // Empty State
  if (icpState === 'empty') {
    return (
      <Card className={`relative overflow-hidden backdrop-blur-md bg-gradient-to-br from-gray-900/90 via-gray-800/90 to-gray-900/90 border-white/10 hover:border-[#FBAE1C]/30 transition-all duration-300 ${className}`}>
        <div className="p-6">
          <div className="text-center py-6">
            <div className="relative inline-block mb-4">
              <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-[#FBAE1C]/20 to-[#FC9109]/20 flex items-center justify-center border border-[#FBAE1C]/30 animate-pulse">
                <span className="text-4xl">🎯</span>
              </div>
              <Badge className="absolute -top-1 -right-1 bg-gradient-to-br from-[#FBAE1C] to-[#FC9109] text-white">
                1
              </Badge>
            </div>
            
            <h3 className="text-lg font-bold mb-1 bg-gradient-to-r from-[#FBAE1C] to-[#FC9109] bg-clip-text text-transparent">
              Define Your Ideal Customer
            </h3>
            
            <p className="text-gray-400 text-xs mb-4">
              Unlock AI-powered messages that get responses
            </p>

            <div className="grid grid-cols-3 gap-2 mb-4">
              <div className="bg-white/5 rounded-lg p-2 border border-white/10">
                <div className="text-lg mb-1">⚡</div>
                <p className="text-xs text-gray-400">10x Response</p>
              </div>
              <div className="bg-white/5 rounded-lg p-2 border border-white/10">
                <div className="text-lg mb-1">🤖</div>
                <p className="text-xs text-gray-400">AI-Powered</p>
              </div>
              <div className="bg-white/5 rounded-lg p-2 border border-white/10">
                <div className="text-lg mb-1">🚀</div>
                <p className="text-xs text-gray-400">5min Setup</p>
              </div>
            </div>

            <Button 
              onClick={() => setIsCreationModalOpen(true)}
              className="w-full bg-gradient-to-r from-[#FBAE1C] to-[#FC9109] hover:shadow-lg hover:shadow-[#FBAE1C]/25 transition-all duration-200 font-semibold"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Your First ICP
            </Button>
          </div>
        </div>
      </Card>
    )
  }

  // Generating State
  if (icpState === 'generating') {
    return (
      <Card className={`relative overflow-hidden backdrop-blur-md bg-gradient-to-br from-gray-900/90 via-gray-800/90 to-gray-900/90 border-white/10 ${className}`}>
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="text-4xl">🎯</div>
            <div>
              <h3 className="text-lg font-semibold text-white">Creating ICP...</h3>
              <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
                <Sparkles className="w-3 h-3 mr-1 animate-pulse" />
                AI Generating
              </Badge>
            </div>
          </div>
          
          <Progress 
            value={generatingProgress} 
            className="h-2 bg-gray-700"
          />
          <p className="text-xs text-gray-400 mt-2">
            This may take up to a minute...
          </p>
        </div>
      </Card>
    )
  }

  // Active State - Beautiful Version
  const qualityScores = icp?.metadata?.quality_scores || 
                        icp?.metadata?.ai_feedback?.quality_assessment?.scores || 
                        null

  return (
    <>
      <Card className={`relative overflow-hidden backdrop-blur-md bg-gradient-to-br from-[#FBAE1C]/10 via-[#DD6800]/5 to-transparent border-white/10 hover:border-[#FBAE1C]/30 transition-all duration-300 ${className}`}>
        {/* Status Badge */}
        <div className="absolute top-4 right-4 z-30">
          <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 mr-1.5 animate-pulse inline-block" />
            Active
          </Badge>
        </div>

        <div className="relative z-20 p-6">
          {/* Header Section */}
          <div className="mb-4">
            <div className="text-xs text-gray-400 mb-2">
              Last used: {icp?.updated_at ? formatDistanceToNow(new Date(icp.updated_at), { addSuffix: true }) : 'Never'}
            </div>
            
            <div className="flex items-start gap-3">
              <div className="text-4xl">🎯</div>
              <div className="flex-1">
                <h3 className="text-xl font-semibold bg-gradient-to-r from-[#FBAE1C] to-[#FC9109] bg-clip-text text-transparent">
                  {icp?.icp_name || 'Ideal Customer Profile'}
                </h3>
                <p className="text-sm text-gray-400 mt-1">Product: Cold AI Free</p>
              </div>
            </div>
          </div>

          {/* Description */}
          {icp?.description && (
            <div className="bg-white/5 backdrop-blur-sm rounded-lg p-3 mb-4 border border-white/10">
              <p className="text-sm text-gray-300 line-clamp-2">
                {icp.description}
              </p>
            </div>
          )}

          {/* Quality Assessment - Only show if we have actual data */}
          {qualityScores && (qualityScores.completeness || qualityScores.specificity || qualityScores.overall) && (
            <div className="bg-black/20 backdrop-blur-sm rounded-lg p-3 mb-4 border border-white/5">
              <h4 className="text-xs font-medium text-white/50 uppercase tracking-wide mb-2">Quality Assessment</h4>
              <div className="space-y-2">
                {qualityScores.completeness !== undefined && (
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs text-white/70">Completeness</span>
                      <span className="text-xs font-semibold text-[#FBAE1C]">{qualityScores.completeness}%</span>
                    </div>
                    <div className="w-full bg-white/10 rounded-full h-1">
                      <div className="bg-gradient-to-r from-[#FBAE1C] to-[#FC9109] h-1 rounded-full transition-all duration-300" 
                           style={{ width: `${qualityScores.completeness}%` }} />
                    </div>
                  </div>
                )}
                {qualityScores.specificity !== undefined && (
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs text-white/70">Specificity</span>
                      <span className="text-xs font-semibold text-[#FC9109]">{qualityScores.specificity}%</span>
                    </div>
                    <div className="w-full bg-white/10 rounded-full h-1">
                      <div className="bg-gradient-to-r from-[#FC9109] to-[#DD6800] h-1 rounded-full transition-all duration-300" 
                           style={{ width: `${qualityScores.specificity}%` }} />
                    </div>
                  </div>
                )}
                {qualityScores.overall !== undefined && (
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs text-white/70">Overall</span>
                      <span className="text-xs font-semibold text-[#DD6800]">{qualityScores.overall}%</span>
                    </div>
                    <div className="w-full bg-white/10 rounded-full h-1">
                      <div className="bg-gradient-to-r from-[#DD6800] to-[#FBAE1C] h-1 rounded-full transition-all duration-300" 
                           style={{ width: `${qualityScores.overall}%` }} />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Key Metrics */}
          <div className="grid grid-cols-2 gap-2 mb-4">
            {icp?.company_size_range && (
              <div className="bg-white/5 backdrop-blur-sm rounded-lg p-2 border border-white/10">
                <div className="text-xs text-white/50">Company Size</div>
                <div className="text-sm font-semibold text-white">{icp.company_size_range}</div>
              </div>
            )}
            {icp?.industry_focus?.length > 0 && (
              <div className="bg-white/5 backdrop-blur-sm rounded-lg p-2 border border-white/10">
                <div className="text-xs text-white/50">Industries</div>
                <div className="text-sm font-semibold text-white">{icp.industry_focus.length}</div>
              </div>
            )}
          </div>

          {/* AI Insights */}
          {(qualityScores || icp?.metadata?.ai_insights) && (
            <div className="bg-gradient-to-r from-[#FBAE1C]/10 to-[#FC9109]/10 rounded-lg p-2 mb-4 border border-[#FBAE1C]/20">
              <div className="flex items-start gap-2">
                <Sparkles className="w-3 h-3 text-[#FBAE1C] mt-0.5" />
                <div className="flex-1">
                  <div className="text-xs font-medium text-[#FBAE1C]">AI Insights</div>
                  <p className="text-xs text-white/70">
                    {icp?.metadata?.ai_insights || 
                     (qualityScores?.overall ? `${qualityScores.overall}% optimized for outreach` : 'Ready for messaging')}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            <Button 
              onClick={() => setIsUnifiedModalOpen(true)}
              size="sm"
              className="flex-1 bg-gradient-to-r from-[#FBAE1C] to-[#FC9109] hover:shadow-lg hover:shadow-[#FBAE1C]/25 transition-all duration-200"
            >
              <Eye className="w-3 h-3 mr-1" />
              View Details
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="bg-white/5 hover:bg-white/10 border border-white/10"
              onClick={() => setIsUnifiedModalOpen(true)}
            >
              <Edit2 className="w-3 h-3" />
            </Button>
          </div>
        </div>

        {/* Decorative Glow */}
        <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-[#FBAE1C]/20 to-transparent rounded-bl-full blur-xl" />
      </Card>

      {/* Modals */}
      <ICPCreationModalV2
        isOpen={isCreationModalOpen}
        onClose={() => {
          setIsCreationModalOpen(false)
          fetchICP()
        }}
        onSuccess={() => {
          fetchICP()
        }}
        onGenerate={handleGenerate}
      />

      {icp && (
        <ICPUnifiedModal
          isOpen={isUnifiedModalOpen}
          onClose={() => {
            setIsUnifiedModalOpen(false)
            fetchICP()
          }}
          icp={icp}
          onUpdate={() => {
            fetchICP()
          }}
        />
      )}
    </>
  )
}