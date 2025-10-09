// src/components/modals/ModalFlowManager.tsx
import { useState, useEffect, createContext, useContext, useCallback, useMemo } from 'react'
import { Package, MessageSquare, User, Building2, Target, Settings, CreditCard, Users } from 'lucide-react'

// Import Modal Components
import { ProfilePersonalModal } from './ProfilePersonalModal'
import { ProfileCompanyModal } from './ProfileCompanyModal'
import { ProfileCommunicationModal } from './ProfileCommunicationModal'

// Import modal wrappers
import { ICPBasicModal, ICPDemographicsModal, ICPFirmographicsModal, ICPPainPointsModal, ICPGeneratingModal, KnowledgeGeneratingModal, ICPCreationModalWrapper, ICPUnifiedModalWrapper, ICPDetailsModal } from './ICPModalWrapper'
import { KnowledgeModal } from './KnowledgeModal'
import { SettingsAccountModal, SettingsPreferencesModal, SettingsIntegrationsModal, SettingsBillingModal } from './SettingsModals'

// ==================== TYPE DEFINITIONS ====================

interface ModalFlowState {
  currentModal: string | null
  mode: 'add' | 'edit' | 'view'
  data: Record<string, any>
  history: string[]
  flowSequence: string[]
  flowName: string | null
  stepIndex: number
  totalSteps: number
  metadata: {
    timestamp: number
    source?: string
    userId?: string
  }
  // New state for unsaved changes tracking
  originalData: Record<string, any>
  hasUnsavedChanges: boolean
  changeTracking: Record<string, boolean>
}

interface ModalFlowContextType {
  state: ModalFlowState
  openModal: (modalId: string, options?: ModalOpenOptions) => void
  closeModal: () => void
  closeAllModals: () => void
  navigateNext: () => void
  navigatePrevious: () => void
  navigateToStep: (stepIndex: number) => void
  canNavigate: { prev: boolean; next: boolean }
  updateModalData: (data: Partial<ModalFlowState['data']>) => void
  isModalOpen: (modalId: string) => boolean
  getProgress: () => number
  isInFlow: () => boolean
  isAnyModalOpen: () => boolean
  // New methods for change tracking
  markDataAsOriginal: (data: Record<string, any>) => void
  checkForUnsavedChanges: () => boolean
  resetUnsavedChanges: () => void
  hasUnsavedChanges: () => boolean
}

interface ModalOpenOptions {
  mode?: 'add' | 'edit' | 'view'
  data?: Record<string, any>
  flowName?: string
  source?: string
  replace?: boolean
}

interface ModalConfig {
  id: string
  component: React.ComponentType<any>
  title: string
  icon: React.ComponentType<any>
  description?: string
  requiresAuth?: boolean
  allowedPlans?: string[]
}

// ==================== MODAL FLOW DEFINITIONS ====================

const MODAL_FLOWS = {
  // Unified main workflow - the only flow all widgets use
  main: {
    name: 'Main Workflow',
    sequence: ['profile-personal', 'profile-company', 'profile-communication', 'knowledge', 'icp-edit'],
    description: 'Complete workflow from profile setup to ICP management'
  },

  // Settings configuration flow (separate flow only for settings pages)
  settings: {
    name: 'Settings',
    sequence: ['settings-account', 'settings-preferences', 'settings-integrations', 'settings-billing'],
    description: 'Configure your account settings'
  },

} as const

// ==================== MODAL REGISTRY ====================

