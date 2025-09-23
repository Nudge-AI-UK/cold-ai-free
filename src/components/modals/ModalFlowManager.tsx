// src/components/modals/ModalFlowManager.tsx
import { useState, useEffect, createContext, useContext, useCallback, useMemo } from 'react'
import { Plus, Package, Briefcase, MessageSquare, User, Building2, Target, Settings, CreditCard, Users } from 'lucide-react'
import { AnimatedModalBackground } from './AnimatedModalBackground'

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
  // Onboarding flow for new users
  onboarding: {
    name: 'Onboarding',
    sequence: ['profile-personal', 'profile-company', 'profile-communication', 'knowledge-product'],
    description: 'Complete your profile setup'
  },
  
  // Profile completion flow
  profileComplete: {
    name: 'Profile Setup',
    sequence: ['profile-personal', 'profile-company', 'profile-communication'],
    description: 'Complete your profile information'
  },
  
  // Knowledge base creation flow
  knowledgeCreation: {
    name: 'Knowledge Base',
    sequence: ['knowledge-product', 'knowledge-company', 'knowledge-case-studies'],
    description: 'Build your knowledge base'
  },
  
  // ICP creation flow
  icpCreation: {
    name: 'Ideal Customer Profile',
    sequence: ['icp-basic', 'icp-demographics', 'icp-firmographics', 'icp-pain-points'],
    description: 'Define your ideal customer'
  },
  
  // Settings configuration flow
  settings: {
    name: 'Settings',
    sequence: ['settings-account', 'settings-preferences', 'settings-integrations', 'settings-billing'],
    description: 'Configure your account settings'
  },
  
  // Team management flow
  teamSetup: {
    name: 'Team Setup',
    sequence: ['team-invite', 'team-roles', 'team-permissions'],
    description: 'Set up your team'
  },
  
  // Message generation flow
  messageGeneration: {
    name: 'Message Generation',
    sequence: ['message-select-icp', 'message-select-template', 'message-customize', 'message-preview'],
    description: 'Generate personalised messages'
  }
} as const

// ==================== MODAL REGISTRY ====================

