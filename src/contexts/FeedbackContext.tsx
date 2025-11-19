import { createContext, useContext, useState, useCallback, ReactNode } from 'react'

interface ActiveItems {
  productId: string | null
  icpId: string | null
  messageId: string | null
  researchId: string | null
}

interface FeedbackContextType {
  activeItems: ActiveItems
  setActiveProduct: (id: string | null) => void
  setActiveICP: (id: string | null) => void
  setActiveMessage: (id: string | null) => void
  setActiveResearch: (id: string | null) => void
  clearActiveItems: () => void
}

const FeedbackContext = createContext<FeedbackContextType | undefined>(undefined)

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [activeItems, setActiveItems] = useState<ActiveItems>({
    productId: null,
    icpId: null,
    messageId: null,
    researchId: null,
  })

  const setActiveProduct = useCallback((id: string | null) => {
    setActiveItems(prev => ({ ...prev, productId: id }))
  }, [])

  const setActiveICP = useCallback((id: string | null) => {
    setActiveItems(prev => ({ ...prev, icpId: id }))
  }, [])

  const setActiveMessage = useCallback((id: string | null) => {
    setActiveItems(prev => ({ ...prev, messageId: id }))
  }, [])

  const setActiveResearch = useCallback((id: string | null) => {
    setActiveItems(prev => ({ ...prev, researchId: id }))
  }, [])

  const clearActiveItems = useCallback(() => {
    setActiveItems({ productId: null, icpId: null, messageId: null, researchId: null })
  }, [])

  return (
    <FeedbackContext.Provider
      value={{
        activeItems,
        setActiveProduct,
        setActiveICP,
        setActiveMessage,
        setActiveResearch,
        clearActiveItems,
      }}
    >
      {children}
    </FeedbackContext.Provider>
  )
}

export function useActiveFeedbackItem() {
  const context = useContext(FeedbackContext)
  if (context === undefined) {
    throw new Error('useActiveFeedbackItem must be used within a FeedbackProvider')
  }
  return context
}
