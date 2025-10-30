import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'

interface HoverTooltipProps {
  content: string
  children: React.ReactNode
  disabled?: boolean
}

export function HoverTooltip({ content, children, disabled = false }: HoverTooltipProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [position, setPosition] = useState({ top: 0, left: 0 })
  const [opacity, setOpacity] = useState(0)
  const triggerRef = useRef<HTMLDivElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isVisible || !triggerRef.current) {
      setOpacity(0)
      return
    }

    const updatePosition = () => {
      if (!triggerRef.current || !tooltipRef.current) return

      const rect = triggerRef.current.getBoundingClientRect()
      const tooltipRect = tooltipRef.current.getBoundingClientRect()
      const tooltipWidth = tooltipRect.width || 200
      const tooltipHeight = tooltipRect.height || 40

      // Calculate center position
      const centerLeft = rect.left + rect.width / 2

      setPosition({
        top: rect.top - tooltipHeight - 8, // Position above with 8px gap
        left: centerLeft - tooltipWidth / 2 // Center horizontally
      })
    }

    updatePosition()

    // Small delay before fading in to allow position calculation
    const fadeTimeout = setTimeout(() => setOpacity(1), 10)

    // Update position on scroll or resize
    window.addEventListener('scroll', updatePosition, true)
    window.addEventListener('resize', updatePosition)

    return () => {
      clearTimeout(fadeTimeout)
      window.removeEventListener('scroll', updatePosition, true)
      window.removeEventListener('resize', updatePosition)
    }
  }, [isVisible])

  if (disabled) {
    return <>{children}</>
  }

  const tooltip = isVisible && (
    <div
      ref={tooltipRef}
      className="fixed px-3 py-2 bg-gray-900 text-white text-xs rounded-lg shadow-lg border border-white/10 pointer-events-none whitespace-nowrap transition-opacity duration-200"
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
        opacity: opacity,
        zIndex: 99999
      }}
    >
      {content}
      <div
        className="absolute left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900"
        style={{
          top: '100%',
          marginTop: '-1px'
        }}
      />
    </div>
  )

  return (
    <>
      <div
        ref={triggerRef}
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        className="inline-block"
      >
        {children}
      </div>
      {typeof document !== 'undefined' && createPortal(tooltip, document.body)}
    </>
  )
}
