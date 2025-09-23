// src/components/modals/AnimatedModalBackground.tsx
import { useEffect } from 'react'
import './AnimatedModalBackground.css'

export function AnimatedModalBackground() {
  useEffect(() => {
    // Prevent body scroll when modal background is active
    document.body.style.overflow = 'hidden'
    
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [])

  return (
    <div className="animated-modal-background">
      {/* Main animated gradient background */}
      <div className="bg-animation" />
      
      {/* Floating orbs */}
      <div className="orb orb1" />
      <div className="orb orb2" />
      <div className="orb orb3" />
      <div className="orb orb4" />
      <div className="orb orb5" />
      <div className="orb orb6" />
      
      {/* Overlay for better modal contrast */}
      <div className="modal-overlay-backdrop" />
    </div>
  )
}
