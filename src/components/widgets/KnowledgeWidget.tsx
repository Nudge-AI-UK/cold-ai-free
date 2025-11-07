// src/components/KnowledgeWidget.tsx
import { useState, useEffect } from 'react'
import { Plus, Edit2, Trash2 } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'
import { useModalFlow } from '@/components/modals/ModalFlowManager'
import { useSimpleSubscription } from '@/hooks/useSimpleSubscription'
import { HoverTooltip } from '@/components/ui/HoverTooltip'
import { useOnboardingState } from '@/hooks/useOnboardingState'
import { OnboardingArrow } from '@/components/ui/onboarding-arrow'
import type { Database } from '@/types/supabase'

type KnowledgeEntry = Database['public']['Tables']['knowledge_base']['Row']

interface KnowledgeWidgetProps {
  forceEmpty?: boolean
  className?: string
}

export function KnowledgeWidget({ forceEmpty, className }: KnowledgeWidgetProps) {
  const { user } = useAuth()
  const { openModal } = useModalFlow()
  const { planType } = useSimpleSubscription(user?.id)
  const { currentStep: onboardingStep } = useOnboardingState()
  const [entry, setEntry] = useState<KnowledgeEntry | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [currentStep, setCurrentStep] = useState(2)

  // Check if this widget should be highlighted for onboarding
  const isOnboardingHighlight = onboardingStep === 'product'

  // Check if user can edit product (for free users, limit to once per day)
  const canEditProduct = () => {
    if (!entry) return false

    // If not free plan, allow editing anytime
    if (planType !== 'free') return true

    // For free users, check if 24 hours have passed since last review
    if (!entry.reviewed_at) return true // Never reviewed, can edit

    const reviewedAt = new Date(entry.reviewed_at)
    const now = new Date()
    const hoursSinceReview = (now.getTime() - reviewedAt.getTime()) / (1000 * 60 * 60)

    return hoursSinceReview >= 24
  }

  const getEditLimitMessage = () => {
    if (!entry?.reviewed_at) return ''

    const reviewedAt = new Date(entry.reviewed_at)
    const now = new Date()
    const hoursSinceReview = (now.getTime() - reviewedAt.getTime()) / (1000 * 60 * 60)
    const hoursRemaining = Math.ceil(24 - hoursSinceReview)

    if (hoursRemaining > 1) {
      return `Daily edit limit reached. Available in ${hoursRemaining} hours.`
    } else {
      return 'Daily edit limit reached. Available in less than 1 hour.'
    }
  }

  // Check if user can delete product (for free users, limit to once per 5 days)
  const canDeleteProduct = () => {
    if (!entry) return false

    // If not free plan, allow deletion anytime
    if (planType !== 'free') return true

    // For free users, check if 5 days (120 hours) have passed since last review
    if (!entry.reviewed_at) return true // Never reviewed, can delete

    const reviewedAt = new Date(entry.reviewed_at)
    const now = new Date()
    const hoursSinceReview = (now.getTime() - reviewedAt.getTime()) / (1000 * 60 * 60)

    return hoursSinceReview >= 120 // 5 days = 120 hours
  }

  const getDeleteLimitMessage = () => {
    if (!entry?.reviewed_at) return ''

    const reviewedAt = new Date(entry.reviewed_at)
    const now = new Date()
    const hoursSinceReview = (now.getTime() - reviewedAt.getTime()) / (1000 * 60 * 60)
    const hoursRemaining = Math.ceil(120 - hoursSinceReview)

    if (hoursRemaining > 24) {
      const daysRemaining = Math.ceil(hoursRemaining / 24)
      return `Delete locked for ${daysRemaining} more day${daysRemaining === 1 ? '' : 's'}.`
    } else if (hoursRemaining > 1) {
      return `Delete locked. Available in ${hoursRemaining} hours.`
    } else {
      return 'Delete locked. Available in less than 1 hour.'
    }
  }

  // Helper function to clean escaped text from database
  const cleanText = (text: string | null | undefined): string => {
    if (!text) return ''
    // Remove all quotes (escaped and regular) and clean up the text
    return text
      .replace(/^["']+/, '') // Remove leading quotes
      .replace(/["']+$/, '') // Remove trailing quotes
      .replace(/\\"/g, '') // Remove escaped quotes entirely
      .replace(/\\'/g, '') // Remove escaped single quotes
      .replace(/\\n/g, '\n') // Replace escaped newlines
      .trim()
  }

  useEffect(() => {
    if (user && !forceEmpty) {
      fetchKnowledge()
    }
  }, [user, forceEmpty])

  const fetchKnowledge = async () => {
    if (!user) return

    const userId = user?.id
    const { data } = await supabase
      .from('knowledge_base')
      .select('*')
      .eq('created_by', userId)
      .limit(1)
      .single()

    if (data) {
      setEntry(data)
      // Check if entry is still processing and show generating state
      if (data.workflow_status === 'processing') {
        setIsGenerating(true)
      } else {
        setIsGenerating(false)
      }
    }
  }

  // Check if entry is in draft/pending review state
  const isDraftPending = entry &&
    entry.workflow_status === 'draft' &&
    entry.review_status === 'pending'

  // Check if entry is in reviewing state (approved by user, AI is reviewing)
  const isReviewing = entry &&
    entry.workflow_status === 'reviewing' &&
    entry.review_status === 'approved'

  useEffect(() => {
    if (isGenerating || isReviewing) {
      const interval = setInterval(() => {
        setCurrentStep(prev => prev >= 4 ? 2 : prev + 1)
      }, 2000)
      return () => clearInterval(interval)
    }
  }, [isGenerating, isReviewing])

  // Poll for status updates while generating or reviewing
  useEffect(() => {
    if ((isGenerating || isReviewing) && user) {
      const pollInterval = setInterval(() => {
        fetchKnowledge()
      }, 5000) // Check every 5 seconds

      return () => clearInterval(pollInterval)
    }
  }, [isGenerating, isReviewing, user])

  const handleCreateProduct = () => {
    console.log('Opening knowledge modal for creation')
    // Use ModalFlowManager for consistent experience
    openModal('knowledge', { mode: 'add' })
  }

  const handleViewDetails = () => {
    console.log('Opening knowledge modal for editing:', entry)
    // Open knowledge modal in edit mode with existing entry data
    openModal('knowledge', {
      mode: 'edit',
      data: entry as any
    })
  }

  const handleDelete = async () => {
    if (!entry || !window.confirm('Are you sure you want to delete this entry? This cannot be undone.')) {
      return
    }

    try {
      const { error } = await supabase
        .from('knowledge_base')
        .delete()
        .eq('id', entry.id)

      if (error) throw error

      toast.success('Entry deleted successfully')
      setEntry(null)
      fetchKnowledge()
    } catch (error: any) {
      console.error('Error deleting entry:', error)
      toast.error('Failed to delete entry')
    }
  }

  // Empty State
  if (forceEmpty || (!entry && !isGenerating)) {
    return (
        <div className={`relative shadow-2xl rounded-3xl p-6 overflow-hidden border border-white/10 text-white ${isOnboardingHighlight ? 'onboarding-highlight' : ''} ${className}`}
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

          {/* Account Info */}
          <div className="text-sm font-light opacity-80 mb-4 tracking-wide">
            Free Account: 1 Product/Service Limit
          </div>

          <div className="flex gap-8">
            {/* Left Side - Icon and Main Content */}
            <div className="flex-1 flex flex-col justify-center">
              <div className="flex items-center gap-6 mb-4">
                {/* Floating Icon */}
                <div className="relative inline-block" style={{ animation: 'float 3s ease-in-out infinite' }}>
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#FBAE1C]/20 to-[#FC9109]/20 flex items-center justify-center border border-[#FBAE1C]/30">
                    <span className="text-4xl">📦</span>
                  </div>
                  <div className="absolute -top-2 -right-2 w-7 h-7 bg-gradient-to-br from-[#FBAE1C] to-[#FC9109] rounded-full flex items-center justify-center text-xs font-bold shadow-lg">
                    1
                  </div>
                </div>
                
                {/* Title and Description */}
                <div className="flex-1">
                  <h2 className="text-xl font-bold mb-2"
                      style={{
                        background: 'linear-gradient(90deg, #FBAE1C 0%, #FC9109 25%, #DD6800 50%, #FC9109 75%, #FBAE1C 100%)',
                        backgroundSize: '200% auto',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        backgroundClip: 'text',
                        animation: 'shimmer 3s linear infinite'
                      }}>
                    Add Your Product/Service
                  </h2>
                  <p className="text-gray-400 text-sm leading-relaxed">
                    Create your first product entry to maximise AI-powered message personalisation
                  </p>
                </div>
              </div>

              {/* Benefits Grid - Horizontal */}
              <div className="flex gap-3 mb-4">
                <div className="rounded-lg px-4 py-2 text-center border border-white/5 flex-1"
                     style={{
                       background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.02) 100%)',
                       backdropFilter: 'blur(10px)'
                     }}>
                  <div className="flex items-center gap-2">
                    <span className="text-lg">⚡</span>
                    <p className="text-xs text-gray-300">10x Response</p>
                  </div>
                </div>
                <div className="rounded-lg px-4 py-2 text-center border border-white/5 flex-1"
                     style={{
                       background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.02) 100%)',
                       backdropFilter: 'blur(10px)'
                     }}>
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🤖</span>
                    <p className="text-xs text-gray-300">AI-Powered</p>
                  </div>
                </div>
                <div className="rounded-lg px-4 py-2 text-center border border-white/5 flex-1"
                     style={{
                       background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.02) 100%)',
                       backdropFilter: 'blur(10px)'
                     }}>
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🚀</span>
                    <p className="text-xs text-gray-300">2min Setup</p>
                  </div>
                </div>
              </div>

              {/* CTA Button */}
              <div className="relative">
                <button
                  onClick={handleCreateProduct}
                  className="bg-gradient-to-r from-[#FBAE1C] to-[#FC9109] text-white font-semibold py-3 px-6 rounded-xl hover:shadow-lg transition-all duration-200 text-sm flex items-center justify-center space-x-2 group w-full">
                  <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" />
                  <span>Create Your Product/Service Entry</span>
                </button>
                {/* Onboarding Arrow */}
                {isOnboardingHighlight && (
                  <div className="absolute -right-16 top-1/2 -translate-y-1/2">
                    <OnboardingArrow direction="left" />
                  </div>
                )}
              </div>
            </div>

            {/* Right Side - What You'll Define */}
            <div className="w-80">
              <div className="bg-black/20 backdrop-blur-sm rounded-2xl p-4 h-full border border-white/5">
                <h4 className="text-xs font-medium text-white/50 uppercase tracking-wide mb-3">What You'll Define</h4>
                <div className="space-y-3">
                  <div className="flex items-start space-x-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#FBAE1C] mt-1.5"></div>
                    <span className="text-xs text-gray-300">The pain points your product/service addresses</span>
                  </div>
                  <div className="flex items-start space-x-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#FC9109] mt-1.5"></div>
                    <span className="text-xs text-gray-300">The key selling benefits</span>
                  </div>
                  <div className="flex items-start space-x-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#DD6800] mt-1.5"></div>
                    <span className="text-xs text-gray-300">Who you might be selling to</span>
                  </div>
                </div>
                
                <p className="text-xs text-gray-500 mt-4 pt-4 border-t border-white/5">
                  Provide a product URL for AI-powered analysis
                </p>
              </div>
            </div>
          </div>
          
          {/* Decorative Elements */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-[#FBAE1C]/10 to-transparent rounded-bl-full blur-2xl"></div>
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-gradient-to-tr from-[#FC9109]/10 to-transparent rounded-tr-full blur-2xl"></div>
        </div>
    )
  }

  // Reviewing State (AI is reviewing the approved entry)
  if (isReviewing) {
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

        {/* Account Info */}
        <div className="text-sm font-light opacity-80 mb-4 tracking-wide">
          Product knowledge being enhanced...
        </div>

        <div className="flex gap-8">
          {/* Left Side - Product Info */}
          <div className="flex-1 flex flex-col justify-center">
            <div className="flex items-center gap-6 mb-4">
              {/* Product Icon */}
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500/20 to-blue-600/20 flex items-center justify-center border border-blue-500/30">
                <span className="text-4xl">📦</span>
              </div>

              {/* Product Name and Summary */}
              <div className="flex-1">
                <h2 className="text-xl font-bold mb-2 text-white">
                  {cleanText(entry?.title) || 'Product Name'}
                </h2>
                <p className="text-gray-400 text-sm leading-relaxed line-clamp-2">
                  {cleanText(entry?.summary) || 'Product summary...'}
                </p>
              </div>
            </div>

            {/* AI Review Status */}
            <div className="bg-blue-500/10 backdrop-blur-sm rounded-xl p-4 mb-4 border border-blue-500/20">
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
                Cold AI is reviewing your product
              </p>
              <p className="text-center text-xs text-blue-300/70">
                Updating suggestions and taking notes...
              </p>
            </div>
          </div>

          {/* Right Side - Progress Steps */}
          <div className="w-80">
            <div className="bg-black/20 backdrop-blur-sm rounded-2xl p-4 h-full border border-white/5">
              <h4 className="text-xs font-medium text-white/50 uppercase tracking-wide mb-3">Review Progress</h4>
              <div className="space-y-3">
                {/* Step 1 - Always completed */}
                <div className="flex items-center space-x-3">
                  <div className="w-6 h-6 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center">
                    <svg className="w-3 h-3 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-gray-300">Your approval received</p>
                  </div>
                </div>

                {/* Steps 2-4 */}
                {[
                  { num: 2, text: 'Analysing product changes' },
                  { num: 3, text: 'Updating sales intelligence' },
                  { num: 4, text: 'Refining messaging angles' }
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

              <p className="text-xs text-gray-500 mt-4 pt-4 border-t border-white/5">
                Estimated time: 1-2 minutes
              </p>
            </div>
          </div>
        </div>

        {/* Decorative Elements */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-500/10 to-transparent rounded-bl-full blur-2xl"></div>
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-gradient-to-tr from-blue-500/10 to-transparent rounded-tr-full blur-2xl"></div>
      </div>
    )
  }

  // Draft/Pending Review State
  if (isDraftPending) {
    return (
      <div className={`relative shadow-2xl rounded-3xl p-6 overflow-hidden border border-white/10 text-white ${className}`}
           style={{
             background: 'linear-gradient(135deg, rgba(251, 174, 28, 0.1) 0%, rgba(221, 104, 0, 0.05) 100%)',
             backdropFilter: 'blur(10px)',
             WebkitBackdropFilter: 'blur(10px)'
           }}>

        {/* Status Badge */}
        <div className="absolute top-4 right-4 z-30">
          <div className="bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 px-3 py-1 rounded-full text-xs flex items-center">
            <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 mr-1.5 animate-pulse"></span>
            Pending Review
          </div>
        </div>

        {/* Account Info */}
        <div className="text-sm font-light opacity-80 mb-4 tracking-wide">
          AI generation complete - Ready for your review
        </div>

        <div className="flex gap-8">
          {/* Left Side - Product Preview */}
          <div className="flex-1 flex flex-col">
            {/* Product Header */}
            <div className="flex items-center gap-4 mb-4">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-yellow-500/20 to-amber-600/20 flex items-center justify-center border border-yellow-500/30">
                <span className="text-3xl">📦</span>
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-bold mb-1"
                    style={{
                      background: 'linear-gradient(90deg, #FBAE1C 0%, #FC9109 25%, #DD6800 50%, #FC9109 75%, #FBAE1C 100%)',
                      backgroundSize: '200% auto',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      backgroundClip: 'text',
                      animation: 'shimmer 3s linear infinite'
                    }}>
                  {cleanText(entry?.title) || 'Product Name'}
                </h2>
                <p className="text-sm text-gray-400">
                  {entry?.knowledge_type || 'Product'}
                </p>
              </div>
            </div>

            {/* Product Description Preview */}
            <p className="text-sm text-gray-300 mb-4 leading-relaxed line-clamp-3">
              {cleanText(entry?.summary) || cleanText(entry?.content?.substring(0, 200)) || "Review AI-generated content..."}
            </p>

            {/* Review CTA */}
            <div className="bg-yellow-500/10 backdrop-blur-sm rounded-xl p-4 mb-4 border border-yellow-500/20">
              <div className="flex items-center justify-center space-x-3">
                <span className="text-lg">✨</span>
                <p className="text-sm text-yellow-300 font-medium">AI has generated your product profile - Review and approve to publish</p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={handleViewDetails}
                className="flex-1 bg-gradient-to-r from-yellow-500 to-amber-600 text-white font-semibold py-3 px-6 rounded-xl hover:shadow-lg transition-all duration-200 text-sm flex items-center justify-center space-x-2 group"
              >
                <Edit2 className="w-5 h-5" />
                <span>Review & Approve</span>
              </button>
              <button
                onClick={handleDelete}
                className="bg-red-500/20 hover:bg-red-500/30 text-red-400 hover:text-red-300 font-semibold py-3 px-4 rounded-xl transition-all duration-200 text-sm flex items-center justify-center border border-red-500/30"
                title="Delete entry"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Right Side - What to Review */}
          <div className="w-80">
            <div className="bg-black/20 backdrop-blur-sm rounded-2xl p-4 h-full border border-white/5">
              <h4 className="text-xs font-medium text-white/50 uppercase tracking-wide mb-3">What to Review</h4>
              <div className="space-y-3">
                <div className="flex items-start space-x-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-yellow-400 mt-1.5"></div>
                  <span className="text-xs text-gray-300">Product description and key features</span>
                </div>
                <div className="flex items-start space-x-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-yellow-400 mt-1.5"></div>
                  <span className="text-xs text-gray-300">Target market and buyer personas</span>
                </div>
                <div className="flex items-start space-x-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-yellow-400 mt-1.5"></div>
                  <span className="text-xs text-gray-300">Pain points and solutions</span>
                </div>
                <div className="flex items-start space-x-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-yellow-400 mt-1.5"></div>
                  <span className="text-xs text-gray-300">Sales intelligence and hook angles</span>
                </div>
              </div>

              <p className="text-xs text-gray-500 mt-4 pt-4 border-t border-white/5">
                You can edit any AI-generated content before approval
              </p>
            </div>
          </div>
        </div>

        {/* Decorative Elements */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-yellow-500/10 to-transparent rounded-bl-full blur-2xl"></div>
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-gradient-to-tr from-amber-600/10 to-transparent rounded-tr-full blur-2xl"></div>
      </div>
    )
  }

  // Generating State
  if (isGenerating) {
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
            Analysing
          </div>
        </div>

        {/* Account Info */}
        <div className="text-sm font-light opacity-80 mb-4 tracking-wide">
          Creating your product profile...
        </div>

        <div className="flex gap-8">
          {/* Left Side - Generating Content */}
          <div className="flex-1 flex flex-col justify-center">
            <div className="flex items-center gap-6 mb-6">
              {/* AI Processing Icon */}
              <div className="relative">
                <div className="w-20 h-20 rounded-full bg-purple-500/20 flex items-center justify-center">
                  <span className="text-4xl">📦</span>
                </div>
                <div className="absolute inset-0 rounded-full border-2 border-purple-400 border-t-transparent animate-spin"></div>
              </div>
              
              {/* Loading Placeholders */}
              <div className="flex-1">
                <div className="h-7 rounded-lg mb-3 w-3/4 animate-pulse"
                     style={{
                       background: 'linear-gradient(90deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.1) 50%, rgba(255, 255, 255, 0.05) 100%)',
                       backgroundSize: '200% 100%',
                       animation: 'shimmer 1.5s infinite'
                     }}></div>
                <div className="h-4 rounded mb-2 w-full animate-pulse"
                     style={{
                       background: 'linear-gradient(90deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.1) 50%, rgba(255, 255, 255, 0.05) 100%)',
                       backgroundSize: '200% 100%',
                       animation: 'shimmer 1.5s infinite'
                     }}></div>
                <div className="h-4 rounded w-2/3 animate-pulse"
                     style={{
                       background: 'linear-gradient(90deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.1) 50%, rgba(255, 255, 255, 0.05) 100%)',
                       backgroundSize: '200% 100%',
                       animation: 'shimmer 1.5s infinite'
                     }}></div>
              </div>
            </div>

            {/* AI Generation Status */}
            <div className="bg-purple-500/10 backdrop-blur-sm rounded-xl p-4 mb-4 border border-purple-500/20">
              <div className="flex items-center justify-center space-x-3">
                <span className="text-lg">🤖</span>
                <p className="text-sm text-purple-300 font-medium">Cold AI is analysing your product URL</p>
                <div className="flex space-x-1">
                  <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-pulse"></span>
                  <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></span>
                  <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></span>
                </div>
              </div>
            </div>

            {/* Key Features Skeleton */}
            <div className="space-y-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded animate-pulse"
                       style={{
                         background: 'linear-gradient(90deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.1) 50%, rgba(255, 255, 255, 0.05) 100%)',
                         backgroundSize: '200% 100%',
                         animation: 'shimmer 1.5s infinite'
                       }}></div>
                  <div className={`h-4 rounded flex-1 animate-pulse`}
                       style={{
                         width: `${100 - (i * 5)}%`,
                         background: 'linear-gradient(90deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.1) 50%, rgba(255, 255, 255, 0.05) 100%)',
                         backgroundSize: '200% 100%',
                         animation: 'shimmer 1.5s infinite'
                       }}></div>
                </div>
              ))}
            </div>
          </div>

          {/* Right Side - Progress Steps */}
          <div className="w-80">
            <div className="bg-black/20 backdrop-blur-sm rounded-2xl p-4 h-full border border-white/5">
              <h4 className="text-xs font-medium text-white/50 uppercase tracking-wide mb-3">Analysis Progress</h4>
              <div className="space-y-3">
                {/* Step 1 - Always completed */}
                <div className="flex items-center space-x-3">
                  <div className="w-6 h-6 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center">
                    <svg className="w-3 h-3 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <span className="text-xs text-gray-300">URL accessed</span>
                </div>
                
                {/* Steps 2-4 */}
                {[
                  { num: 2, text: 'Extracting product features' },
                  { num: 3, text: 'Identifying pain points' },
                  { num: 4, text: 'Building sales framework' }
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
                    <span className={`text-xs ${
                      currentStep === step.num ? 'text-gray-300 font-medium' : 'text-gray-500'
                    }`}>
                      {step.text}
                    </span>
                  </div>
                ))}
              </div>
              
              <p className="text-xs text-gray-500 mt-4 pt-4 border-t border-white/5">
                Estimated time: 1-2 minutes
              </p>
            </div>
          </div>
        </div>
        
        {/* Decorative Elements */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-purple-500/10 to-transparent rounded-bl-full blur-2xl"></div>
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-gradient-to-tr from-purple-500/10 to-transparent rounded-tr-full blur-2xl"></div>
      </div>
    )
  }

  // Active State (when product exists)
  return (
    <div className={`relative shadow-2xl rounded-3xl p-6 overflow-visible border border-white/10 text-white ${className}`}
         style={{
           background: 'linear-gradient(135deg, rgba(251, 174, 28, 0.1) 0%, rgba(221, 104, 0, 0.05) 100%)',
           backdropFilter: 'blur(10px)',
           WebkitBackdropFilter: 'blur(10px)'
         }}>
      
      {/* Status Badge */}
      <div className="absolute top-4 right-4 z-30">
        <div className="bg-green-500/20 text-green-400 border border-green-500/30 px-3 py-1 rounded-full text-xs flex items-center">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 mr-1.5 animate-pulse"></span>
          Active
        </div>
      </div>

      {/* Account Info */}
      <div className="text-sm font-light opacity-80 mb-4 tracking-wide">
        Last updated: {entry?.updated_at ? new Date(entry.updated_at).toLocaleString() : 'Never'}
      </div>

      <div className="flex gap-8">
        {/* Left Side - Product Details */}
        <div className="flex-1 flex flex-col">
          {/* Product Header */}
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#FBAE1C]/20 to-[#FC9109]/20 flex items-center justify-center border border-[#FBAE1C]/30">
              <span className="text-3xl">📦</span>
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold mb-1"
                  style={{
                    background: 'linear-gradient(90deg, #FBAE1C 0%, #FC9109 25%, #DD6800 50%, #FC9109 75%, #FBAE1C 100%)',
                    backgroundSize: '200% auto',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                    animation: 'shimmer 3s linear infinite'
                  }}>
                {cleanText(entry?.title) || 'Product Name'}
              </h2>
              <p className="text-sm text-gray-400">
                {entry?.knowledge_type || 'Product'}
              </p>
            </div>
          </div>

          {/* Product Description */}
          <p className="text-sm text-gray-300 mb-4 leading-relaxed">
            {cleanText(entry?.summary) || "Product description..."}
          </p>

          {/* Key Features from metadata if available */}
          {entry?.metadata && typeof entry.metadata === 'object' && 'features' in entry.metadata && (
            <div className="space-y-2 mb-4">
              {((entry.metadata as any).features as string[]).slice(0, 4).map((feature, i) => (
                <div key={i} className="rounded-lg p-2 border border-white/5 flex items-center gap-2"
                     style={{
                       background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.03) 0%, rgba(255, 255, 255, 0.01) 100%)'
                     }}>
                  <span className="text-green-400">✓</span>
                  <span className="text-xs text-gray-300">{feature}</span>
                </div>
              ))}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={() => openModal('knowledge', { mode: 'view', data: entry as any })}
              className="flex-1 bg-gradient-to-r from-[#FBAE1C] to-[#FC9109] text-white font-semibold py-3 px-6 rounded-xl hover:shadow-lg transition-all duration-200 text-sm"
            >
              View Details
            </button>
            <HoverTooltip content={getEditLimitMessage()} disabled={canEditProduct()}>
              <button
                onClick={() => canEditProduct() && openModal('knowledge', { mode: 'edit', data: entry as any })}
                disabled={!canEditProduct()}
                className={`p-3 backdrop-blur-sm rounded-xl border transition-all duration-200 ${
                  canEditProduct()
                    ? 'bg-white/5 border-white/10 hover:bg-white/10 cursor-pointer'
                    : 'bg-white/5 border-white/5 opacity-50 cursor-not-allowed'
                }`}
                title={!canEditProduct() ? getEditLimitMessage() : 'Edit Product'}
              >
                <Edit2 className="w-5 h-5" />
              </button>
            </HoverTooltip>
            <HoverTooltip content={getDeleteLimitMessage()} disabled={canDeleteProduct()}>
              <button
                onClick={() => canDeleteProduct() && handleDelete()}
                disabled={!canDeleteProduct()}
                className={`p-3 rounded-xl border transition-all duration-200 ${
                  canDeleteProduct()
                    ? 'bg-red-500/20 hover:bg-red-500/30 border-red-500/30 hover:border-red-500/40 cursor-pointer'
                    : 'bg-red-500/10 border-red-500/20 opacity-50 cursor-not-allowed'
                }`}
                title={!canDeleteProduct() ? getDeleteLimitMessage() : 'Delete Product'}
              >
                <Trash2 className="w-5 h-5 text-red-400" />
              </button>
            </HoverTooltip>
          </div>
        </div>

        {/* Right Side - Metadata */}
        <div className="w-80">
          <div className="bg-black/20 backdrop-blur-sm rounded-2xl p-4 h-full border border-white/5">
            {/* Quality Assessment */}
            <div className="mb-4">
              <h4 className="text-xs font-medium text-white/50 uppercase tracking-wide mb-2 flex items-center gap-2">
                <span className="text-[#FBAE1C]">📊</span> Quality Assessment
              </h4>
              <div className="space-y-2">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs text-gray-400">Completeness</span>
                    <span className="text-xs font-semibold text-[#FBAE1C]">
                      {(entry?.metadata as any)?.quality_assessment?.completeness || 65}%
                    </span>
                  </div>
                  <div className="w-full bg-white/10 rounded-full h-1">
                    <div className="h-1 rounded-full"
                         style={{
                           width: `${(entry?.metadata as any)?.quality_assessment?.completeness || 65}%`,
                           background: 'linear-gradient(90deg, #FBAE1C 0%, #FC9109 50%, #DD6800 100%)'
                         }}></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs text-gray-400">Sales Readiness</span>
                    <span className="text-xs font-semibold text-[#FBAE1C]">
                      {(entry?.metadata as any)?.quality_assessment?.sales_readiness || 70}%
                    </span>
                  </div>
                  <div className="w-full bg-white/10 rounded-full h-1">
                    <div className="h-1 rounded-full"
                         style={{
                           width: `${(entry?.metadata as any)?.quality_assessment?.sales_readiness || 70}%`,
                           background: 'linear-gradient(90deg, #FBAE1C 0%, #FC9109 50%, #DD6800 100%)'
                         }}></div>
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-white/5 pt-3">
              {/* Product Info */}
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-500">Category</span>
                  <span className="text-gray-300">{(entry?.metadata as any)?.workflow_metadata?.product_category || entry?.knowledge_type || 'Product'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Status</span>
                  <span className="text-gray-300">{entry?.workflow_status || 'Active'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">AI Generations</span>
                  <span className="text-gray-300">{(entry?.metadata as any)?.source_info?.ai_generation_count || 0}</span>
                </div>
              </div>
            </div>
            
            <p className="text-xs text-gray-500 mt-3 pt-3 border-t border-white/5">
              Updated: {entry?.updated_at ? new Date(entry.updated_at).toLocaleDateString() : 'Never'}
            </p>
          </div>
        </div>
      </div>
      
      {/* Decorative Elements */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-[#FBAE1C]/10 to-transparent rounded-bl-full blur-2xl"></div>
      <div className="absolute bottom-0 left-0 w-32 h-32 bg-gradient-to-tr from-[#FC9109]/10 to-transparent rounded-tr-full blur-2xl"></div>
    </div>
  )
}
