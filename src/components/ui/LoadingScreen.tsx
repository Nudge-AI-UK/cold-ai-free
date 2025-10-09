// src/components/ui/LoadingScreen.tsx
import React, { useEffect, useRef, useState } from 'react'

interface LoadingScreenProps {
  isVisible: boolean
  onComplete?: () => void
  customPhrases?: string[]
}

const DEFAULT_PHRASES = [
  "Analyzing your market",
  "Building buyer personas",
  "Crafting message hooks",
  "Scanning industry trends",
  "Generating ICP insights",
  "Personalizing outreach",
  "Optimizing conversions",
  "Warming up prospects",
  "Studying competitors",
  "Tailoring communications",
  "Processing knowledge base",
  "Creating sales intelligence",
  "Enhancing targeting",
  "Developing strategies",
  "Calibrating algorithms",
  "Syncing data streams"
]

export const LoadingScreen: React.FC<LoadingScreenProps> = ({
  isVisible,
  onComplete,
  customPhrases = DEFAULT_PHRASES
}) => {
  const phrasesRef = useRef<SVGGElement>(null)
  const [currentY, setCurrentY] = useState(0)
  const animationRef = useRef<number>()
  const startTimeRef = useRef<number>()
  const [shuffledPhrases, setShuffledPhrases] = useState<string[]>([])

  const shuffleArray = (array: string[]) => {
    const shuffled = [...array]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    return shuffled
  }

  const easeInOut = (t: number) => {
    const period = 200
    return (Math.sin(t / period + 100) + 1) / 2
  }

  useEffect(() => {
    if (isVisible) {
      setShuffledPhrases(shuffleArray(customPhrases))

      // Use CSS animation instead of JavaScript
      if (phrasesRef.current) {
        phrasesRef.current.style.animation = 'slideUp 30s linear forwards'
      }

      // Auto-complete after animation
      const timer = setTimeout(() => {
        onComplete?.()
      }, 30000)

      return () => clearTimeout(timer)
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [isVisible, customPhrases, onComplete])

  if (!isVisible) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center transition-opacity duration-1000">
      {/* Add CSS keyframes for slow animation */}
      <style>{`
        @keyframes slideUp {
          0% {
            transform: translate(0, 0);
          }
          100% {
            transform: translate(0, -800px);
          }
        }
      `}</style>

      {/* Background with Cold AI gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#FBAE1C]/90 via-[#FC9109]/90 to-[#DD6800]/90" />

      {/* Main content */}
      <div className="relative z-10 flex flex-col items-center">
        {/* Animated phrases container */}
        <div className="w-[300px] h-[150px] overflow-hidden mb-8">
          <svg width="100%" height="100%" className="text-white">
            <defs>
              <mask id="phrase-mask" maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse">
                <linearGradient id="phrase-gradient" gradientUnits="objectBoundingBox" x2="0" y2="1">
                  <stop stopColor="white" stopOpacity="0" offset="0%" />
                  <stop stopColor="white" stopOpacity="1" offset="30%" />
                  <stop stopColor="white" stopOpacity="1" offset="70%" />
                  <stop stopColor="white" stopOpacity="0" offset="100%" />
                </linearGradient>
                <rect width="100%" height="100%" fill="url(#phrase-gradient)" />
              </mask>
            </defs>

            <g style={{ mask: 'url(#phrase-mask)' }}>
              <g ref={phrasesRef}>
                {shuffledPhrases.map((phrase, index) => {
                  const yOffset = 30 + 50 * index
                  return (
                    <g key={index}>
                      {/* Phrase text */}
                      <text
                        fill="white"
                        x="50"
                        y={yOffset}
                        fontSize="18"
                        fontFamily="system-ui, -apple-system, sans-serif"
                        fontWeight="500"
                      >
                        {phrase}...
                      </text>

                      {/* Animated checkmark */}
                      <g transform={`translate(10 ${yOffset - 20}) scale(0.9)`}>
                        {/* Circle background that fills */}
                        <circle
                          cx="16"
                          cy="16"
                          r="15"
                          fill="rgba(255,255,255,0.2)"
                          className="animate-pulse"
                        />

                        {/* Checkmark */}
                        <polygon
                          points="21.661,7.643 13.396,19.328 9.429,15.361 7.075,17.714 13.745,24.384 24.345,9.708"
                          fill="white"
                          className="opacity-80"
                        />

                        {/* Circle outline */}
                        <path
                          d="M16,0C7.163,0,0,7.163,0,16s7.163,16,16,16s16-7.163,16-16S24.837,0,16,0z M16,30C8.28,30,2,23.72,2,16C2,8.28,8.28,2,16,2 c7.72,0,14,6.28,14,14C30,23.72,23.72,30,16,30z"
                          fill="white"
                          opacity="0.6"
                        />
                      </g>
                    </g>
                  )
                })}
              </g>
            </g>
          </svg>
        </div>

        {/* Logo and branding */}
        <div className="flex items-center justify-center gap-4 text-white">
          {/* Bishop Logo */}
          <div className="w-12 h-12">
            <img
              src="/bishop_logo.svg"
              alt="Cold AI"
              className="w-full h-full object-contain filter brightness-0 invert"
            />
          </div>

          {/* Company name */}
          <div className="text-2xl font-bold tracking-wide">
            Cold AI
          </div>
        </div>

        {/* Subtitle */}
        <div className="text-white/80 text-sm mt-2 tracking-wide">
          Intelligent Outreach Platform
        </div>
      </div>
    </div>
  )
}

// Hook for easy loading screen management
export const useLoadingScreen = () => {
  const [isLoading, setIsLoading] = useState(false)

  const showLoading = (customPhrases?: string[], duration?: number) => {
    setIsLoading(true)
    return new Promise<void>((resolve) => {
      // Auto-resolve after animation completes
      const animationDuration = duration || 30000
      setTimeout(() => {
        setIsLoading(false)
        resolve()
      }, animationDuration + 500) // Add small buffer
    })
  }

  const hideLoading = () => {
    setIsLoading(false)
  }

  return {
    isLoading,
    showLoading,
    hideLoading,
    LoadingScreen: (props: Omit<LoadingScreenProps, 'isVisible'>) => (
      <LoadingScreen {...props} isVisible={isLoading} />
    )
  }
}