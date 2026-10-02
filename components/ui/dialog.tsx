"use client"

import * as React from "react"
import { cn } from "cn"
import { Dialog as DialogPrimitive } from "radix-ui"

import { Button } from "@/components/ui/button"
import { XIcon } from "lucide-react"

function Dialog({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(
        "fixed inset-0 isolate z-50 bg-black/40 duration-200 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
        className
      )}
      {...props}
    />
  )
}

let dialogLocks = 0
let savedScrollY = 0

function scrollPane(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) return null
  const marked = target.closest("[data-aura-scroll]")
  if (marked instanceof HTMLElement) return marked
  const content = target.closest("[data-slot='dialog-content']")
  if (content instanceof HTMLElement && content.scrollHeight > content.clientHeight + 1) return content
  return null
}

function lockPage() {
  if (dialogLocks === 0) {
    savedScrollY = window.scrollY
    document.body.dataset.auraScrollY = String(savedScrollY)
    document.body.style.top = `-${savedScrollY}px`
    document.documentElement.classList.add("aura-scroll-lock")
  }
  dialogLocks += 1
}

function unlockPage() {
  dialogLocks = Math.max(0, dialogLocks - 1)
  if (dialogLocks > 0) return
  const y = Number(document.body.dataset.auraScrollY || savedScrollY || 0)
  document.documentElement.classList.remove("aura-scroll-lock")
  document.body.style.top = ""
  delete document.body.dataset.auraScrollY
  window.scrollTo(0, y)
}

function useDialogScrollLock() {
  React.useEffect(() => {
    let held = false
    let lastY = 0
    const remember = (event: TouchEvent) => {
      lastY = event.touches[0]?.clientY ?? lastY
    }
    const holdStill = (event: TouchEvent) => {
      const pane = scrollPane(event.target)
      const y = event.touches[0]?.clientY ?? lastY
      const pullingDown = y > lastY
      lastY = y
      if (!pane) {
        event.preventDefault()
        return
      }
      const atTop = pane.scrollTop <= 0
      const atBottom = pane.scrollTop + pane.clientHeight >= pane.scrollHeight - 1
      if ((atTop && pullingDown) || (atBottom && !pullingDown)) event.preventDefault()
    }
    const sync = () => {
      const open = Boolean(document.querySelector("[data-slot='dialog-content']"))
      if (open && !held) {
        held = true
        lockPage()
        document.addEventListener("touchstart", remember, { passive: true })
        document.addEventListener("touchmove", holdStill, { passive: false })
      } else if (!open && held) {
        held = false
        document.removeEventListener("touchstart", remember)
        document.removeEventListener("touchmove", holdStill)
        unlockPage()
      }
    }
    sync()
    const observer = new MutationObserver(sync)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => {
      observer.disconnect()
      if (!held) return
      document.removeEventListener("touchstart", remember)
      document.removeEventListener("touchmove", holdStill)
      unlockPage()
    }
  }, [])
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  overlayClassName,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean
  overlayClassName?: string
}) {
  useDialogScrollLock()
  return (
    <DialogPortal>
      <DialogOverlay className={overlayClassName} />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(
          "fixed top-1/2 left-1/2 z-50 grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 rounded-xl bg-popover p-4 text-sm text-popover-foreground shadow-[0_24px_60px_-24px_oklch(0_0_0/0.65)] ring-1 ring-foreground/10 duration-200 outline-none sm:max-w-sm data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
          className
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close data-slot="dialog-close" asChild>
            <Button
              variant="ghost"
              className="absolute top-2 right-2"
              size="icon-sm"
            >
              <XIcon
              />
              <span className="sr-only">Close</span>
            </Button>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-2", className)}
      {...props}
    />
  )
}

function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  showCloseButton?: boolean
}) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "-mx-4 -mb-4 flex flex-col-reverse gap-2 rounded-b-xl border-t bg-muted/50 p-4 sm:flex-row sm:justify-end",
        className
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close asChild>
          <Button variant="outline">Close</Button>
        </DialogPrimitive.Close>
      )}
    </div>
  )
}

function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn(
        "font-heading text-base leading-none font-medium",
        className
      )}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn(
        "text-sm text-muted-foreground *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground",
        className
      )}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
