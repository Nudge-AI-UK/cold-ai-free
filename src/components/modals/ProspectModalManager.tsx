import React, { createContext, useContext, useState, ReactNode } from 'react'
import { ProspectModal } from './ProspectModal'

interface ProspectModalContextType {
  openProspectModal: (prospectId: number, allProspectIds?: number[]) => void
  closeProspectModal: () => void
  navigateToProspect: (prospectId: number) => void
  navigateNext: () => void
  navigatePrevious: () => void
}

const ProspectModalContext = createContext<ProspectModalContextType | undefined>(undefined)

interface ProspectModalProviderProps {
  children: ReactNode
}

export function ProspectModalProvider({ children }: ProspectModalProviderProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [currentProspectId, setCurrentProspectId] = useState<number | null>(null)
  const [allProspectIds, setAllProspectIds] = useState<number[]>([])

  const openProspectModal = (prospectId: number, prospectIds?: number[]) => {
    setCurrentProspectId(prospectId)
    setAllProspectIds(prospectIds || [prospectId])
    setIsOpen(true)
  }

  const closeProspectModal = () => {
    setIsOpen(false)
    setCurrentProspectId(null)
  }

  const navigateToProspect = (prospectId: number) => {
    setCurrentProspectId(prospectId)
  }

  const navigateNext = () => {
    if (allProspectIds.length === 0 || !currentProspectId) return

    const currentIndex = allProspectIds.indexOf(currentProspectId)
    if (currentIndex < allProspectIds.length - 1) {
      setCurrentProspectId(allProspectIds[currentIndex + 1])
    }
  }

  const navigatePrevious = () => {
    if (allProspectIds.length === 0 || !currentProspectId) return

    const currentIndex = allProspectIds.indexOf(currentProspectId)
    if (currentIndex > 0) {
      setCurrentProspectId(allProspectIds[currentIndex - 1])
    }
  }

  const value: ProspectModalContextType = {
    openProspectModal,
    closeProspectModal,
    navigateToProspect,
    navigateNext,
    navigatePrevious,
  }

  return (
    <ProspectModalContext.Provider value={value}>
      {children}
      {isOpen && currentProspectId && (
        <ProspectModal
          prospectId={currentProspectId}
          allProspectIds={allProspectIds}
          onClose={closeProspectModal}
          onNavigateNext={navigateNext}
          onNavigatePrevious={navigatePrevious}
        />
      )}
    </ProspectModalContext.Provider>
  )
}

export function useProspectModal() {
  const context = useContext(ProspectModalContext)
  if (context === undefined) {
    throw new Error('useProspectModal must be used within a ProspectModalProvider')
  }
  return context
}
