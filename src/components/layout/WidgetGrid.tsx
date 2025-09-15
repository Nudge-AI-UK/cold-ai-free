import { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface WidgetGridProps {
  children: ReactNode
  className?: string
}

export function WidgetGrid({ children, className }: WidgetGridProps) {
  return (
    <div className={cn(
      "grid gap-4 md:gap-6",
      "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
      "auto-rows-min",
      className
    )}>
      {children}
    </div>
  )
}