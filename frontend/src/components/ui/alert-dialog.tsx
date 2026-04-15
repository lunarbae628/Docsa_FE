import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog"
import { AlertTriangle, Info } from "lucide-react"
import * as React from "react"
import { createContext, useCallback, useContext, useState } from "react"

import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

function AlertDialog({
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Root>) {
  return <AlertDialogPrimitive.Root data-slot="alert-dialog" {...props} />
}

function AlertDialogTrigger({
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Trigger>) {
  return (
    <AlertDialogPrimitive.Trigger data-slot="alert-dialog-trigger" {...props} />
  )
}

function AlertDialogPortal({
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Portal>) {
  return (
    <AlertDialogPrimitive.Portal data-slot="alert-dialog-portal" {...props} />
  )
}

function AlertDialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Overlay>) {
  return (
    <AlertDialogPrimitive.Overlay
      data-slot="alert-dialog-overlay"
      className={cn(
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50",
        className,
      )}
      {...props}
    />
  )
}

function AlertDialogContent({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Content>) {
  return (
    <AlertDialogPortal>
      <AlertDialogOverlay />
      <AlertDialogPrimitive.Content
        data-slot="alert-dialog-content"
        className={cn(
          "bg-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border p-6 shadow-lg duration-200 sm:max-w-lg",
          className,
        )}
        {...props}
      />
    </AlertDialogPortal>
  )
}

function AlertDialogHeader({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-dialog-header"
      className={cn("flex flex-col gap-2 text-center sm:text-left", className)}
      {...props}
    />
  )
}

function AlertDialogFooter({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-dialog-footer"
      className={cn(
        "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        className,
      )}
      {...props}
    />
  )
}

function AlertDialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Title>) {
  return (
    <AlertDialogPrimitive.Title
      data-slot="alert-dialog-title"
      className={cn("text-lg font-semibold", className)}
      {...props}
    />
  )
}

function AlertDialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Description>) {
  return (
    <AlertDialogPrimitive.Description
      data-slot="alert-dialog-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  )
}

function AlertDialogAction({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Action>) {
  return (
    <AlertDialogPrimitive.Action
      className={cn(buttonVariants(), className)}
      {...props}
    />
  )
}

function AlertDialogCancel({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Cancel>) {
  return (
    <AlertDialogPrimitive.Cancel
      className={cn(buttonVariants({ variant: "outline" }), className)}
      {...props}
    />
  )
}

function formatDialogDescription(description: string) {
  return description
    .replace(/\s+/g, " ")
    .replace(/([.!?。！？]|[가-힣]\.)\s+(?=\S)/g, "$1\n")
    .trim()
}

// Global Dialog System
interface DialogItem {
  id: string
  title: string
  description?: string
  confirmText?: string
  cancelText?: string
  variant?: "default" | "destructive"
  resolve: (result: boolean) => void
  isAlert?: boolean // 단순 알림인지 확인 다이얼로그인지 구분
}

interface DialogContextType {
  dialogs: DialogItem[]
  showDialog: (
    title: string,
    description?: string,
    options?: {
      confirmText?: string
      cancelText?: string
      variant?: "default" | "destructive"
    },
  ) => Promise<boolean>
  showAlertDialog: (
    message: string,
    title?: string,
    variant?: "default" | "destructive",
  ) => Promise<void>
  hideDialog: (id: string, result: boolean) => void
}

const DialogContext = createContext<DialogContextType | undefined>(undefined)

export function DialogProvider({ children }: { children: React.ReactNode }) {
  const [dialogs, setDialogs] = useState<DialogItem[]>([])

  const showDialog = useCallback(
    (
      title: string,
      description?: string,
      options: {
        confirmText?: string
        cancelText?: string
        variant?: "default" | "destructive"
      } = {},
    ): Promise<boolean> => {
      return new Promise((resolve) => {
        const id = Math.random().toString(36).substring(2, 9)
        const newDialog: DialogItem = {
          id,
          title,
          description,
          confirmText: options.confirmText || "확인",
          cancelText: options.cancelText || "취소",
          variant: options.variant || "default",
          resolve,
          isAlert: false,
        }

        setDialogs((prev) => [...prev, newDialog])
      })
    },
    [],
  )

  const showAlertDialog = useCallback(
    (
      message: string,
      title?: string,
      variant?: "default" | "destructive",
    ): Promise<void> => {
      return new Promise((resolve) => {
        const id = Math.random().toString(36).substring(2, 9)
        const newDialog: DialogItem = {
          id,
          title: title || "알림",
          description: message,
          confirmText: "확인",
          cancelText: "",
          variant: variant || "default",
          resolve: () => resolve(), // 항상 성공으로 처리
          isAlert: true,
        }

        setDialogs((prev) => [...prev, newDialog])
      })
    },
    [],
  )

  const hideDialog = useCallback((id: string, result: boolean) => {
    setDialogs((prev) => {
      const dialog = prev.find((d) => d.id === id)
      if (dialog) {
        dialog.resolve(result)
      }
      return prev.filter((d) => d.id !== id)
    })
  }, [])

  // Set global confirm and alert functions
  React.useEffect(() => {
    if (typeof window !== "undefined") {
      ;(window as any).customConfirm = (
        message: string,
        title?: string,
      ): Promise<boolean> => {
        return showDialog(title || "확인", message)
      }
      ;(window as any).customAlertDialog = showAlertDialog
    }

    return () => {
      if (typeof window !== "undefined") {
        ;(window as any).customConfirm = undefined
        ;(window as any).customAlertDialog = undefined
      }
    }
  }, [showDialog, showAlertDialog])

  return (
    <DialogContext.Provider
      value={{ dialogs, showDialog, showAlertDialog, hideDialog }}
    >
      {children}
      <DialogContainer />
    </DialogContext.Provider>
  )
}

function DialogContainer() {
  const context = useContext(DialogContext)
  if (!context) return null

  const { dialogs, hideDialog } = context

  return (
    <>
      {dialogs.map((dialog) => {
        const isDestructive = dialog.variant === "destructive"
        const isCompactAlert = dialog.isAlert
        const Icon = isDestructive ? AlertTriangle : Info
        const tone = isDestructive
          ? {
              content: "border-red-200",
              alertCard:
                "border-red-200/80 bg-white shadow-[0_18px_48px_rgba(127,29,29,0.12)]",
              alertIcon: "border-red-200 bg-red-50 text-red-500",
              alertButton: "bg-red-500 text-white hover:bg-red-600",
              alertTitle: "text-slate-950",
              alertDescription: "text-slate-600",
              icon: "text-red-600",
              title: "text-red-950",
              action: buttonVariants({ variant: "destructive" }),
            }
          : {
              content: "border-slate-200",
              alertCard:
                "border-orange-300/80 bg-white shadow-[0_18px_48px_rgba(180,83,9,0.16)]",
              alertIcon: "border-orange-200 bg-orange-50 text-orange-500",
              alertButton: "bg-orange-500 text-white hover:bg-orange-600",
              alertTitle: "text-slate-950",
              alertDescription: "text-slate-600",
              icon: "text-slate-500",
              title: "text-slate-950",
              action:
                "bg-slate-900 text-white hover:bg-slate-800 focus-visible:ring-slate-400",
            }

        return (
          <AlertDialog key={dialog.id} open={true}>
            <AlertDialogContent
              className={cn(
                "gap-0 overflow-hidden bg-white p-0 shadow-[0_18px_48px_rgba(15,23,42,0.14)]",
                isCompactAlert
                  ? "max-w-[390px] rounded-[18px] sm:max-w-[390px]"
                  : "max-w-[420px] rounded-2xl sm:max-w-[420px]",
                isCompactAlert ? tone.alertCard : tone.content,
              )}
            >
              {isCompactAlert ? (
                <div className="grid grid-cols-[2.25rem_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3">
                  <div
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-full border",
                      tone.alertIcon,
                    )}
                  >
                    <Icon className="h-[18px] w-[18px]" />
                  </div>
                  <div className="min-w-0">
                    <AlertDialogTitle
                      className={cn(
                        "truncate text-[13px] font-bold leading-5 tracking-[-0.02em]",
                        tone.alertTitle,
                      )}
                    >
                      {dialog.title}
                    </AlertDialogTitle>
                    {dialog.description && (
                      <AlertDialogDescription
                        className={cn(
                          "mt-0.5 whitespace-pre-line text-[12.5px] leading-5",
                          tone.alertDescription,
                        )}
                      >
                        {formatDialogDescription(dialog.description)}
                      </AlertDialogDescription>
                    )}
                  </div>
                  <AlertDialogAction
                    onClick={() => hideDialog(dialog.id, true)}
                    className={cn(
                      "h-8 rounded-xl px-4 text-[12px] font-bold shadow-none",
                      tone.alertButton,
                    )}
                  >
                    확인
                  </AlertDialogAction>
                </div>
              ) : (
                <>
                  <div className={isCompactAlert ? "p-5 pb-3" : "p-6 pb-4"}>
                    <AlertDialogHeader
                      className={cn(
                        isCompactAlert
                          ? "grid grid-cols-[1.25rem_minmax(0,1fr)] items-start gap-3 text-left sm:text-left"
                          : "grid grid-cols-[1.5rem_minmax(0,1fr)] items-start gap-3 text-left sm:text-left",
                      )}
                    >
                      <div className={cn("mt-0.5 flex shrink-0", tone.icon)}>
                        <Icon
                          className={isCompactAlert ? "h-4 w-4" : "h-4.5 w-4.5"}
                        />
                      </div>
                      <div
                        className={cn(
                          "min-w-0",
                          isCompactAlert ? "space-y-1.5" : "space-y-2",
                        )}
                      >
                        <AlertDialogTitle
                          className={cn(
                            "font-semibold tracking-[-0.03em]",
                            isCompactAlert ? "text-[16px]" : "text-[17px]",
                            tone.title,
                          )}
                        >
                          {dialog.title}
                        </AlertDialogTitle>
                        {dialog.description && (
                          <AlertDialogDescription
                            className={cn(
                              "whitespace-pre-line text-slate-500",
                              isCompactAlert
                                ? "text-[13.5px] leading-6"
                                : "text-[14px] leading-6",
                            )}
                          >
                            {formatDialogDescription(dialog.description)}
                          </AlertDialogDescription>
                        )}
                      </div>
                    </AlertDialogHeader>
                  </div>
                  <AlertDialogFooter
                    className={cn(
                      "bg-white px-5 sm:justify-end",
                      isCompactAlert
                        ? "pb-4 pt-0"
                        : "border-t border-slate-100 py-3.5",
                    )}
                  >
                    {!dialog.isAlert && dialog.cancelText && (
                      <AlertDialogCancel
                        onClick={() => hideDialog(dialog.id, false)}
                        className="h-10 rounded-xl border-slate-200 px-4 text-sm font-semibold text-slate-600 shadow-none hover:bg-slate-50"
                      >
                        {dialog.cancelText}
                      </AlertDialogCancel>
                    )}
                    <AlertDialogAction
                      onClick={() => hideDialog(dialog.id, true)}
                      className={cn(
                        "rounded-lg text-sm font-medium shadow-none",
                        isCompactAlert ? "h-8 px-3.5" : "h-9 px-4",
                        tone.action,
                      )}
                    >
                      {dialog.confirmText}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </>
              )}
            </AlertDialogContent>
          </AlertDialog>
        )
      })}
    </>
  )
}

export function useDialog() {
  const context = useContext(DialogContext)
  if (!context) {
    throw new Error("useDialog must be used within a DialogProvider")
  }
  return context
}

// Global confirm function
export function confirm(message: string, title?: string): Promise<boolean> {
  if (typeof window !== "undefined" && (window as any).customConfirm) {
    return (window as any).customConfirm(message, title)
  } else {
    // Fallback to native confirm
    return Promise.resolve(window.confirm(message))
  }
}

// Global alertDialog function
export function alertDialog(
  message: string,
  title?: string,
  variant?: "default" | "destructive",
): Promise<void> {
  if (typeof window !== "undefined" && (window as any).customAlertDialog) {
    return (window as any).customAlertDialog(message, title, variant)
  } else {
    // Fallback to native alert
    window.alert(message)
    return Promise.resolve()
  }
}

export {
  AlertDialog,
  AlertDialogPortal,
  AlertDialogOverlay,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
}
