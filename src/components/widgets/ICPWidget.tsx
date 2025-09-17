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
        .select(`
          *,
          knowledge_base:product_link_id (
            title
          )
        `)
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
      <div className={`relative shadow-2xl rounded-3xl p-6 overflow-hidden border border-white/10 text-white ${className}`}
           style={{
             background: 'linear-gradient(135deg, rgba(251, 174, 28, 0.1) 0%, rgba(221, 104, 0, 0.05) 100%)',
             backdropFilter: 'blur(10px)',
             WebkitBackdropFilter: 'blur(10px)'
           }}>
        
        {/* Status Badge */}
        <div className="absolute top-4 right-4 z-30">
          <div className="bg-gray-700/50 text-gray-400 border border-gray-600/50 px-3 py-1 rounded-full text-xs">
            Not Created
          </div>
        </div>
  
        <div className="relative z-20">
          {/* Account Type */}
          <div className="text-sm font-light opacity-80 mb-1 tracking-wide">
            Free Account: 1 ICP Limit
          </div>
  
          {/* Empty Title Area */}
          <div className="flex items-center mb-2">
            <div className="text-5xl mr-3">🎯</div>
            <div className="text-4xl font-semibold">
              {/* Empty - no title to show */}
            </div>
          </div>
  
          {/* Central Icon and Message */}
          <div className="text-center py-8">
            <div className="relative inline-block mb-6" style={{ animation: 'float 3s ease-in-out infinite' }}>
              <div className="w-24 h-24 mx-auto rounded-full bg-gradient-to-br from-[#FBAE1C]/20 to-[#FC9109]/20 flex items-center justify-center border border-[#FBAE1C]/30">
                <span className="text-5xl">🎯</span>
              </div>
              <div className="absolute -top-2 -right-2 w-8 h-8 bg-gradient-to-br from-[#FBAE1C] to-[#FC9109] rounded-full flex items-center justify-center text-sm font-bold shadow-lg">
                1
              </div>
            </div>
            
            <h2 className="text-2xl font-bold mb-2" 
                style={{
                  background: 'linear-gradient(90deg, #FBAE1C 0%, #FC9109 25%, #DD6800 50%, #FC9109 75%, #FBAE1C 100%)',
                  backgroundSize: '200% auto',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                  animation: 'shimmer 3s linear infinite'
                }}>
              Define Your Ideal Customer
            </h2>
            
            <p className="text-gray-400 text-sm mb-8 leading-relaxed max-w-sm mx-auto">
              Create your first Ideal Customer Profile to unlock AI-powered message personalisation that gets responses
            </p>
          </div>
  
          {/* Benefits Grid */}
          <div className="grid grid-cols-3 gap-3 mb-8">
            <div className="rounded-xl p-3 text-center border border-white/5 hover:transform hover:-translate-y-0.5 transition-all duration-300"
                 style={{
                   background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.02) 100%)',
                   backdropFilter: 'blur(10px)'
                 }}>
              <div className="text-2xl mb-2">⚡</div>
              <p className="text-xs text-gray-300">10x Response Rate</p>
            </div>
            <div className="rounded-xl p-3 text-center border border-white/5 hover:transform hover:-translate-y-0.5 transition-all duration-300"
                 style={{
                   background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.02) 100%)',
                   backdropFilter: 'blur(10px)'
                 }}>
              <div className="text-2xl mb-2">🤖</div>
              <p className="text-xs text-gray-300">AI-Powered</p>
            </div>
            <div className="rounded-xl p-3 text-center border border-white/5 hover:transform hover:-translate-y-0.5 transition-all duration-300"
                 style={{
                   background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.02) 100%)',
                   backdropFilter: 'blur(10px)'
                 }}>
              <div className="text-2xl mb-2">🚀</div>
              <p className="text-xs text-gray-300">5min Setup</p>
            </div>
          </div>
  
          {/* What You'll Define Section */}
          <div className="bg-black/20 backdrop-blur-sm rounded-2xl p-4 mb-6 border border-white/5">
            <h4 className="text-xs font-medium text-white/50 uppercase tracking-wide mb-3">What You'll Define</h4>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <div className="w-1.5 h-1.5 rounded-full bg-[#FBAE1C]"></div>
                <span className="text-xs text-gray-300">Target job titles & decision makers</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-1.5 h-1.5 rounded-full bg-[#FC9109]"></div>
                <span className="text-xs text-gray-300">Company size & industry focus</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-1.5 h-1.5 rounded-full bg-[#DD6800]"></div>
                <span className="text-xs text-gray-300">Pain points & value drivers</span>
              </div>
            </div>
          </div>
  
          {/* CTA Button */}
          <button 
            onClick={() => setIsCreationModalOpen(true)}
            className="w-full bg-gradient-to-r from-[#FBAE1C] to-[#FC9109] text-white font-semibold py-4 px-6 rounded-xl hover:shadow-lg transition-all duration-200 text-sm flex items-center justify-center space-x-2 group"
          >
            <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" />
            <span>Create Your First ICP</span>
          </button>
  
          {/* Helper Text */}
          <p className="text-center text-xs text-gray-500 mt-4">
            Takes ~5 minutes • AI assists with suggestions
          </p>
        </div>
  
        {/* Decorative Elements */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-[#FBAE1C]/10 to-transparent rounded-bl-full blur-2xl"></div>
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-gradient-to-tr from-[#FC9109]/10 to-transparent rounded-tr-full blur-2xl"></div>
      </div>
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

  // Active State - Beautiful Version (and default for any other state)
  const qualityScores = icp?.metadata?.quality_scores || 
                        icp?.metadata?.ai_feedback?.quality_assessment?.scores || 
                        null

  return (
    <>
      {/* Main Widget Container - No Card wrapper, pure div with glass effect */}
      <div className={`relative shadow-2xl rounded-3xl p-6 overflow-hidden border border-white/10 text-white ${className}`}
           style={{
             background: 'linear-gradient(135deg, rgba(251, 174, 28, 0.1) 0%, rgba(221, 104, 0, 0.05) 100%)',
             backdropFilter: 'blur(10px)',
             WebkitBackdropFilter: 'blur(10px)'
           }}>
        
        {/* Status Badge */}
        <div className="absolute top-4 right-4 z-30">
          <div className="bg-green-500/20 text-green-400 border border-green-500/30 px-3 py-1 rounded-full text-xs flex items-center">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 mr-1.5 animate-pulse"></span>
            Live
          </div>
        </div>

        <div className="relative z-20">
          {/* Last Used */}
          <div className="text-sm font-light opacity-80 mb-1 tracking-wide">
            Last used: {icp?.updated_at ? formatDistanceToNow(new Date(icp.updated_at), { addSuffix: true }) : 'Never'}
          </div>

          {/* ICP Name with icon */}
          <div className="flex items-center mb-2">
            <div className="text-5xl mr-3">🎯</div>
            <div className="text-2xl font-semibold">
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#FBAE1C] to-[#FC9109]">
                {icp?.icp_name || 'B2B Sales Teams'}
              </span>
            </div>
          </div>

          {/* Product Name */}
          <div className="text-lg opacity-90 mb-4 tracking-wide">
            Product: {icp?.knowledge_base?.title?.replace(/^"|"$/g, '') || 'Error Displaying Title'}
          </div>

          {/* Description */}
          {icp?.description && (
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 flex items-start mb-4 border border-white/5 shadow-sm">
              <div className="text-2xl mr-2">📝</div>
              <div className="text-sm opacity-90 line-clamp-2">
                {icp.description}
              </div>
            </div>
          )}

          {/* Quality Assessment */}
          {qualityScores && (qualityScores.completeness || qualityScores.specificity || qualityScores.overall) && (
            <div className="bg-black/20 backdrop-blur-sm rounded-2xl p-4 mb-4 border border-white/5">
              <h4 className="text-xs font-medium text-white/50 uppercase tracking-wide mb-3">Quality Assessment</h4>
              <div className="space-y-3">
                {qualityScores.completeness !== undefined && (
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs text-white/70">Completeness</span>
                      <span className="text-xs font-semibold text-[#FBAE1C]">{qualityScores.completeness}%</span>
                    </div>
                    <div className="w-full bg-white/10 rounded-full h-1.5">
                      <div className="h-1.5 rounded-full" 
                           style={{ 
                             width: `${qualityScores.completeness}%`,
                             background: 'linear-gradient(90deg, #FBAE1C 0%, #FC9109 50%, #DD6800 100%)'
                           }}></div>
                    </div>
                  </div>
                )}
                {qualityScores.specificity !== undefined && (
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs text-white/70">Specificity</span>
                      <span className="text-xs font-semibold text-[#FC9109]">{qualityScores.specificity}%</span>
                    </div>
                    <div className="w-full bg-white/10 rounded-full h-1.5">
                      <div className="h-1.5 rounded-full" 
                           style={{ 
                             width: `${qualityScores.specificity}%`,
                             background: 'linear-gradient(90deg, #FBAE1C 0%, #FC9109 50%, #DD6800 100%)'
                           }}></div>
                    </div>
                  </div>
                )}
                {qualityScores.overall !== undefined && (
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs text-white/70">Overall</span>
                      <span className="text-xs font-semibold text-[#DD6800]">{qualityScores.overall}%</span>
                    </div>
                    <div className="w-full bg-white/10 rounded-full h-1.5">
                      <div className="h-1.5 rounded-full" 
                           style={{ 
                             width: `${qualityScores.overall}%`,
                             background: 'linear-gradient(90deg, #DD6800 0%, #FBAE1C 100%)'
                           }}></div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* Key Metrics */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            {icp?.company_size_range && (
              <div className="bg-white/5 backdrop-blur-sm rounded-xl p-3 border border-white/10">
                <div className="text-2xl mb-1">🏢</div>
                <div className="text-xs text-white/50">Company Size</div>
                <div className="text-sm font-semibold">{icp.company_size_range}</div>
              </div>
            )}
            {icp?.budget_range && (
              <div className="bg-white/5 backdrop-blur-sm rounded-xl p-3 border border-white/10">
                <div className="text-2xl mb-1">💰</div>
                <div className="text-xs text-white/50">Budget Range</div>
                <div className="text-sm font-semibold">{icp.budget_range}</div>
              </div>
            )}
          </div>

          {/* Industries */}
          {icp?.industry_focus && icp.industry_focus.length > 0 && (
            <div className="mb-4">
              <div className="flex flex-wrap gap-2">
                {icp.industry_focus.slice(0, 2).map((industry: string, idx: number) => (
                  <span key={idx} className="px-3 py-1 bg-gradient-to-r from-[#FBAE1C]/20 to-[#FC9109]/20 border border-[#FBAE1C]/30 rounded-full text-xs font-medium">
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
          {(icp?.metadata?.ai_feedback?.summary || qualityScores) && (
            <div className="bg-gradient-to-r from-[#FBAE1C]/10 to-[#FC9109]/10 rounded-xl p-3 mb-4 border border-[#FBAE1C]/20">
              <div className="flex items-start space-x-2">
                <span className="text-lg">✨</span>
                <div className="flex-1">
                  <div className="text-xs font-medium text-[#FBAE1C] mb-1">AI Insights</div>
                  <p className="text-xs text-white/70 leading-relaxed line-clamp-2">
                    {icp?.metadata?.ai_feedback?.summary || 
                     (qualityScores?.overall ? `${qualityScores.overall}% ready. Strong foundation with clear personas.` : 'Ready for messaging')}
                  </p>
                </div>
              </div>
            </div>
          )}
          {/* Action Buttons */}
          <div className="flex space-x-3">
            <button 
              onClick={() => setIsUnifiedModalOpen(true)}
              className="flex-1 bg-gradient-to-r from-[#FBAE1C] to-[#FC9109] text-white font-medium py-3 px-4 rounded-xl hover:shadow-lg transition-all duration-200 text-sm"
            >
              View Details
            </button>
            <button 
              onClick={() => setIsUnifiedModalOpen(true)}
              className="p-3 bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 hover:bg-white/10 transition-all duration-200"
            >
              <Edit2 className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Hover State Indicator */}
        <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-[#FBAE1C]/20 to-transparent rounded-bl-full blur-xl"></div>
      </div>

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
