import * as React from "react"
import { X } from "lucide-react"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useTooltipPreference } from "@/hooks/useTooltipPreference"
import { Button } from "@/components/ui/button"

interface DismissibleTooltipProps {
  children: React.ReactNode
  content: React.ReactNode
  side?: "top" | "right" | "bottom" | "left"
  sideOffset?: number
}

export const DismissibleTooltip: React.FC<DismissibleTooltipProps> = ({
  children,
  content,
  side = "top",
  sideOffset = 4,
}) => {
  const { tooltipsEnabled, dismissTooltips } = useTooltipPreference()
  const [isOpen, setIsOpen] = React.useState(false)

  // If tooltips are globally dismissed, don't render the tooltip
  if (!tooltipsEnabled) {
    return <>{children}</>
  }

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation()
    dismissTooltips()
    setIsOpen(false)
  }

  return (
    <Tooltip open={isOpen} onOpenChange={setIsOpen}>
      <TooltipTrigger asChild>
        <span className="inline-block">{children}</span>
      </TooltipTrigger>
      <TooltipContent side={side} sideOffset={sideOffset} className="relative pr-8">
        <div className="flex items-start gap-2">
          <span>{content}</span>
          <Button
            size="sm"
            variant="ghost"
            className="absolute top-1 right-1 h-5 w-5 p-0 hover:bg-gray-700/50 rounded"
            onClick={handleDismiss}
            aria-label="Dismiss all tooltips"
          >
            <X className="w-3 h-3" />
          </Button>
        </div>
      </TooltipContent>
    </Tooltip>
  )
}
