// src/components/modals/ICPModalWrapper.tsx
import React, { useState, useEffect } from 'react'
import { BaseModal } from './BaseModal'
import { ICPCreationModalV2 } from '../states/ICPCreationModalV2'
import { ProductAddModalEnhanced } from '../knowledge/ProductAddModalEnhanced'
import { ICPUnifiedModal } from '../icps/ICPUnifiedModal/index'
import { useModalFlow } from './ModalFlowManager'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/integrations/supabase/client'

// ICP Creation Modal Wrapper - renders ICPCreationModalV2 inside BaseModal
export function ICPCreationModalWrapper({
  onClose,
  onSuccess,
  onGenerate
}: any) {
  const { closeModal } = useModalFlow()

  return (
    <BaseModal
      title="Create Ideal Customer Profile"
      description="Define your ideal customer characteristics"
      className="knowledge-modal-large !max-w-[95vw]"
    >
      <ICPCreationModalV2
        isOpen={true}
        onClose={() => {
          closeModal()
          onClose?.()
        }}
        onSuccess={onSuccess}
        onGenerate={onGenerate}
        isWrapped={true}
      />
    </BaseModal>
  )
}

// ICP Unified Modal Wrapper - renders ICPUnifiedModal inside BaseModal for draft/edit/approve
export function ICPUnifiedModalWrapper({
  icp,
  onClose,
  onUpdate,
  mode
}: any) {
  const { closeModal, openModal } = useModalFlow()
  const { user } = useAuth()
  const [icpData, setIcpData] = useState(icp)
  const [loading, setLoading] = useState(!icp)
  const [hasApprovedProduct, setHasApprovedProduct] = useState<boolean | null>(null)

  // Function to check for approved products
  const checkApprovedProducts = async () => {
    if (!user) return

    try {
      const { data, error } = await supabase
        .from('knowledge_base')
        .select('id')
        .eq('created_by', user?.id)
        .eq('workflow_status', 'reviewing')
        .eq('review_status', 'approved')
        .limit(1)

      if (error) {
        console.error('Error checking approved products:', error)
        setHasApprovedProduct(false)
        return
      }

      setHasApprovedProduct(data && data.length > 0)
    } catch (error) {
      console.error('Error checking approved products:', error)
      setHasApprovedProduct(false)
    }
  }

  // Function to fetch ICP data
  const fetchICP = async () => {
    if (!icp && user) {
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
          setIcpData(data)
        } else {
          // No ICP exists, check for approved products before showing create mode
          await checkApprovedProducts()
          setIcpData(null)
        }
      } catch (error) {
        console.error('Error fetching ICP:', error)
        // Check for approved products before showing create mode
        await checkApprovedProducts()
        setIcpData(null)
      } finally {
        setLoading(false)
      }
    } else {
      setLoading(false)
    }
  }

  // Fetch ICP data if not provided (when navigating through flow)
  useEffect(() => {
    fetchICP()
  }, [icp, user])

  if (loading) {
    return (
      <BaseModal
        title="Loading ICP"
        description="Loading your ideal customer profile..."
        className="icp-modal-large"
      >
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-3 border-[#FBAE1C] border-t-transparent rounded-full animate-spin" />
        </div>
      </BaseModal>
    )
  }

  // If no ICP exists, check for approved products first
  if (!icpData) {
    // If we haven't checked for approved products yet, show loading
    if (hasApprovedProduct === null) {
      return (
        <BaseModal
          title="Loading ICP"
          description="Loading your ideal customer profile..."
          className="icp-modal-large"
        >
          <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-3 border-[#FBAE1C] border-t-transparent rounded-full animate-spin" />
          </div>
        </BaseModal>
      )
    }

    // If no approved product exists, show locked state
    if (!hasApprovedProduct) {
      return (
        <BaseModal
          title="Complete Your Product Setup First"
          description="You need an approved product before creating your ICP"
          className="icp-modal-large"
        >
          <div className="space-y-6">
            <div className="bg-gradient-to-br from-white/3 to-white/1 border border-white/10 rounded-2xl p-6">
              <div className="text-center py-8">
                <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-[#FBAE1C]/10 border border-[#FBAE1C]/20 flex items-center justify-center">
                  <span className="text-4xl">🔒</span>
                </div>
                <h3 className="text-white font-medium mb-2 text-lg">Product Approval Required</h3>
                <p className="text-gray-400 text-sm mb-6 max-w-md mx-auto">
                  Before creating your Ideal Customer Profile, you need to add and get approval for at least one product or service. This helps us create a more accurate ICP for your business.
                </p>
                <button
                  onClick={() => {
                    closeModal()
                    setTimeout(() => {
                      openModal('knowledge', { mode: 'add' })
                    }, 300)
                  }}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-gradient-to-r from-[#FBAE1C] to-[#FC9109] text-black font-medium hover:shadow-lg hover:shadow-[#FBAE1C]/30 transition-all"
                >
                  <span>Add Product/Service</span>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </BaseModal>
      )
    }

    // If approved product exists, show creation modal
    return (
      <BaseModal
        title="Create Ideal Customer Profile"
        description="Define your ideal customer to unlock AI-powered messaging"
        className="knowledge-modal-large !max-w-[95vw]"
      >
        <ICPCreationModalV2
          isOpen={true}
          onClose={onClose || closeModal}
          onSuccess={() => {
            // Refetch ICP after creation
            fetchICP()
          }}
          onGenerate={() => {
            // Handle generation state
          }}
          isWrapped={true}
        />
      </BaseModal>
    )
  }


  return (
    <BaseModal
      title="Edit Ideal Customer Profile"
      description="Review and approve your ICP"
      className="icp-modal-large"
    >
      <ICPUnifiedModal
        isOpen={true}
        onClose={onClose || closeModal}
        icp={icpData}
        onUpdate={onUpdate}
        mode={mode || 'view'}
        renderWithoutDialog={true}
      />
    </BaseModal>
  )
}

// For backwards compatibility, map the old modal names to the appropriate wrappers
export function ICPBasicModal(props: any) {
  return <ICPCreationModalWrapper {...props} />
}

export function ICPDemographicsModal(props: any) {
  return <ICPCreationModalWrapper {...props} />
}

export function ICPFirmographicsModal(props: any) {
  return <ICPCreationModalWrapper {...props} />
}

export function ICPPainPointsModal(props: any) {
  return <ICPCreationModalWrapper {...props} />
}

export function ICPGeneratingModal() {
  const [currentStep, setCurrentStep] = React.useState(2)

  React.useEffect(() => {
    const interval = setInterval(() => {
      setCurrentStep(prev => prev >= 4 ? 2 : prev + 1)
    }, 2000)
    return () => clearInterval(interval)
  }, [])

  return (
    <BaseModal
      title="Creating Ideal Customer Profile"
      description="AI is generating your ideal customer profile"
      className="!max-w-4xl"
    >
      <div className="relative">
        {/* Status Badge */}
        <div className="absolute top-4 right-4 z-30">
          <div className="bg-purple-500/20 text-purple-400 border border-purple-500/30 px-3 py-1 rounded-full text-xs flex items-center">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-400 mr-1.5 animate-pulse"></span>
            Generating
          </div>
        </div>

        <div className="relative z-20 py-8">
          {/* Creating text */}
          <div className="text-sm font-light opacity-60 mb-1 tracking-wide text-center">
            Creating your ICP...
          </div>

          {/* ICP Name placeholder with icon */}
          <div className="flex items-center justify-center mb-8">
            <div className="text-6xl mr-4">🎯</div>
            <div className="flex-1 max-w-sm">
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

          {/* Progress Steps */}
          <div className="max-w-md mx-auto">
            <div className="space-y-4">
              {/* Step 1 - Always completed */}
              <div className="flex items-center space-x-3">
                <div className="w-6 h-6 rounded-full bg-purple-500/20 border border-purple-500/30 flex items-center justify-center">
                  <div className="w-3 h-3 rounded-full bg-purple-400"></div>
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
          <div className="text-center mt-8">
            <p className="text-xs text-gray-500">
              This may take a couple of minutes
            </p>
          </div>
        </div>
      </div>
    </BaseModal>
  )
}

export function KnowledgeGeneratingModal() {
  const [currentStep, setCurrentStep] = React.useState(2)

  React.useEffect(() => {
    const interval = setInterval(() => {
      setCurrentStep(prev => prev >= 4 ? 2 : prev + 1)
    }, 2000)
    return () => clearInterval(interval)
  }, [])

  return (
    <BaseModal
      title="Creating Product Profile"
      description="AI is analyzing your product"
      className="!max-w-6xl"
    >
      <div className="relative">
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
    </BaseModal>
  )
}

// ICP Details/View Modal Wrapper - for viewing ICP details
export function ICPDetailsModal({
  icp,
  onClose
}: any) {
  return (
    <BaseModal
      title="ICP Details"
      description="View your ideal customer profile"
      className="!max-w-7xl"
    >
      <div className="space-y-6">
        <div className="text-white">
          <h3 className="text-lg font-semibold mb-4">{icp?.icp_name || 'Ideal Customer Profile'}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-medium text-orange-300 mb-2">Target Market</h4>
                <p className="text-gray-300 text-sm">{icp?.target_market || 'Not specified'}</p>
              </div>
              <div>
                <h4 className="text-sm font-medium text-orange-300 mb-2">Company Size</h4>
                <p className="text-gray-300 text-sm">{icp?.company_size || 'Not specified'}</p>
              </div>
              <div>
                <h4 className="text-sm font-medium text-orange-300 mb-2">Industries</h4>
                <p className="text-gray-300 text-sm">{icp?.industries?.join(', ') || 'Not specified'}</p>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-medium text-orange-300 mb-2">Pain Points</h4>
                <p className="text-gray-300 text-sm">{icp?.pain_points || 'Not specified'}</p>
              </div>
              <div>
                <h4 className="text-sm font-medium text-orange-300 mb-2">Budget Authority</h4>
                <p className="text-gray-300 text-sm">{icp?.budget_authority || 'Not specified'}</p>
              </div>
              <div>
                <h4 className="text-sm font-medium text-orange-300 mb-2">Decision Criteria</h4>
                <p className="text-gray-300 text-sm">{icp?.decision_criteria || 'Not specified'}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </BaseModal>
  )
}

// Knowledge Modal Wrapper - renders existing ProductAddModalEnhanced inside BaseModal
export function KnowledgeAddModalWrapper({
  newEntry,
  setNewEntry,
  knowledgeTypes,
  canAddAdditionalLinks,
  getMaxAdditionalLinks,
  subscription,
  addAdditionalLink,
  removeAdditionalLink,
  updateAdditionalLink,
  aiFields,
  toggleAIField,
  handleAddEntry,
  isProcessing
}: any) {
  return (
    <BaseModal
      title="Add Product/Service"
      description="Add your product or service to the knowledge base"
      className="!max-w-7xl"
      hideDefaultContent={true}
    >
      <ProductAddModalEnhanced
        newEntry={newEntry}
        setNewEntry={setNewEntry}
        knowledgeTypes={knowledgeTypes}
        canAddAdditionalLinks={canAddAdditionalLinks}
        getMaxAdditionalLinks={getMaxAdditionalLinks}
        subscription={subscription}
        addAdditionalLink={addAdditionalLink}
        removeAdditionalLink={removeAdditionalLink}
        updateAdditionalLink={updateAdditionalLink}
        aiFields={aiFields}
        toggleAIField={toggleAIField}
        handleAddEntry={handleAddEntry}
        isProcessing={isProcessing}
      />
    </BaseModal>
  )
}