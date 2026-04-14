import React from 'react'
import * as TooltipPrimitive from '@radix-ui/react-tooltip'
import { cn } from '../../utils/cn'

export function TooltipProvider({ children }) {
  return (
    <TooltipPrimitive.Provider delayDuration={300}>
      {children}
    </TooltipPrimitive.Provider>
  )
}

export function Tooltip({ children, content, side = 'top' }) {
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>
        {children}
      </TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          className={cn(
            'z-50 px-2.5 py-1.5 rounded-md text-xs font-medium',
            'bg-[var(--bg-raised)] text-[var(--text-primary)]',
            'border border-[var(--border-medium)]',
            'shadow-lg',
            'animate-fade-in',
          )}
          sideOffset={6}
        >
          {content}
          <TooltipPrimitive.Arrow className="fill-[var(--bg-raised)]" />
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  )
}
