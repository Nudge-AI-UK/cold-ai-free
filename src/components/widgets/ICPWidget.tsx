import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Plus, Loader2, Edit2, Eye, Trash2 } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/integrations/supabase/client'
import { formatDistanceToNow } from 'date-fns'
import { useModalFlow } from '@/components/modals/ModalFlowManager'

interface ICPWidgetProps {
  className?: string
  isActive?: boolean
  onActivate?: () => void
  forceEmpty?: boolean
}

type ICPState = 'empty' | 'generating' | 'draft' | 'reviewing' | 'active'

export function ICPWidget({ className }: ICPWidgetProps) {
  const { user } = useAuth()
  const { openModal } = useModalFlow()
  const [icp, setIcp] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [icpState, setIcpState] = useState<ICPState>('empty')
  const [currentStep, setCurrentStep] = useState(2)

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

  // Poll for ICP updates when in generating state
  useEffect(() => {
    if (icpState === 'generating' && user) {
      const pollInterval = setInterval(() => {
        fetchICP()
      }, 5000) // Check every 5 seconds

      return () => clearInterval(pollInterval)
    }
  }, [icpState, user])

  // Animate progress steps for generating and reviewing states
  useEffect(() => {
    if (icpState === 'generating' || icpState === 'reviewing') {
      const interval = setInterval(() => {
        setCurrentStep(prev => prev >= 4 ? 2 : prev + 1)
      }, 2000)
      return () => clearInterval(interval)
    }
  }, [icpState])

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
        .eq('created_by', user?.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()


      if (data) {
        setIcp(data)

        // Determine state based on workflow_status first (most specific)
        if (data.workflow_status === 'draft') {
          setIcpState('draft')
        } else if (data.workflow_status === 'generating' || data.workflow_status === 'form') {
          setIcpState('generating')
        } else if (data.workflow_status === 'reviewing') {
          setIcpState('reviewing')
        } else if (data.workflow_status === 'approved') {
          setIcpState('active')
        }
        // Fall back to is_active check if workflow_status doesn't tell us
        else if (data.is_active === false) {
          setIcpState('generating')
        } else if (data.is_active === true) {
          setIcpState('active')
        } else {
          // No workflow_status and no is_active, default to empty
          setIcpState('empty')
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

  const handleDelete = async () => {
    if (!icp || !window.confirm('Are you sure you want to delete this ICP? This cannot be undone.')) {
      return
    }

    try {
      const { error } = await supabase
        .from('icps')
        .delete()
        .eq('id', icp.id)

      if (error) throw error

      alert('ICP deleted successfully')
      setIcp(null)
      setIcpState('empty')
      fetchICP()
    } catch (error: any) {
      console.error('Error deleting ICP:', error)
      alert('Failed to delete ICP')
    }
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
            onClick={() => openModal('icp-edit', { flowName: 'main', mode: 'add' })}
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
      <div className={`relative shadow-2xl rounded-3xl p-6 overflow-hidden border border-white/10 text-white ${className}`}
           style={{
             background: 'linear-gradient(135deg, rgba(251, 174, 28, 0.1) 0%, rgba(221, 104, 0, 0.05) 100%)',
             backdropFilter: 'blur(10px)',
             WebkitBackdropFilter: 'blur(10px)'
           }}>
        
        {/* Status Badge */}
        <div className="absolute top-4 right-4 z-30">
          <div className="bg-purple-500/20 text-purple-400 border border-purple-500/30 px-3 py-1 rounded-full text-xs flex items-center">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-400 mr-1.5 animate-pulse"></span>
            Generating
          </div>
        </div>
  
        <div className="relative z-20">
          {/* Creating text */}
          <div className="text-sm font-light opacity-10 mb-1 tracking-wide">
            Creating your ICP...
          </div>
          
          {/* ICP Name placeholder with icon */}
          <div className="flex items-center mb-4">
            <div className="text-5xl mr-3">🎯</div>
            <div className="flex-1">
              <div className="h-10 rounded-lg mb-2 animate-pulse"
                   style={{
                     background: 'linear-gradient(90deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.1) 50%, rgba(255, 255, 255, 0.05) 100%)',
                     backgroundSize: '200% 100%',
                     animation: 'shimmer 1.5s infinite'
                   }}></div>
              <div className="h-4 w-32 rounded animate-pulse"
                   style={{
                     background: 'linear-gradient(90deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.1) 50%, rgba(255, 255, 255, 0.05) 100%)',
                     backgroundSize: '200% 100%',
                     animation: 'shimmer 1.5s infinite'
                   }}></div>
            </div>
          </div>
  
          {/* Product Name */}
          <div className="text-lg opacity-90 mb-6 tracking-wide">
            Product: {icp?.knowledge_base?.title?.replace(/^"|"$/g, '') || 'Cold AI Free'}
          </div>
  
          {/* AI Generation Status */}
          <div className="bg-purple-500/10 backdrop-blur-sm rounded-xl p-4 mb-6 border border-purple-500/20">
            <div className="flex items-center justify-center space-x-3 mb-4">
              <div className="relative">
                <div className="w-12 h-12 rounded-full bg-purple-500/20 flex items-center justify-center">
                  <span className="text-2xl">🤖</span>
                </div>
                <div className="absolute inset-0 rounded-full border-2 border-purple-400 border-t-transparent animate-spin"></div>
              </div>
              <div className="flex space-x-1">
                <span className="w-2 h-2 bg-purple-400 rounded-full animate-pulse"></span>
                <span className="w-2 h-2 bg-purple-400 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></span>
                <span className="w-2 h-2 bg-purple-400 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></span>
              </div>
            </div>
            <p className="text-center text-sm text-purple-300 font-medium mb-1">
              Cold AI is creating your ICP
            </p>
            <p className="text-center text-xs text-purple-300/70">
              Analysing your inputs and generating insights...
            </p>
          </div>
  
          {/* Progress Steps */}
          <div className="bg-black/20 backdrop-blur-sm rounded-2xl p-4 mb-6 border border-white/5">
            <div className="space-y-3">
              {/* Step 1 - Always completed */}
              <div className="flex items-center space-x-3">
                <div className="w-6 h-6 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center">
                  <svg className="w-3 h-3 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="text-xs text-gray-300">Collecting your inputs</p>
                </div>
              </div>
              
              {/* Steps 2-4 */}
              {[
                { num: 2, text: 'Analysing market data' },
                { num: 3, text: 'Building buyer personas' },
                { num: 4, text: 'Creating messaging framework' }
              ].map(step => (
                <div key={step.num} className="flex items-center space-x-3">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                    currentStep === step.num 
                      ? 'bg-purple-500/20 border border-purple-500/30' 
                      : 'bg-gray-700/50 border border-gray-600'
                  }`}>
                    {currentStep === step.num ? (
                      <div className="w-3 h-3 rounded-full bg-purple-400 animate-pulse"></div>
                    ) : (
                      <span className="text-xs text-gray-500">{step.num}</span>
                    )}
                  </div>
                  <div className="flex-1">
                    <p className={`text-xs ${
                      currentStep === step.num ? 'text-gray-300 font-medium' : 'text-gray-500'
                    }`}>
                      {step.text}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
  
          {/* Estimated Time */}
          <div className="text-center">
            <p className="text-xs text-gray-500">
              This may take a couple of minutes
            </p>
          </div>
        </div>
        
        {/* Decorative Elements */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-purple-500/10 to-transparent rounded-bl-full blur-2xl"></div>
      </div>
    )
  }

  // Draft State
  if (icpState === 'draft') {
    const qualityScores = icp?.metadata?.quality_scores || 
                          icp?.metadata?.ai_feedback?.quality_assessment?.scores || 
                          null
  
    return (
      <>
        <div className={`relative shadow-2xl rounded-3xl p-6 overflow-hidden border border-white/10 text-white ${className}`}
             style={{
               background: 'linear-gradient(135deg, rgba(251, 174, 28, 0.1) 0%, rgba(221, 104, 0, 0.05) 100%)',
               backdropFilter: 'blur(10px)',
               WebkitBackdropFilter: 'blur(10px)'
             }}>
          
          {/* Status Badge - Yellow for Draft */}
          <div className="absolute top-4 right-4 z-30">
            <div className="bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 px-3 py-1 rounded-full text-xs flex items-center">
              <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 mr-1.5 animate-pulse"></span>
              Draft
            </div>
          </div>
  
          <div className="relative z-20">
            {/* Header Text */}
            <div className="text-sm font-light opacity-80 mb-1 tracking-wide">
              Edit & Approve Your ICP
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
            
            {/* Action Buttons - Different for Draft */}
            <div className="flex space-x-3">
              <button
                onClick={() => openModal('icp-edit', { mode: 'edit', data: { icp }, flowName: 'main' })}
                className="flex-1 bg-gradient-to-r from-[#FBAE1C] to-[#FC9109] text-white font-medium py-3 px-4 rounded-xl hover:shadow-lg transition-all duration-200 text-sm"
              >
                Edit & Approve
              </button>
              <button
                onClick={() => openModal('icp-edit', { mode: 'view', data: { icp }, flowName: 'main' })}
                className="p-3 bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 hover:bg-white/10 transition-all duration-200"
              >
                <Eye className="w-5 h-5" />
              </button>
              <button
                onClick={handleDelete}
                className="p-3 bg-red-500/20 hover:bg-red-500/30 rounded-xl border border-red-500/30 hover:border-red-500/40 transition-all duration-200"
                title="Delete ICP"
              >
                <Trash2 className="w-5 h-5 text-red-400" />
              </button>
            </div>
          </div>
  
          {/* Hover State Indicator */}
          <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-[#FBAE1C]/20 to-transparent rounded-bl-full blur-xl"></div>
        </div>

      </>
    )
  }

  // Reviewing State
  if (icpState === 'reviewing') {
    return (
      <div className={`relative shadow-2xl rounded-3xl p-6 overflow-hidden border border-white/10 text-white ${className}`}
           style={{
             background: 'linear-gradient(135deg, rgba(251, 174, 28, 0.1) 0%, rgba(221, 104, 0, 0.05) 100%)',
             backdropFilter: 'blur(10px)',
             WebkitBackdropFilter: 'blur(10px)'
           }}>
        
        {/* Status Badge */}
        <div className="absolute top-4 right-4 z-30">
          <div className="bg-blue-500/20 text-blue-400 border border-blue-500/30 px-3 py-1 rounded-full text-xs flex items-center">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 mr-1.5 animate-pulse"></span>
            Reviewing
          </div>
        </div>
  
        <div className="relative z-20">
          {/* Available text */}
          <div className="text-sm font-light opacity-10 mb-1 tracking-wide">
            Available for message generation
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
            Product: {icp?.knowledge_base?.title?.replace(/^"|"$/g, '') || 'Cold AI Pro'}
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
  
          {/* AI Review Status */}
          <div className="bg-blue-500/10 backdrop-blur-sm rounded-xl p-4 mb-6 border border-blue-500/20">
            <div className="flex items-center justify-center space-x-3 mb-4">
              <div className="relative">
                <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center">
                  <span className="text-2xl">🤖</span>
                </div>
                <div className="absolute inset-0 rounded-full border-2 border-blue-400 border-t-transparent animate-spin"></div>
              </div>
              <div className="flex space-x-1">
                <span className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></span>
                <span className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></span>
                <span className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></span>
              </div>
            </div>
            <p className="text-center text-sm text-blue-300 font-medium mb-1">
              Cold AI is reviewing your ICP
            </p>
            <p className="text-center text-xs text-blue-300/70">
              Analysing your changes and updating insights...
            </p>
          </div>
  
          {/* Progress Steps */}
          <div className="bg-black/20 backdrop-blur-sm rounded-2xl p-4 mb-6 border border-white/5">
            <div className="space-y-3">
              {/* Step 1 - Always completed */}
              <div className="flex items-center space-x-3">
                <div className="w-6 h-6 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center">
                  <svg className="w-3 h-3 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="text-xs text-gray-300">Collecting your inputs</p>
                </div>
              </div>
              
              {/* Steps 2-4 */}
              {[
                { num: 2, text: 'Analysing your updates' },
                { num: 3, text: 'Redefining buyer personas' },
                { num: 4, text: 'Updating messaging framework' }
              ].map(step => (
                <div key={step.num} className="flex items-center space-x-3">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                    currentStep === step.num 
                      ? 'bg-blue-500/20 border border-blue-500/30' 
                      : 'bg-gray-700/50 border border-gray-600'
                  }`}>
                    {currentStep === step.num ? (
                      <div className="w-3 h-3 rounded-full bg-blue-400 animate-pulse"></div>
                    ) : (
                      <span className="text-xs text-gray-500">{step.num}</span>
                    )}
                  </div>
                  <div className="flex-1">
                    <p className={`text-xs ${
                      currentStep === step.num ? 'text-gray-300 font-medium' : 'text-gray-500'
                    }`}>
                      {step.text}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
  
          {/* View Details Button */}
          <button
            onClick={() => openModal('icp-edit', { mode: 'view', data: { icp }, flowName: 'main' })}
            className="w-full bg-gradient-to-r from-[#FBAE1C] to-[#FC9109] text-white font-medium py-3 px-4 rounded-xl hover:shadow-lg transition-all duration-200 text-sm mb-4"
          >
            View Details
          </button>
  
          {/* Footer Notes */}
          <div className="text-center">
            <p className="text-xs text-gray-500">
              Regenerating your suggestions. Your ICP is ready for message generation.
            </p>
          </div>
        </div>
        
        {/* Decorative Elements */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-500/10 to-transparent rounded-bl-full blur-2xl"></div>
      </div>
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
            Last used: {icp?.last_used ? formatDistanceToNow(new Date(icp.last_used), { addSuffix: true }) : 'Never used'}
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
              onClick={() => openModal('icp-edit', { mode: 'view', data: { icp }, flowName: 'main' })}
              className="flex-1 bg-gradient-to-r from-[#FBAE1C] to-[#FC9109] text-white font-medium py-3 px-4 rounded-xl hover:shadow-lg transition-all duration-200 text-sm"
            >
              View Details
            </button>
            <button
              onClick={() => openModal('icp-edit', { mode: 'edit', data: { icp }, flowName: 'main' })}
              className="p-3 bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 hover:bg-white/10 transition-all duration-200"
            >
              <Edit2 className="w-5 h-5" />
            </button>
            <button
              onClick={handleDelete}
              className="p-3 bg-red-500/20 hover:bg-red-500/30 rounded-xl border border-red-500/30 hover:border-red-500/40 transition-all duration-200"
              title="Delete ICP"
            >
              <Trash2 className="w-5 h-5 text-red-400" />
            </button>
          </div>
        </div>

        {/* Hover State Indicator */}
        <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-[#FBAE1C]/20 to-transparent rounded-bl-full blur-xl"></div>
      </div>

    </>
  )
}
