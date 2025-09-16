import { useState, useEffect, useRef } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Plus } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/integrations/supabase/client'
import { formatDistanceToNow } from 'date-fns'
import { ICPCreationModalV2 } from '@/components/states/ICPCreationModalV2'
import { ICPUnifiedModal } from '@/components/icps/ICPUnifiedModal'

interface ICPWidgetProps {
  className?: string
}

type ICPState = 'empty' | 'generating' | 'draft' | 'reviewing' | 'active'

export function ICPWidget({ className }: ICPWidgetProps) {
  const { user } = useAuth()
  const [icp, setIcp] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [icpState, setIcpState] = useState<ICPState>('empty')
  const [isCreationModalOpen, setIsCreationModalOpen] = useState(false)
  const [isUnifiedModalOpen, setIsUnifiedModalOpen] = useState(false)
  const [currentStep, setCurrentStep] = useState(2)
  const intervalRef = useRef<NodeJS.Timeout>()

  useEffect(() => {
    if (user) {
      fetchICP()
    }
  }, [user])

  useEffect(() => {
    // Cycle through steps for generating and reviewing states
    if (icpState === 'generating' || icpState === 'reviewing') {
      intervalRef.current = setInterval(() => {
        setCurrentStep(prev => prev >= 4 ? 2 : prev + 1)
      }, 2000)
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [icpState])

  const fetchICP = async () => {
    if (!user) return
    
    setLoading(true)
    const { data } = await supabase
      .from('icps')
      .select('*')
      .eq('created_by', user.id)
      .eq('is_active', true)
      .limit(1)
      .single()

    if (data) {
      setIcp(data)
      // Determine ICP state based on workflow_status and review_status
      if (data.workflow_status === 'generating') {
        setIcpState('generating')
      } else if (data.workflow_status === 'processing' || data.workflow_status === 'reviewing') {
        setIcpState('reviewing')
      } else if (data.workflow_status === 'approved' && data.review_status === 'approved') {
        setIcpState('active')
      } else if (data.workflow_status === 'draft' || !data.workflow_status) {
        setIcpState('draft')
      } else {
        setIcpState('active')
      }
    } else {
      setIcpState('empty')
    }
    setLoading(false)
  }

  // Get quality scores from metadata or use defaults
  const qualityScores = icp?.metadata?.ai_feedback?.quality_assessment?.scores || {
    completeness: 92,
    specificity: 88,
    relevance: 85
  }

  const renderProgressStep = (stepNum: number, label: string, isCompleted: boolean = false) => {
    const isActive = currentStep === stepNum
    const themeColor = icpState === 'reviewing' ? 'blue' : 'purple'
    
    if (isCompleted) {
      return (
        <div className="flex items-center space-x-3">
          <div className="w-6 h-6 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center">
            <svg className="w-3 h-3 text-green-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="flex-1">
            <p className="text-xs text-gray-300">{label}</p>
          </div>
        </div>
      )
    }

    return (
      <div className="flex items-center space-x-3">
        <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
          isActive 
            ? `bg-${themeColor}-500/20 border border-${themeColor}-500/30` 
            : 'bg-gray-700/50 border border-gray-600'
        }`}>
          {isActive ? (
            <div className={`w-3 h-3 rounded-full bg-${themeColor}-400 animate-pulse`}></div>
          ) : (
            <span className="text-xs text-gray-500">{stepNum}</span>
          )}
        </div>
        <div className="flex-1">
          <p className={`text-xs ${isActive ? 'text-gray-300 font-medium' : 'text-gray-500'}`}>
            {label}
          </p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className={`relative bg-gradient-to-br from-[#FBAE1C]/10 via-transparent to-[#DD6800]/5 backdrop-blur-md shadow-2xl rounded-3xl p-6 overflow-hidden border border-white/10 ${className}`}>
        <div className="flex items-center justify-center h-[400px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#FBAE1C]"></div>
        </div>
      </div>
    )
  }

  return (
    <>
      <style jsx>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
        
        @keyframes pulse-glow {
          0%, 100% { 
            box-shadow: 0 0 20px rgba(251, 174, 28, 0.3);
          }
          50% { 
            box-shadow: 0 0 40px rgba(251, 174, 28, 0.5);
          }
        }
        
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        
        .float-animation {
          animation: float 3s ease-in-out infinite;
        }
        
        .shimmer-text {
          background: linear-gradient(
            90deg,
            #FBAE1C 0%,
            #FC9109 25%,
            #DD6800 50%,
            #FC9109 75%,
            #FBAE1C 100%
          );
          background-size: 200% auto;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: shimmer 3s linear infinite;
        }
        
        .shimmer-bg {
          background: linear-gradient(
            90deg,
            rgba(251, 174, 28, 0.3) 0%,
            rgba(252, 145, 9, 0.5) 50%,
            rgba(251, 174, 28, 0.3) 100%
          );
          background-size: 200% 100%;
          animation: shimmer 3s linear infinite;
        }
      `}</style>

      {/* Main Widget Container - Fixed Size */}
      <div className={`relative bg-gradient-to-br from-[#FBAE1C]/10 via-transparent to-[#DD6800]/5 backdrop-blur-md shadow-2xl rounded-3xl p-6 overflow-hidden border border-white/10 text-white ${className}`}>
        
        {/* Status Badge */}
        <div className="absolute top-4 right-4 z-30">
          {icpState === 'empty' && (
            <div className="bg-gray-700/50 text-gray-400 border border-gray-600/50 px-3 py-1 rounded-full text-xs">
              Not Created
            </div>
          )}
          {icpState === 'generating' && (
            <div className="bg-purple-500/20 text-purple-400 border border-purple-500/30 px-3 py-1 rounded-full text-xs flex items-center">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-400 mr-1.5 animate-pulse"></span>
              Generating
            </div>
          )}
          {icpState === 'draft' && (
            <div className="bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 px-3 py-1 rounded-full text-xs flex items-center">
              <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 mr-1.5"></span>
              Draft
            </div>
          )}
          {icpState === 'reviewing' && (
            <div className="bg-blue-500/20 text-blue-400 border border-blue-500/30 px-3 py-1 rounded-full text-xs flex items-center">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 mr-1.5 animate-pulse"></span>
              Reviewing
            </div>
          )}
          {icpState === 'active' && (
            <div className="bg-green-500/20 text-green-400 border border-green-500/30 px-3 py-1 rounded-full text-xs flex items-center">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 mr-1.5 animate-pulse"></span>
              Live
            </div>
          )}
        </div>

        <div className="relative z-20">
          {/* Empty State */}
          {icpState === 'empty' && (
            <>
              <div className="text-sm font-light opacity-80 mb-1 tracking-wide">
                Free Account: 1 ICP Limit
              </div>
              <div className="flex items-center mb-2">
                <div className="text-5xl mr-3">🎯</div>
                <div className="text-4xl font-semibold">
                  <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#FBAE1C] to-[#FC9109]">
                    {/* Empty */}
                  </span>
                </div>
              </div>

              {/* Central Icon and Message */}
              <div className="text-center py-8">
                <div className="relative inline-block mb-6 float-animation">
                  <div className="w-24 h-24 mx-auto rounded-full bg-gradient-to-br from-[#FBAE1C]/20 to-[#FC9109]/20 flex items-center justify-center border border-[#FBAE1C]/30">
                    <span className="text-5xl">🎯</span>
                  </div>
                  <div className="absolute -top-2 -right-2 w-8 h-8 bg-gradient-to-br from-[#FBAE1C] to-[#FC9109] rounded-full flex items-center justify-center text-sm font-bold shadow-lg">
                    1
                  </div>
                </div>
                
                <h2 className="text-2xl font-bold mb-2 shimmer-text">
                  Define Your Ideal Customer
                </h2>
                
                <p className="text-gray-400 text-sm mb-8 leading-relaxed max-w-sm mx-auto">
                  Create your first Ideal Customer Profile to unlock AI-powered message personalisation that gets responses
                </p>
              </div>

              {/* Benefits Grid */}
              <div className="grid grid-cols-3 gap-3 mb-8">
                <div className="bg-white/5 backdrop-blur-sm rounded-xl p-3 text-center border border-white/5 hover:bg-white/10 transition-all">
                  <div className="text-2xl mb-2">⚡</div>
                  <p className="text-xs text-gray-300">10x Response Rate</p>
                </div>
                <div className="bg-white/5 backdrop-blur-sm rounded-xl p-3 text-center border border-white/5 hover:bg-white/10 transition-all">
                  <div className="text-2xl mb-2">🤖</div>
                  <p className="text-xs text-gray-300">AI-Powered</p>
                </div>
                <div className="bg-white/5 backdrop-blur-sm rounded-xl p-3 text-center border border-white/5 hover:bg-white/10 transition-all">
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
              <Button 
                onClick={() => setIsCreationModalOpen(true)}
                className="w-full bg-gradient-to-r from-[#FBAE1C] to-[#FC9109] text-white font-semibold py-4 px-6 rounded-xl hover:shadow-lg transition-all duration-200 text-sm flex items-center justify-center space-x-2 group"
              >
                <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" />
                <span>Create Your First ICP</span>
              </Button>

              {/* Helper Text */}
              <p className="text-center text-xs text-gray-500 mt-4">
                Takes ~5 minutes • AI assists with suggestions
              </p>
            </>
          )}

          {/* Generating State */}
          {icpState === 'generating' && (
            <>
              <div className="text-sm font-light opacity-10 mb-1 tracking-wide">
                Creating your ICP...
              </div>
              
              {/* ICP Name placeholder */}
              <div className="flex items-center mb-4">
                <div className="text-5xl mr-3">🎯</div>
                <div className="flex-1">
                  <div className="h-10 bg-gradient-to-r from-white/5 to-white/10 rounded-lg mb-2 animate-pulse"></div>
                  <div className="h-4 w-32 bg-gradient-to-r from-white/5 to-white/10 rounded animate-pulse"></div>
                </div>
              </div>

              <div className="text-lg opacity-90 mb-6 tracking-wide">
                Product: Cold AI Free
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
                  {renderProgressStep(1, 'Collecting your inputs', true)}
                  {renderProgressStep(2, 'Analysing market data')}
                  {renderProgressStep(3, 'Building buyer personas')}
                  {renderProgressStep(4, 'Creating messaging framework')}
                </div>
              </div>

              {/* Estimated Time */}
              <div className="text-center">
                <p className="text-xs text-gray-500">
                  This may take a couple of minutes
                </p>
              </div>
            </>
          )}

          {/* Draft State (Edit/Approve) */}
          {icpState === 'draft' && (
            <>
              <div className="text-sm font-light opacity-80 mb-1 tracking-wide">
                Review and approve
              </div>

              {/* ICP Name with icon */}
              <div className="flex items-center mb-2">
                <div className="text-5xl mr-3">🎯</div>
                <div className="text-4xl font-semibold">
                  <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#FBAE1C] to-[#FC9109]">
                    {icp?.icp_name || 'B2B Sales Teams'}
                  </span>
                </div>
              </div>

              {/* Product Name */}
              <div className="text-lg opacity-90 mb-4 tracking-wide">
                Product: Cold AI Free
              </div>

              {/* Description */}
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 flex items-start mb-4 border border-white/5 shadow-sm">
                <div className="text-2xl mr-2 text-[#FBAE1C]">📝</div>
                <div className="text-sm opacity-90">
                  {icp?.description || 'High-growth B2B companies with dedicated sales teams who rely on LinkedIn for outreach'}
                </div>
              </div>

              {/* AI Suggestions Available */}
              <div className="bg-yellow-500/10 backdrop-blur-sm rounded-xl p-4 mb-6 border border-yellow-500/20">
                <div className="flex items-center justify-center space-x-3">
                  <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center">
                    <span className="text-xl">✨</span>
                  </div>
                  <div>
                    <p className="text-sm text-yellow-300 font-medium">AI suggestions ready</p>
                    <p className="text-xs text-yellow-300/70">Review and customise your ICP</p>
                  </div>
                </div>
              </div>

            {/* Draft Quality Scores */}
            <div className="bg-black/20 backdrop-blur-sm rounded-2xl p-4 mb-4 border border-white/5">
              <h4 className="text-xs font-medium text-white/50 uppercase tracking-wide mb-3">Quality Assessment</h4>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs text-white/70">Completeness</span>
                    <span className="text-xs font-semibold bg-gradient-to-r from-[#FBAE1C] to-[#FC9109] bg-clip-text text-transparent">
                      {qualityScores.completeness}%
                    </span>
                  </div>
                  <div className="w-full bg-white/10 rounded-full h-1.5">
                    <div 
                      className="bg-gradient-to-r from-[#FBAE1C] to-[#FC9109] h-1.5 rounded-full" 
                      style={{ width: `${qualityScores.completeness}%` }}
                    ></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs text-white/70">Specificity</span>
                    <span className="text-xs font-semibold bg-gradient-to-r from-[#FBAE1C] to-[#FC9109] bg-clip-text text-transparent">
                      {qualityScores.specificity}%
                    </span>
                  </div>
                  <div className="w-full bg-white/10 rounded-full h-1.5">
                    <div 
                      className="bg-gradient-to-r from-[#FBAE1C] to-[#FC9109] h-1.5 rounded-full" 
                      style={{ width: `${qualityScores.specificity}%` }}
                    ></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs text-white/70">Relevance</span>
                    <span className="text-xs font-semibold bg-gradient-to-r from-[#FBAE1C] to-[#FC9109] bg-clip-text text-transparent">
                      {qualityScores.relevance}%
                    </span>
                  </div>
                  <div className="w-full bg-white/10 rounded-full h-1.5">
                    <div 
                      className="bg-gradient-to-r from-[#FBAE1C] to-[#FC9109] h-1.5 rounded-full" 
                      style={{ width: `${qualityScores.relevance}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>

              {/* Industries */}
              <div className="mb-4">
                <div className="flex flex-wrap gap-2">
                  <span className="px-3 py-1 bg-gradient-to-r from-[#FBAE1C]/20 to-[#FC9109]/20 border border-[#FBAE1C]/30 rounded-full text-xs font-medium">
                    B2B SaaS
                  </span>
                  <span className="px-3 py-1 bg-gradient-to-r from-[#FBAE1C]/20 to-[#FC9109]/20 border border-[#FBAE1C]/30 rounded-full text-xs font-medium">
                    Tech Services
                  </span>
                </div>
              </div>

              {/* Edit & Approve Button */}
              <Button 
                onClick={() => setIsUnifiedModalOpen(true)}
                className="w-full bg-gradient-to-r from-[#FBAE1C] to-[#FC9109] text-white font-semibold py-3 px-4 rounded-xl hover:shadow-lg transition-all duration-200 text-sm"
              >
                Edit & Approve
              </Button>
            </>
          )}

          {/* Reviewing State */}
          {icpState === 'reviewing' && (
            <>
              <div className="text-sm font-light opacity-10 mb-1 tracking-wide">
                Available for message generation
              </div>

              {/* ICP Name with icon */}
              <div className="flex items-center mb-2">
                <div className="text-5xl mr-3">🎯</div>
                <div className="text-4xl font-semibold">
                  <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#FBAE1C] to-[#FC9109]">
                    {icp?.icp_name || 'B2B Sales Teams'}
                  </span>
                </div>
              </div>

              {/* Product Name */}
              <div className="text-lg opacity-90 mb-4 tracking-wide">
                Product: Cold AI Pro
              </div>

              {/* Description */}
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 flex items-start mb-4 border border-white/5 shadow-sm">
                <div className="text-2xl mr-2 text-[#FBAE1C]">📝</div>
                <div className="text-sm opacity-90">
                  {icp?.description || 'High-growth B2B companies with dedicated sales teams who rely on LinkedIn for outreach'}
                </div>
              </div>

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
                  {renderProgressStep(1, 'Collecting your inputs', true)}
                  {renderProgressStep(2, 'Analysing your updates')}
                  {renderProgressStep(3, 'Redefining buyer personas')}
                  {renderProgressStep(4, 'Updating messaging framework')}
                </div>
              </div>

              {/* Footer Notes */}
              <div className="text-center">
                <p className="text-xs text-gray-500">
                  Regenerating your suggestions. Your ICP is ready for message generation.
                </p>
              </div>
            </>
          )}

          {/* Active State */}
          {icpState === 'active' && (
            <>
              <div className="text-sm font-light opacity-80 mb-1 tracking-wide">
                Last used: {icp?.updated_at ? formatDistanceToNow(new Date(icp.updated_at), { addSuffix: true }) : '2 hours ago'}
              </div>

              {/* ICP Name with icon */}
              <div className="flex items-center mb-2">
                <div className="text-5xl mr-3">🎯</div>
                <div className="text-4xl font-semibold">
                  <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#FBAE1C] to-[#FC9109]">
                    {icp?.icp_name || 'B2B Sales Teams'}
                  </span>
                </div>
              </div>

              {/* Product Name */}
              <div className="text-lg opacity-90 mb-4 tracking-wide">
                Product: Cold AI Pro
              </div>

              {/* Description */}
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 flex items-start mb-4 border border-white/5 shadow-sm">
                <div className="text-2xl mr-2 text-[#FBAE1C]">📝</div>
                <div className="text-sm opacity-90">
                  {icp?.description || 'High-growth B2B companies with dedicated sales teams who rely on LinkedIn for outreach'}
                </div>
              </div>

              {/* Quality Assessment */}
              <div className="bg-black/20 backdrop-blur-sm rounded-2xl p-4 mb-4 border border-white/5">
                <h4 className="text-xs font-medium text-white/50 uppercase tracking-wide mb-3">Quality Assessment</h4>
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs text-white/70">Completeness</span>
                      <span className="text-xs font-semibold bg-gradient-to-r from-[#FBAE1C] to-[#FC9109] bg-clip-text text-transparent">
                        {qualityScores.completeness}%
                      </span>
                    </div>
                    <div className="w-full bg-white/10 rounded-full h-1.5">
                      <div 
                        className="bg-gradient-to-r from-[#FBAE1C] to-[#FC9109] h-1.5 rounded-full"
                        style={{ width: `${qualityScores.completeness}%` }}
                      ></div>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs text-white/70">Specificity</span>
                      <span className="text-xs font-semibold bg-gradient-to-r from-[#FC9109] to-[#DD6800] bg-clip-text text-transparent">
                        {qualityScores.specificity}%
                      </span>
                    </div>
                    <div className="w-full bg-white/10 rounded-full h-1.5">
                      <div 
                        className="bg-gradient-to-r from-[#FC9109] to-[#DD6800] h-1.5 rounded-full"
                        style={{ width: `${qualityScores.specificity}%` }}
                      ></div>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs text-white/70">Relevance</span>
                      <span className="text-xs font-semibold bg-gradient-to-r from-[#DD6800] to-[#FC9109] bg-clip-text text-transparent">
                        {qualityScores.relevance}%
                      </span>
                    </div>
                    <div className="w-full bg-white/10 rounded-full h-1.5">
                      <div 
                        className="bg-gradient-to-r from-[#DD6800] to-[#FC9109] h-1.5 rounded-full"
                        style={{ width: `${qualityScores.relevance}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Key Metrics */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-white/5 backdrop-blur-sm rounded-xl p-3 border border-white/10">
                  <div className="text-2xl mb-1">🏢</div>
                  <div className="text-xs text-white/50">Company Size</div>
                  <div className="text-sm font-semibold">
                    {icp?.company_size_range || '50-500'}
                  </div>
                </div>
                <div className="bg-white/5 backdrop-blur-sm rounded-xl p-3 border border-white/10">
                  <div className="text-2xl mb-1">💰</div>
                  <div className="text-xs text-white/50">Budget Range</div>
                  <div className="text-sm font-semibold">£2K-10K/mo</div>
                </div>
              </div>

              {/* Industries */}
              <div className="mb-4">
                <div className="flex flex-wrap gap-2">
                  {icp?.industry_focus?.slice(0, 2).map((industry: string, idx: number) => (
                    <span 
                      key={idx}
                      className="px-3 py-1 bg-gradient-to-r from-[#FBAE1C]/20 to-[#FC9109]/20 border border-[#FBAE1C]/30 rounded-full text-xs font-medium"
                    >
                      {industry}
                    </span>
                  ))}
                  {icp?.industry_focus?.length > 2 && (
                    <span className="px-3 py-1 bg-gradient-to-r from-[#FBAE1C]/20 to-[#FC9109]/20 border border-[#FBAE1C]/30 rounded-full text-xs font-medium">
                      +{icp.industry_focus.length - 2} more
                    </span>
                  )}
                </div>
              </div>

              {/* AI Summary */}
              <div className="shimmer-bg rounded-xl p-3 mb-4 border border-[#FBAE1C]/20">
                <div className="flex items-start space-x-2">
                  <span className="text-lg">✨</span>
                  <div className="flex-1">
                    <div className="text-xs font-medium text-[#FBAE1C] mb-1">AI Insights</div>
                    <p className="text-xs text-white/70 leading-relaxed">
                      88% ready. Strong foundation with clear personas. 3 buyer profiles identified.
                    </p>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex space-x-3">
                <Button 
                  onClick={() => setIsUnifiedModalOpen(true)}
                  className="flex-1 bg-gradient-to-r from-[#FBAE1C] to-[#FC9109] text-white font-medium py-3 px-4 rounded-xl hover:shadow-lg transition-all duration-200 text-sm"
                >
                  View Details
                </Button>
                <button className="p-3 bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 hover:bg-white/10 transition-all duration-200">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              </div>
            </>
          )}
        </div>

        {/* Decorative Elements */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-[#FBAE1C]/10 to-transparent rounded-bl-full blur-2xl"></div>
        {icpState === 'reviewing' && (
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-gradient-to-tr from-blue-500/10 to-transparent rounded-tr-full blur-2xl"></div>
        )}
        {icpState === 'generating' && (
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-gradient-to-tr from-purple-500/10 to-transparent rounded-tr-full blur-2xl"></div>
        )}
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
        onGenerate={() => {
          setIcpState('generating')
        }}
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
