'use client'

import { GripHorizontal } from 'lucide-react'
import { Group, Panel, Separator } from 'react-resizable-panels'

import { cn } from '@/lib/utils'

function ResizablePanelGroup({
  className,
  ...props
}: React.ComponentProps<typeof Group>): React.JSX.Element {
  return <Group data-slot="resizable-panel-group" className={cn('flex', className)} {...props} />
}

function ResizablePanel({
  className,
  ...props
}: React.ComponentProps<typeof Panel>): React.JSX.Element {
  return (
    <Panel data-slot="resizable-panel" className={cn('min-h-0 min-w-0', className)} {...props} />
  )
}

function ResizableHandle({
  className,
  withHandle = true,
  ...props
}: React.ComponentProps<typeof Separator> & { withHandle?: boolean }): React.JSX.Element {
  return (
    <Separator
      data-slot="resizable-handle"
      className={cn(
        'group relative flex shrink-0 items-center justify-center bg-border transition-colors hover:bg-primary/40 focus-visible:bg-primary/40 focus-visible:outline-none',
        'aria-[orientation=horizontal]:h-px aria-[orientation=horizontal]:w-full aria-[orientation=horizontal]:cursor-row-resize',
        'aria-[orientation=vertical]:h-full aria-[orientation=vertical]:w-px aria-[orientation=vertical]:cursor-col-resize',
        className
      )}
      {...props}
    >
      {withHandle && (
        <div className="z-10 flex h-3.5 w-9 items-center justify-center rounded-full border border-border bg-background text-muted-foreground/70 shadow-sm group-aria-[orientation=vertical]:h-9 group-aria-[orientation=vertical]:w-3.5 group-aria-[orientation=vertical]:rotate-90">
          <GripHorizontal className="size-2.5" />
        </div>
      )}
    </Separator>
  )
}

export { ResizablePanelGroup, ResizablePanel, ResizableHandle }
