// src/components/modals/BaseModal.tsx
import React, { useEffect, useRef } from 'react'
import { X, ChevronLeft, ChevronRight, User, Building2, MessageSquare, Package, Target } from 'lucide-react'
import { useModalFlow } from './ModalFlowManager'
import { AnimatedModalBackground } from './AnimatedModalBackground'

interface BaseModalProps {
  children: React.ReactNode
  title: string
  description: string
  className?: string
}

export function BaseModal({ children, title, description, className = '' }: BaseModalProps) {
  const {
    state,
    closeModal,
    closeAllModals,
    navigateNext,
    navigatePrevious,
    navigateToStep,
    canNavigate,
    getProgress,
    isInFlow,
    hasUnsavedChanges
  } = useModalFlow()

  const modalRef = useRef<HTMLDivElement>(null)
  const [slideDirection, setSlideDirection] = React.useState<'left' | 'right' | 'none'>('none')
  const [isTransitioning, setIsTransitioning] = React.useState(false)
  const prevStepRef = useRef<number>(state.stepIndex)

  // Handle close with unsaved changes check
  const handleClose = () => {
    const hasChanges = hasUnsavedChanges()

    if (hasChanges) {
      if (window.confirm('You have unsaved changes. Are you sure you want to close without saving?')) {
        closeAllModals()
      }
    } else {
      closeAllModals()
    }
  }

  // Track step changes for slide animation
  useEffect(() => {
    if (isInFlow() && prevStepRef.current !== state.stepIndex) {
      const direction = state.stepIndex > prevStepRef.current ? 'left' : 'right'
      setSlideDirection(direction)
      setIsTransitioning(true)

      // Reset after animation
      const timer = setTimeout(() => {
        setIsTransitioning(false)
        setSlideDirection('none')
      }, 500)

      prevStepRef.current = state.stepIndex
      return () => clearTimeout(timer)
    }
  }, [state.stepIndex, isInFlow])

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't interfere with form inputs
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }

      switch (e.key) {
        case 'ArrowLeft':
          if (canNavigate.prev) {
            e.preventDefault()
            navigatePrevious()
          }
          break
        case 'ArrowRight':
          if (canNavigate.next) {
            e.preventDefault()
            navigateNext()
          }
          break
        case 'Escape':
          e.preventDefault()
          handleClose()
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [navigateNext, navigatePrevious, handleClose, canNavigate])

  // Progress dots with icons for flows
  const renderProgressDots = () => {
    if (!isInFlow() || state.totalSteps <= 1) return null

    // Icon mapping for modal types
    const getModalIcon = (modalId: string) => {
      const iconMap: Record<string, React.ComponentType<any>> = {
        'profile-personal': User,
        'profile-company': Building2,
        'profile-communication': MessageSquare,
        'knowledge': Package,
        'icp-edit': Target,
        'settings-account': User,
        'settings-preferences': User,
        'settings-integrations': Building2,
        'settings-billing': Target
      }
      return iconMap[modalId] || Package
    }

    return (
      <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 flex gap-3 z-20">
        {state.flowSequence.map((modalId, index) => {
          const IconComponent = getModalIcon(modalId)
          const isActive = index === state.stepIndex

          return (
            <div
              key={index}
              className={`
                relative transition-all duration-300 cursor-pointer transform
                ${isActive ? 'scale-125' : 'scale-100 hover:scale-110'}
              `}
              onClick={() => navigateToStep(index)}
            >
              {/* Background circle */}
              <div
                className={`
                  w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300
                  ${isActive
                    ? 'bg-gradient-to-r from-[#FBAE1C] to-[#FC9109] shadow-lg shadow-[#FBAE1C]/30'
                    : 'bg-white/10 border border-white/20 hover:bg-white/20'
                  }
                `}
              >
                <IconComponent
                  className={`
                    transition-all duration-300
                    ${isActive
                      ? 'w-5 h-5 text-black'
                      : 'w-4 h-4 text-white/60'
                    }
                  `}
                />
              </div>

              {/* Active pulse effect */}
              {isActive && (
                <div className="absolute inset-0 rounded-full bg-gradient-to-r from-[#FBAE1C] to-[#FC9109] animate-pulse opacity-50"></div>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <>
      <AnimatedModalBackground />
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[rgba(10,14,27,0.4)] backdrop-blur-sm"
        onClick={(e) => {
          // Only close if clicking the backdrop, not the modal content
          if (e.target === e.currentTarget) {
            handleClose()
          }
        }}
      >

      {/* Navigation Arrows */}
      {isInFlow() && (
        <>
          <button
            onClick={navigatePrevious}
            disabled={!canNavigate.prev}
            className={`
              absolute top-1/2 left-4 transform -translate-y-1/2 z-20
              w-12 h-12 rounded-full bg-transparent border-none
              flex items-center justify-center cursor-pointer transition-all duration-300
              ${canNavigate.prev
                ? 'opacity-100 hover:scale-110'
                : 'opacity-30 cursor-not-allowed'
              }
            `}
          >
            <ChevronLeft
              className={`
                w-8 h-8 transition-all duration-300
                ${canNavigate.prev
                  ? 'text-white/90 hover:text-[#FBAE1C] drop-shadow-lg'
                  : 'text-white/30'
                }
              `}
              strokeWidth={2.5}
            />
          </button>

          <button
            onClick={navigateNext}
            disabled={!canNavigate.next}
            className={`
              absolute top-1/2 right-4 transform -translate-y-1/2 z-20
              w-12 h-12 rounded-full bg-transparent border-none
              flex items-center justify-center cursor-pointer transition-all duration-300
              ${canNavigate.next
                ? 'opacity-100 hover:scale-110'
                : 'opacity-30 cursor-not-allowed'
              }
            `}
          >
            <ChevronRight
              className={`
                w-8 h-8 transition-all duration-300
                ${canNavigate.next
                  ? 'text-white/90 hover:text-[#FBAE1C] drop-shadow-lg'
                  : 'text-white/30'
                }
              `}
              strokeWidth={2.5}
            />
          </button>
        </>
      )}

      {/* Progress Dots */}
      {renderProgressDots()}

      {/* Carousel Container */}
      <div className={`w-full ${className.includes('icp-modal-large') || className.includes('knowledge-modal-large') ? 'max-w-[95vw]' : 'max-w-4xl'} ${className.includes('icp-modal-large') || className.includes('knowledge-modal-large') ? 'h-[90vh]' : 'h-[calc(100vh-2rem)] max-h-[800px]'}`}>
        {/* Modal Slide */}
        <div
          ref={modalRef}
          className={`
            w-full h-full flex flex-col
            transition-all duration-500 ease-out
            ${className}
          `}
          style={{
            opacity: isTransitioning ? 0.95 : 1,
            transform: isTransitioning
              ? slideDirection === 'left'
                ? 'translateX(-20px) scale(0.98)'
                : 'translateX(20px) scale(0.98)'
              : 'translateX(0px) scale(1)'
          }}
        >
          {/* Glass Effect Modal */}
          <div className="h-full flex flex-col rounded-3xl border border-white/10 text-white overflow-hidden
                         bg-gradient-to-br from-[rgba(10,14,27,0.95)] to-[rgba(26,31,54,0.95)]
                         backdrop-blur-[10px] shadow-2xl shadow-black/50">
            {/* Modal Header */}
            <div className="flex-shrink-0 p-6 pb-4 border-b border-white/10 bg-gradient-to-b from-[rgba(10,14,27,0.98)] to-[rgba(26,31,54,0.95)] relative">
              <button
                onClick={handleClose}
                className="absolute top-6 right-6 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all duration-200"
              >
                <X className="w-4 h-4" />
              </button>

              <h2 className="text-xl font-bold mb-1 pr-12">{title}</h2>
              <p className="text-sm text-gray-400">{description}</p>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6">
              {children}
            </div>
          </div>
        </div>
      </div>

      </div>
    </>
  )
}

// Modal Footer Component
interface ModalFooterProps {
  onBack?: () => void
  onNext?: () => void
  onSkip?: () => void
  onComplete?: () => void
  backLabel?: string
  nextLabel?: string
  skipLabel?: string
  completeLabel?: string
  showBack?: boolean
  showNext?: boolean
  showSkip?: boolean
  showComplete?: boolean
  isLoading?: boolean
  // New props for dynamic behavior
  dynamicMode?: boolean // When true, automatically determines Save vs Next
  hasExistingData?: boolean // Whether this is editing existing data
  hasChanges?: boolean // Whether there are unsaved changes
  onSave?: () => void // Save handler for existing data
  saveLabel?: string // Custom save label
}

export function ModalFooter({
  onBack,
  onNext,
  onSkip,
  onComplete,
  backLabel = 'Back',
  nextLabel = 'Next',
  skipLabel = 'Skip',
  completeLabel = 'Complete',
  showBack = true,
  showNext = true,
  showSkip = false,
  showComplete = false,
  isLoading = false,
  // New props
  dynamicMode = false,
  hasExistingData = false,
  hasChanges = false,
  onSave,
  saveLabel = 'Save'
}: ModalFooterProps) {
  const { canNavigate, navigateNext, navigatePrevious, hasUnsavedChanges } = useModalFlow()

  const handleBack = () => {
    if (onBack) {
      onBack()
    } else {
      navigatePrevious()
    }
  }

  const handleNext = () => {
    if (onNext) {
      onNext()
    } else {
      navigateNext()
    }
  }

  // Dynamic behavior logic
  const shouldShowSave = dynamicMode && hasExistingData
  const saveDisabled = shouldShowSave && !hasChanges && !hasUnsavedChanges()
  const effectiveNextLabel = shouldShowSave ? saveLabel : nextLabel
  const effectiveOnNext = shouldShowSave ? (onSave || onNext) : onNext

  // Same logic for complete buttons
  const effectiveCompleteLabel = shouldShowSave ? saveLabel : completeLabel
  const effectiveOnComplete = shouldShowSave ? (onSave || onComplete) : onComplete

  // Debug logging for dynamic behavior (throttled)
  React.useEffect(() => {
    if (dynamicMode) {
      const timeoutId = setTimeout(() => {
        console.log('ModalFooter dynamic behavior:', {
          dynamicMode,
          hasExistingData,
          hasChanges,
          hasUnsavedChanges: hasUnsavedChanges(),
          shouldShowSave,
          saveDisabled,
          effectiveNextLabel,
          effectiveCompleteLabel
        })
      }, 50)
      return () => clearTimeout(timeoutId)
    }
  }, [dynamicMode, hasExistingData, hasChanges, shouldShowSave, saveDisabled])

  return (
    <div className="flex-shrink-0 p-6 pt-4 border-t border-white/10 bg-gradient-to-t from-[rgba(10,14,27,0.98)] to-[rgba(26,31,54,0.95)]">
      <div className="flex justify-between items-center">
        {/* Left Side - Back/Skip */}
        <div className="flex gap-3">
          {showBack && (
            <button
              onClick={handleBack}
              disabled={!canNavigate.prev || isLoading}
              className="px-4 py-2 rounded-lg border border-[#FBAE1C]/50 text-[#FBAE1C] font-medium text-sm
                         hover:bg-[#FBAE1C]/10 hover:border-[#FBAE1C] transition-all duration-200
                         disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {backLabel}
            </button>
          )}

          {showSkip && (
            <button
              onClick={onSkip}
              disabled={isLoading}
              className="px-4 py-2 rounded-lg border border-white/20 text-gray-400 font-medium text-sm
                         hover:bg-white/5 hover:border-white/30 hover:text-white transition-all duration-200
                         disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {skipLabel}
            </button>
          )}
        </div>

        {/* Right Side - Next/Complete */}
        <div className="flex gap-3">
          {showNext && (
            <button
              onClick={effectiveOnNext || handleNext}
              disabled={shouldShowSave ? saveDisabled || isLoading : (!canNavigate.next || isLoading)}
              className={`px-6 py-2 rounded-lg font-medium text-sm transition-all duration-200
                         ${shouldShowSave && saveDisabled
                           ? 'bg-gray-600/50 text-gray-400 cursor-not-allowed'
                           : 'bg-gradient-to-r from-[#FBAE1C] to-[#FC9109] text-white hover:shadow-lg hover:shadow-[#FBAE1C]/30 hover:-translate-y-0.5'
                         }
                         disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none`}
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  {shouldShowSave ? 'Saving...' : 'Processing...'}
                </div>
              ) : (
                effectiveNextLabel
              )}
            </button>
          )}

          {showComplete && (
            <button
              onClick={effectiveOnComplete || onComplete}
              disabled={shouldShowSave ? saveDisabled || isLoading : isLoading}
              className={`px-6 py-2 rounded-lg font-medium text-sm transition-all duration-200
                         ${shouldShowSave && saveDisabled
                           ? 'bg-gray-600/50 text-gray-400 cursor-not-allowed'
                           : 'bg-gradient-to-r from-[#FBAE1C] to-[#FC9109] text-white hover:shadow-lg hover:shadow-[#FBAE1C]/30 hover:-translate-y-0.5'
                         }
                         disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none`}
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  {shouldShowSave ? 'Saving...' : 'Saving...'}
                </div>
              ) : (
                effectiveCompleteLabel
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// Section Card Component for consistent styling
interface SectionCardProps {
  children: React.ReactNode
  title: string
  className?: string
  titleColor?: 'orange' | 'amber'
}

export function SectionCard({
  children,
  title,
  className = '',
  titleColor = 'orange'
}: SectionCardProps) {
  const titleColorClass = titleColor === 'orange' ? 'text-[#FBAE1C]' : 'text-amber-400'

  return (
    <div className={`
      bg-gradient-to-br from-white/3 to-white/1 border border-white/10 rounded-2xl p-4
      ${className}
    `}>
      <h3 className={`text-sm font-medium ${titleColorClass} mb-4`}>
        {title}
      </h3>
      {children}
    </div>
  )
}