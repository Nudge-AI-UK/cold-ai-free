// src/contexts/LoadingContext.tsx
import React, { createContext, useContext, useState, ReactNode } from 'react'
import { LoadingScreen } from '@/components/ui/LoadingScreen'

interface LoadingContextType {
  showLoading: (phrases?: string[], duration?: number) => Promise<void>
  hideLoading: () => void
  isLoading: boolean
}

const LoadingContext = createContext<LoadingContextType | undefined>(undefined)

interface LoadingProviderProps {
  children: ReactNode
}

export const LoadingProvider: React.FC<LoadingProviderProps> = ({ children }) => {
  const [isLoading, setIsLoading] = useState(false)
  const [customPhrases, setCustomPhrases] = useState<string[]>()

  const showLoading = async (phrases?: string[], duration: number = 30000): Promise<void> => {
    setCustomPhrases(phrases)
    setIsLoading(true)

    return new Promise<void>((resolve) => {
      setTimeout(() => {
        setIsLoading(false)
        resolve()
      }, duration + 500)
    })
  }

  const hideLoading = () => {
    setIsLoading(false)
  }

  return (
    <LoadingContext.Provider value={{ showLoading, hideLoading, isLoading }}>
      {children}
      <LoadingScreen
        isVisible={isLoading}
        onComplete={hideLoading}
        customPhrases={customPhrases}
      />
    </LoadingContext.Provider>
  )
}

export const useLoading = (): LoadingContextType => {
  const context = useContext(LoadingContext)
  if (!context) {
    throw new Error('useLoading must be used within a LoadingProvider')
  }
  return context
}

// Predefined phrase sets for different operations
export const LOADING_PHRASES = {
  AI_PROCESSING: [
    "Analyzing your market",
    "Building buyer personas",
    "Crafting message hooks",
    "Generating ICP insights",
    "Personalizing outreach",
    "Processing knowledge base",
    "Creating sales intelligence"
  ],

  ICP_GENERATION: [
    "Analyzing market data",
    "Building buyer personas",
    "Creating messaging framework",
    "Studying target demographics",
    "Optimizing customer profiles",
    "Generating strategic insights"
  ],

  KNOWLEDGE_ANALYSIS: [
    "Scanning industry trends",
    "Processing knowledge base",
    "Analyzing product features",
    "Identifying pain points",
    "Building sales framework",
    "Optimizing content structure"
  ],

  PROFILE_SETUP: [
    "Setting up your profile",
    "Configuring preferences",
    "Initializing AI models",
    "Preparing your workspace",
    "Syncing your data",
    "Optimizing experience"
  ]
}