const MODAL_REGISTRY: Record<string, ModalConfig> = {
  // Profile Modals
  'profile-personal': {
    id: 'profile-personal',
    component: ProfilePersonalModal,
    title: 'Personal Information',
    icon: User,
    description: 'Your personal details and contact information'
  },
  'profile-company': {
    id: 'profile-company',
    component: ProfileCompanyModal,
    title: 'Company Information',
    icon: Building2,
    description: 'Your company details and role'
  },
  'profile-communication': {
    id: 'profile-communication',
    component: ProfileCommunicationModal,
    title: 'Communication Style',
    icon: MessageSquare,
    description: 'Your preferred communication approach'
  },
  
  // Knowledge Base Modal
  'knowledge': {
    id: 'knowledge',
    component: KnowledgeModal,
    title: 'Product/Service',
    icon: Package,
    description: 'Add or edit your product or service details'
  },
  'knowledge-generating': {
    id: 'knowledge-generating',
    component: KnowledgeGeneratingModal,
    title: 'Creating Product Profile',
    icon: Package,
    description: 'AI is analyzing your product'
  },
  
  // ICP Modals
  'icp-basic': {
    id: 'icp-basic',
    component: ICPBasicModal,
    title: 'Basic Information',
    icon: Target,
    description: 'Define basic ICP characteristics'
  },
  'icp-demographics': {
    id: 'icp-demographics',
    component: ICPDemographicsModal,
    title: 'Demographics',
    icon: Users,
    description: 'Demographic information'
  },
  'icp-firmographics': {
    id: 'icp-firmographics',
    component: ICPFirmographicsModal,
    title: 'Firmographics',
    icon: Building2,
    description: 'Company characteristics'
  },
  'icp-pain-points': {
    id: 'icp-pain-points',
    component: ICPPainPointsModal,
    title: 'Pain Points',
    icon: Target,
    description: 'Problems your ICP faces'
  },
  'icp-generating': {
    id: 'icp-generating',
    component: ICPGeneratingModal,
    title: 'Creating ICP',
    icon: Target,
    description: 'AI is generating your ideal customer profile'
  },
  'icp-create': {
    id: 'icp-create',
    component: ICPCreationModalWrapper,
    title: 'Create ICP',
    icon: Target,
    description: 'Create a new ideal customer profile'
  },
  'icp-edit': {
    id: 'icp-edit',
    component: ICPUnifiedModalWrapper,
    title: 'Edit ICP',
    icon: Target,
    description: 'Edit and approve your ideal customer profile'
  },
  'icp-details': {
    id: 'icp-details',
    component: ICPDetailsModal,
    title: 'ICP Details',
    icon: Target,
    description: 'View your ideal customer profile details'
  },
  
  // Settings Modals
  'settings-account': {
    id: 'settings-account',
    component: SettingsAccountModal,
    title: 'Account Settings',
    icon: Settings,
    description: 'Manage your account'
  },
  'settings-preferences': {
    id: 'settings-preferences',
    component: SettingsPreferencesModal,
    title: 'Preferences',
    icon: Settings,
    description: 'Customise your experience'
  },
  'settings-integrations': {
    id: 'settings-integrations',
    component: SettingsIntegrationsModal,
    title: 'Integrations',
    icon: Settings,
    description: 'Connect external services'
  },
  'settings-billing': {
    id: 'settings-billing',
    component: SettingsBillingModal,
    title: 'Billing',
    icon: CreditCard,
    description: 'Manage subscription and payments',
    requiresAuth: true
  },
  
}

// ==================== CONTEXT IMPLEMENTATION ====================

const ModalFlowContext = createContext<ModalFlowContextType | null>(null)

export const useModalFlow = () => {
  const context = useContext(ModalFlowContext)
  if (!context) {
    throw new Error('useModalFlow must be used within ModalFlowProvider')
  }
  return context
}

// ==================== MODAL FLOW PROVIDER ====================