const MODAL_REGISTRY: Record<string, ModalConfig> = {
  // Profile Modals
  'profile-personal': {
    id: 'profile-personal',
    component: () => null,
    title: 'Personal Information',
    icon: User,
    description: 'Your personal details and contact information'
  },
  'profile-company': {
    id: 'profile-company',
    component: () => null,
    title: 'Company Information',
    icon: Building2,
    description: 'Your company details and role'
  },
  'profile-communication': {
    id: 'profile-communication',
    component: () => null,
    title: 'Communication Style',
    icon: MessageSquare,
    description: 'Your preferred communication approach'
  },
  
  // Knowledge Base Modals
  'knowledge-product': {
    id: 'knowledge-product',
    component: () => null,
    title: 'Product/Service',
    icon: Package,
    description: 'Add your product or service details'
  },
  'knowledge-company': {
    id: 'knowledge-company',
    component: () => null,
    title: 'Company Information',
    icon: Briefcase,
    description: 'Add company knowledge'
  },
  'knowledge-case-studies': {
    id: 'knowledge-case-studies',
    component: () => null,
    title: 'Case Studies',
    icon: Target,
    description: 'Add success stories and case studies'
  },
  
  // ICP Modals
  'icp-basic': {
    id: 'icp-basic',
    component: () => null,
    title: 'Basic Information',
    icon: Target,
    description: 'Define basic ICP characteristics'
  },
  'icp-demographics': {
    id: 'icp-demographics',
    component: () => null,
    title: 'Demographics',
    icon: Users,
    description: 'Demographic information'
  },
  'icp-firmographics': {
    id: 'icp-firmographics',
    component: () => null,
    title: 'Firmographics',
    icon: Building2,
    description: 'Company characteristics'
  },
  'icp-pain-points': {
    id: 'icp-pain-points',
    component: () => null,
    title: 'Pain Points',
    icon: Target,
    description: 'Problems your ICP faces'
  },
  
  // Settings Modals
  'settings-account': {
    id: 'settings-account',
    component: () => null,
    title: 'Account Settings',
    icon: Settings,
    description: 'Manage your account'
  },
  'settings-preferences': {
    id: 'settings-preferences',
    component: () => null,
    title: 'Preferences',
    icon: Settings,
    description: 'Customise your experience'
  },
  'settings-integrations': {
    id: 'settings-integrations',
    component: () => null,
    title: 'Integrations',
    icon: Settings,
    description: 'Connect external services'
  },
  'settings-billing': {
    id: 'settings-billing',
    component: () => null,
    title: 'Billing',
    icon: CreditCard,
    description: 'Manage subscription and payments',
    requiresAuth: true
  },
  
  // Team Modals
  'team-invite': {
    id: 'team-invite',
    component: () => null,
    title: 'Invite Team Members',
    icon: Users,
    description: 'Invite colleagues to your team',
    allowedPlans: ['team', 'enterprise']
  },
  'team-roles': {
    id: 'team-roles',
    component: () => null,
    title: 'Team Roles',
    icon: Users,
    description: 'Assign roles to team members',
    allowedPlans: ['team', 'enterprise']
  },
  'team-permissions': {
    id: 'team-permissions',
    component: () => null,
    title: 'Permissions',
    icon: Settings,
    description: 'Configure team permissions',
    allowedPlans: ['team', 'enterprise']
  },
  
  // Message Generation Modals
  'message-select-icp': {
    id: 'message-select-icp',
    component: () => null,
    title: 'Select ICP',
    icon: Target,
    description: 'Choose target customer profile'
  },
  'message-select-template': {
    id: 'message-select-template',
    component: () => null,
    title: 'Choose Template',
    icon: MessageSquare,
    description: 'Select message template'
  },
  'message-customize': {
    id: 'message-customize',
    component: () => null,
    title: 'Customise Message',
    icon: MessageSquare,
    description: 'Personalise your message'
  },
  'message-preview': {
    id: 'message-preview',
    component: () => null,
    title: 'Preview & Send',
    icon: MessageSquare,
    description: 'Review and send your message'
  }
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
    }
  })

  // Debug logging in development
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('ModalFlow State:', {
        currentModal: state.currentModal,
        flowName: state.flowName,
        stepIndex: state.stepIndex,
        totalSteps: state.totalSteps,
        history: state.history
      })
    }
  }, [state])

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
          flowSequence = flow.sequence
          stepIndex = flow.sequence.indexOf(modalId)
          break
        }
      }
    } else if (MODAL_FLOWS[flowName as keyof typeof MODAL_FLOWS]) {
      // Use explicitly specified flow
      flowSequence = MODAL_FLOWS[flowName as keyof typeof MODAL_FLOWS].sequence
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

      return {
        ...prev,
        currentModal: modalId,
        mode,
        data: { ...prev.data, ...data },
        history: newHistory,
        flowSequence,
        flowName,
        stepIndex,
        totalSteps: flowSequence.length,
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
            flowSequence = flow.sequence
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
          totalSteps: flowSequence.length
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
          data: {}
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
      }
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

      return {
        ...prev,
        currentModal: nextModal,
        stepIndex: nextIndex,
        history: [...prev.history, nextModal]
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

        return {
          ...prev,
          currentModal: prevModal,
          stepIndex: prevIndex,
          history: prev.history.slice(0, -1)
        }
      } else if (prev.history.length > 1) {
        // Navigate through history
        const newHistory = [...prev.history]
        newHistory.pop()
        const previousModal = newHistory[newHistory.length - 1]

        return {
          ...prev,
          currentModal: previousModal,
          history: newHistory
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
        history: newHistory
      }
    })
  }, [])

  // Update modal data
  const updateModalData = useCallback((newData: Partial<ModalFlowState['data']>) => {
    setState(prev => ({
      ...prev,
      data: { ...prev.data, ...newData }
    }))
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
    updateModalData,
    isModalOpen,
    getProgress,
    isInFlow,
    isAnyModalOpen
  }), [
    state,
    openModal,
    closeModal,
    closeAllModals,
    navigateNext,
    navigatePrevious,
    navigateToStep,
    canNavigate,
    updateModalData,
    isModalOpen,
    getProgress,
    isInFlow,
    isAnyModalOpen
  ])

  return (
    <ModalFlowContext.Provider value={contextValue}>
      {children}
      {/* Animated Background - Shows when any modal is open */}
      {state.currentModal && <AnimatedModalBackground />}
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
