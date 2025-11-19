import * as React from "react"

interface OnboardingArrowProps {
  direction?: "up" | "down" | "left" | "right"
  className?: string
}

export const OnboardingArrow: React.FC<OnboardingArrowProps> = ({
  direction = "down",
  className = ""
}) => {
  // Rotation based on direction
  const rotations = {
    up: "rotate-180",
    down: "rotate-0",
    left: "rotate-90",
    right: "-rotate-90"
  }

  return (
    <div className={`onboarding-arrow ${rotations[direction]} ${className}`}>
      <svg
        width="40"
        height="40"
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M20 5 L20 30 M20 30 L15 25 M20 30 L25 25"
          stroke="rgba(168, 85, 247, 0.9)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle
          cx="20"
          cy="33"
          r="2"
          fill="rgba(168, 85, 247, 0.9)"
        />
      </svg>
    </div>
  )
}