export function ModalFlowProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ModalFlowState>({
    currentModal: null,
    mode: 'add',
    data: {},
    history: [],
    flowSequence: [],
    flowName: null,
    stepIndex: 0,
    totalSteps: 0,
    metadata: {
      timestamp: Date.now()
    },
    // New state for unsaved changes tracking
    originalData: {},
    hasUnsavedChanges: false,
    changeTracking: {}
  })


  // Open a modal with optional flow detection
  const openModal = useCallback((modalId: string, options: ModalOpenOptions = {}) => {
    const {
      mode = 'add',
      data = {},
      flowName: explicitFlowName,
      source,
      replace = false
    } = options

    // Check if modal exists in registry
    if (!MODAL_REGISTRY[modalId] && !modalId.startsWith('custom-')) {
      console.warn(`Modal "${modalId}" not found in registry`)
    }

    // Determine if this modal is part of a flow
    let flowSequence: string[] = []
    let flowName: string | null = explicitFlowName || null
    let stepIndex = 0
    
    if (!flowName) {
      // Auto-detect flow based on modal ID
      for (const [name, flow] of Object.entries(MODAL_FLOWS)) {
        if (flow.sequence.includes(modalId)) {
          flowName = name
          flowSequence = [...flow.sequence]
          stepIndex = flow.sequence.indexOf(modalId)
          break
        }
      }
    } else if (MODAL_FLOWS[flowName as keyof typeof MODAL_FLOWS]) {
      // Use explicitly specified flow
      flowSequence = [...MODAL_FLOWS[flowName as keyof typeof MODAL_FLOWS].sequence]
      stepIndex = flowSequence.indexOf(modalId)
      if (stepIndex === -1) {
        // Modal not in specified flow, add it as first step
        stepIndex = 0
      }
    }

    setState(prev => {
      const newHistory = replace
        ? prev.history.slice(0, -1).concat(modalId)
        : [...prev.history, modalId]

      // Check if we're switching to a completely different context (different flow or modal type)
      const isDifferentContext =
        prev.flowName !== flowName ||
        (prev.currentModal && prev.currentModal !== modalId && !prev.flowSequence.includes(modalId))

      // For different contexts, completely clear all data to prevent contamination
      const cleanData = isDifferentContext ? { ...data } : { ...prev.data, ...data }

      // Always clear change tracking when opening a new modal, especially for different contexts
      return {
        ...prev,
        currentModal: modalId,
        mode,
        data: cleanData, // Use cleaned data - fresh for different contexts, merged for same context
        history: newHistory,
        flowSequence,
        flowName,
        stepIndex,
        totalSteps: flowSequence.length,
        // Force clear all change tracking for any modal switch, especially from ICP
        hasUnsavedChanges: false,
        originalData: {},
        changeTracking: {},
        metadata: {
          timestamp: Date.now(),
          source,
          userId: prev.metadata.userId
        }
      }
    })
  }, [])

  // Close current modal
  const closeModal = useCallback(() => {
    setState(prev => {
      if (prev.history.length > 1) {
        // Go back to previous modal
        const newHistory = [...prev.history]
        newHistory.pop()
        const previousModal = newHistory[newHistory.length - 1]
        
        // Find if previous modal is in a flow
        let flowSequence: string[] = []
        let flowName: string | null = null
        let stepIndex = 0
        
        for (const [name, flow] of Object.entries(MODAL_FLOWS)) {
          if (flow.sequence.includes(previousModal)) {
            flowName = name
            flowSequence = [...flow.sequence]
            stepIndex = flow.sequence.indexOf(previousModal)
            break
          }
        }

        return {
          ...prev,
          currentModal: previousModal,
          history: newHistory,
          flowSequence,
          flowName,
          stepIndex,
          totalSteps: flowSequence.length,
          data: {}, // Clear data when going back to prevent cross-modal contamination
          // Clear change tracking when going back
          hasUnsavedChanges: false,
          originalData: {},
          changeTracking: {}
        }
      } else {
        // Close all modals
        return {
          ...prev,
          currentModal: null,
          history: [],
          flowSequence: [],
          flowName: null,
          stepIndex: 0,
          totalSteps: 0,
          data: {},
          // Clear change tracking when closing all
          hasUnsavedChanges: false,
          originalData: {},
          changeTracking: {}
        }
      }
    })
  }, [])

  // Close all modals
  const closeAllModals = useCallback(() => {
    setState({
      currentModal: null,
      mode: 'add',
      data: {},
      history: [],
      flowSequence: [],
      flowName: null,
      stepIndex: 0,
      totalSteps: 0,
      metadata: {
        timestamp: Date.now()
      },
      // Clear change tracking state completely
      originalData: {},
      hasUnsavedChanges: false,
      changeTracking: {}
    })
  }, [])

  // Navigate to next modal in flow
  const navigateNext = useCallback(() => {
    setState(prev => {
      if (!prev.flowSequence.length || prev.stepIndex >= prev.flowSequence.length - 1) {
        return prev
      }

      const nextIndex = prev.stepIndex + 1
      const nextModal = prev.flowSequence[nextIndex]


      // Clear change tracking when navigating to avoid cross-modal conflicts
      // But preserve flow-specific data that needs to persist
      const preservedData: any = {}

      // For main, preserve ICP data throughout the flow
      if (prev.flowName === 'main' && prev.data?.icp) {
        preservedData.icp = prev.data.icp
      }

      // Set appropriate mode based on flow and target modal
      let targetMode = 'add' // default - knowledge modal works in 'add' mode

      // For ICP modals, use 'view' mode when there's existing ICP data
      if (nextModal === 'icp-edit') {
        targetMode = 'view' // ICP modals should show existing data in view mode by default
      }

      return {
        ...prev,
        currentModal: nextModal,
        stepIndex: nextIndex,
        history: [...prev.history, nextModal],
        data: preservedData, // Preserve flow-specific data
        mode: targetMode, // Set appropriate mode for target modal
        hasUnsavedChanges: false,
        originalData: {},
        changeTracking: {}
      }
    })
  }, [])

  // Navigate to previous modal
  const navigatePrevious = useCallback(() => {
    setState(prev => {
      if (prev.flowSequence.length && prev.stepIndex > 0) {
        // Navigate within flow
        const prevIndex = prev.stepIndex - 1
        const prevModal = prev.flowSequence[prevIndex]


        // Clear change tracking when navigating to avoid cross-modal conflicts
        // But preserve flow-specific data that needs to persist
        const preservedData: any = {}

        // For main, preserve ICP data throughout the flow
        if (prev.flowName === 'main' && prev.data?.icp) {
          preservedData.icp = prev.data.icp
        }

        // Set appropriate mode based on flow and target modal
        let targetMode = 'add' // default - knowledge modal works in 'add' mode

        return {
          ...prev,
          currentModal: prevModal,
          stepIndex: prevIndex,
          history: prev.history.slice(0, -1),
          data: preservedData, // Preserve flow-specific data
          mode: targetMode, // Set appropriate mode for target modal
          hasUnsavedChanges: false,
          originalData: {},
          changeTracking: {}
        }
      } else if (prev.history.length > 1) {
        // Navigate through history
        const newHistory = [...prev.history]
        newHistory.pop()
        const previousModal = newHistory[newHistory.length - 1]


        // Clear change tracking when navigating to avoid cross-modal conflicts
        // But preserve flow-specific data that needs to persist
        const preservedData: any = {}

        // For main, preserve ICP data throughout the flow
        if (prev.flowName === 'main' && prev.data?.icp) {
          preservedData.icp = prev.data.icp
        }

        // Set appropriate mode based on flow and target modal
        let targetMode = 'add' // default - knowledge modal works in 'add' mode

        // For ICP modals, use 'view' mode when there's existing ICP data
        if (previousModal === 'icp-edit') {
          targetMode = 'view' // ICP modals should show existing data in view mode by default
        }

        return {
          ...prev,
          currentModal: previousModal,
          history: newHistory,
          data: preservedData, // Preserve flow-specific data
          mode: targetMode, // Set appropriate mode for target modal
          hasUnsavedChanges: false,
          originalData: {},
          changeTracking: {}
        }
      }

      return prev
    })
  }, [])

  // Navigate to specific step in flow
  const navigateToStep = useCallback((stepIndex: number) => {
    setState(prev => {
      if (!prev.flowSequence.length || stepIndex < 0 || stepIndex >= prev.flowSequence.length) {
        return prev
      }

      const targetModal = prev.flowSequence[stepIndex]
      
      // Update history to reflect navigation
      let newHistory = [...prev.history]
      if (stepIndex < prev.stepIndex) {
        // Going back - remove future history
        const targetIndex = prev.history.lastIndexOf(targetModal)
        if (targetIndex !== -1) {
          newHistory = prev.history.slice(0, targetIndex + 1)
        }
      } else {
        // Going forward - add to history
        newHistory.push(targetModal)
      }

      return {
        ...prev,
        currentModal: targetModal,
        stepIndex,
        history: newHistory,
        hasUnsavedChanges: false,
        originalData: {},
        changeTracking: {}
      }
    })
  }, [])


  // Check if a specific modal is open
  const isModalOpen = useCallback((modalId: string) => {
    return state.currentModal === modalId
  }, [state.currentModal])

  // Check if any modal is open
  const isAnyModalOpen = useCallback(() => {
    return state.currentModal !== null
  }, [state.currentModal])

  // Get progress percentage for current flow
  const getProgress = useCallback(() => {
    if (!state.flowSequence.length) return 0
    return ((state.stepIndex + 1) / state.totalSteps) * 100
  }, [state.flowSequence, state.stepIndex, state.totalSteps])

  // Check if currently in a flow
  const isInFlow = useCallback(() => {
    return state.flowSequence.length > 0
  }, [state.flowSequence])

  // Navigation availability
  const canNavigate = useMemo(() => ({
    prev: state.flowSequence.length > 0
      ? state.stepIndex > 0
      : state.history.length > 1,
    next: state.flowSequence.length > 0 && state.stepIndex < state.flowSequence.length - 1
  }), [state.flowSequence, state.stepIndex, state.history])

  // New methods for change tracking
  const markDataAsOriginal = useCallback((data: Record<string, any>) => {

    setState(prev => ({
      ...prev,
      originalData: { ...data },
      hasUnsavedChanges: false,
      changeTracking: {}
    }))
  }, [state.currentModal])

  const checkForUnsavedChanges = useCallback(() => {
    // If no original data has been set, treat as no changes
    if (!state.originalData || Object.keys(state.originalData).length === 0) {
      return false
    }

    const originalStr = JSON.stringify(state.originalData)
    const currentStr = JSON.stringify(state.data)
    const hasChanges = originalStr !== currentStr


    return hasChanges
  }, [state.originalData, state.data, state.currentModal])

  const resetUnsavedChanges = useCallback(() => {
    setState(prev => ({
      ...prev,
      hasUnsavedChanges: false,
      changeTracking: {}
    }))
  }, [])

  const hasUnsavedChanges = useCallback(() => {
    // Only check for unsaved changes if we have original data to compare against
    if (!state.originalData || Object.keys(state.originalData).length === 0) {
      return false
    }

    // Enhanced safeguard: don't show unsaved changes when navigating between different modal contexts
    if (state.history.length > 1) {
      const previousModal = state.history[state.history.length - 2]
      const currentModal = state.currentModal

      // Detect context switches that should not show unsaved changes
      const isContextSwitch = (
        // From ICP to any profile/settings modal
        (previousModal?.includes('icp') && currentModal?.startsWith('profile')) ||
        // From any profile modal to ICP
        (previousModal?.startsWith('profile') && currentModal?.includes('icp')) ||
        // From any profile modal to another profile modal (different context)
        (previousModal?.startsWith('profile') && currentModal?.startsWith('profile') && previousModal !== currentModal) ||
        // When current modal data is empty (fresh start)
        Object.keys(state.data).length === 0
      )

      if (isContextSwitch) {
        return false
      }
    }

    return state.hasUnsavedChanges || checkForUnsavedChanges()
  }, [state.hasUnsavedChanges, checkForUnsavedChanges, state.originalData, state.currentModal, state.history, state.data])

  // Enhanced updateModalData with change tracking
  const updateModalDataWithTracking = useCallback((newData: Partial<ModalFlowState['data']>) => {
    setState(prev => {
      const updatedData = { ...prev.data, ...newData }

      // Only check for changes if we have original data to compare against
      const hasChanges = prev.originalData && Object.keys(prev.originalData).length > 0
        ? JSON.stringify(prev.originalData) !== JSON.stringify(updatedData)
        : false

      return {
        ...prev,
        data: updatedData,
        hasUnsavedChanges: hasChanges,
        changeTracking: {
          ...prev.changeTracking,
          [prev.currentModal || 'current']: hasChanges
        }
      }
    })
  }, [])

  // Context value
  const contextValue = useMemo<ModalFlowContextType>(() => ({
    state,
    openModal,
    closeModal,
    closeAllModals,
    navigateNext,
    navigatePrevious,
    navigateToStep,
    canNavigate,
    updateModalData: updateModalDataWithTracking,
    isModalOpen,
    getProgress,
    isInFlow,
    isAnyModalOpen,
    markDataAsOriginal,
    checkForUnsavedChanges,
    resetUnsavedChanges,
    hasUnsavedChanges
  }), [
    state,
    openModal,
    closeModal,
    closeAllModals,
    navigateNext,
    navigatePrevious,
    navigateToStep,
    canNavigate,
    updateModalDataWithTracking,
    isModalOpen,
    getProgress,
    isInFlow,
    isAnyModalOpen,
    markDataAsOriginal,
    checkForUnsavedChanges,
    resetUnsavedChanges,
    hasUnsavedChanges
  ])

  // Render the current modal
  const renderCurrentModal = () => {
    if (!state.currentModal) return null

    const modalConfig = MODAL_REGISTRY[state.currentModal]
    if (!modalConfig) {
      console.error(`❌ Modal config not found for: ${state.currentModal}`)
      return null
    }


    const ModalComponent = modalConfig.component
    // Pass state data as props to the modal component
    return <ModalComponent {...state.data} mode={state.mode} />
  }

  return (
    <ModalFlowContext.Provider value={contextValue}>
      {children}
      {/* Render the current modal */}
      {renderCurrentModal()}
    </ModalFlowContext.Provider>
  )
}

