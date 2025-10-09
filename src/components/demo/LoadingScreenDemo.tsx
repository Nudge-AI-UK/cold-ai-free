// src/components/demo/LoadingScreenDemo.tsx
import React from 'react'
import { LoadingScreen, useLoadingScreen } from '../ui/LoadingScreen'

export const LoadingScreenDemo: React.FC = () => {
  const { isLoading, showLoading, hideLoading } = useLoadingScreen()

  const handleShowDefault = () => {
    showLoading()
  }

  const handleShowCustom = () => {
    const customPhrases = [
      "Analyzing ICP data",
      "Processing outreach templates",
      "Calibrating AI algorithms",
      "Optimizing message hooks",
      "Scanning market intelligence",
      "Personalizing communications"
    ]
    showLoading(customPhrases)
  }

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-8">
      <div className="text-center space-y-8">
        <h1 className="text-3xl font-bold text-white mb-8">
          Cold AI Loading Screen Demo
        </h1>

        <div className="space-y-4">
          <button
            onClick={handleShowDefault}
            disabled={isLoading}
            className="px-8 py-3 bg-gradient-to-r from-[#FBAE1C] to-[#FC9109] text-black font-semibold rounded-lg hover:shadow-lg transition-all disabled:opacity-50"
          >
            Show Default Loading Screen
          </button>

          <button
            onClick={handleShowCustom}
            disabled={isLoading}
            className="px-8 py-3 bg-gradient-to-r from-[#FBAE1C] to-[#FC9109] text-black font-semibold rounded-lg hover:shadow-lg transition-all disabled:opacity-50 ml-4"
          >
            Show Custom Phrases
          </button>

          <button
            onClick={hideLoading}
            disabled={!isLoading}
            className="px-8 py-3 bg-gray-600 text-white font-semibold rounded-lg hover:bg-gray-500 transition-all disabled:opacity-50 ml-4"
          >
            Hide Loading (Manual)
          </button>
        </div>

        <div className="text-gray-400 text-sm max-w-md mx-auto">
          The loading screen will automatically hide after the animation completes (~8.5 seconds),
          or you can hide it manually. The bishop logo is loaded from your public folder.
        </div>
      </div>

      {/* Loading Screen */}
      <LoadingScreen
        isVisible={isLoading}
        onComplete={hideLoading}
      />
    </div>
  )
}