// ==================== EXPORTS ====================

export { 
  MODAL_FLOWS, 
  MODAL_REGISTRY,
  type ModalFlowState,
  type ModalOpenOptions,
  type ModalConfig
}

// ==================== HELPER HOOKS ====================

// Hook to get current modal configuration
export function useCurrentModalConfig() {
  const { state } = useModalFlow()
  if (!state.currentModal) return null
  return MODAL_REGISTRY[state.currentModal] || null
}

// Hook to get current flow configuration
export function useCurrentFlow() {
  const { state } = useModalFlow()
  if (!state.flowName) return null
  return MODAL_FLOWS[state.flowName as keyof typeof MODAL_FLOWS] || null
}

// Hook to track modal analytics
export function useModalAnalytics() {
  const { state } = useModalFlow()
  
  useEffect(() => {
    if (state.currentModal) {
      // Track modal view
      console.log('Modal Analytics:', {
        event: 'modal_view',
        modalId: state.currentModal,
        flowName: state.flowName,
        mode: state.mode,
        timestamp: state.metadata.timestamp
      })
      
      // You can integrate with your analytics provider here
      // e.g., posthog.capture('modal_view', { ... })
    }
  }, [state.currentModal, state.flowName, state.mode, state.metadata.timestamp])
}

// Hook for keyboard navigation
export function useModalKeyboardNavigation() {
  const { navigateNext, navigatePrevious, closeModal, canNavigate } = useModalFlow()
  
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't interfere with form inputs
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }
      
      switch (e.key) {
        case 'ArrowLeft':
          if (canNavigate.prev && e.ctrlKey) {
            e.preventDefault()
            navigatePrevious()
          }
          break
        case 'ArrowRight':
          if (canNavigate.next && e.ctrlKey) {
            e.preventDefault()
            navigateNext()
          }
          break
        case 'Escape':
          e.preventDefault()
          closeModal()
          break
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [navigateNext, navigatePrevious, closeModal, canNavigate])
}
