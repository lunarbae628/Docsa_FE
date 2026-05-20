import { type ReactNode, useCallback, useEffect, useRef, useState } from "react"

interface ResizableLayoutProps {
  children: [ReactNode, ReactNode] // [sidebar content, main content]
  initialWidth?: number
  minWidth?: number
  maxWidth?: number
  isSidebarCollapsed?: boolean
  collapsedWidth?: number
  collapsedSidebar?: ReactNode
  revealCollapsedOnHover?: boolean
  onWidthChange?: (width: number) => void
  className?: string
  sidebarClassName?: string
  mainClassName?: string
  resizerClassName?: string
}

export default function ResizableLayout({
  children,
  initialWidth = 300,
  minWidth = 200,
  maxWidth = 600,
  isSidebarCollapsed = false,
  collapsedWidth = 56,
  collapsedSidebar,
  revealCollapsedOnHover = false,
  onWidthChange,
  className = "",
  sidebarClassName = "",
  mainClassName = "",
  resizerClassName = "",
}: ResizableLayoutProps) {
  const [sidebarWidth, setSidebarWidth] = useState(initialWidth)
  const [isResizing, setIsResizing] = useState(false)
  const [isCollapsedHovered, setIsCollapsedHovered] = useState(false)
  const sidebarRef = useRef<HTMLDivElement>(null)
  const revealRef = useRef<HTMLDivElement>(null)

  const startResizing = useCallback(() => {
    setIsResizing(true)
  }, [])

  const stopResizing = useCallback(() => {
    setIsResizing(false)
  }, [])

  const resize = useCallback(
    (mouseMoveEvent: MouseEvent) => {
      if (isResizing && !isSidebarCollapsed) {
        const newWidth = mouseMoveEvent.clientX
        if (newWidth >= minWidth && newWidth <= maxWidth) {
          setSidebarWidth(newWidth)
          onWidthChange?.(newWidth)
        }
      }
    },
    [isResizing, isSidebarCollapsed, minWidth, maxWidth, onWidthChange],
  )

  useEffect(() => {
    if (isResizing) {
      document.addEventListener("mousemove", resize)
      document.addEventListener("mouseup", stopResizing)
      document.body.style.cursor = "col-resize"
      document.body.style.userSelect = "none"
    } else {
      document.removeEventListener("mousemove", resize)
      document.removeEventListener("mouseup", stopResizing)
      document.body.style.cursor = ""
      document.body.style.userSelect = ""
    }

    return () => {
      document.removeEventListener("mousemove", resize)
      document.removeEventListener("mouseup", stopResizing)
      document.body.style.cursor = ""
      document.body.style.userSelect = ""
    }
  }, [isResizing, resize, stopResizing])

  const [sidebarContent, mainContent] = children
  const shouldRevealCollapsedSidebar =
    isSidebarCollapsed && revealCollapsedOnHover
  const isCollapsedSidebarRevealed =
    shouldRevealCollapsedSidebar && isCollapsedHovered
  const hasOpenFloatingMenu = useCallback(
    () =>
      Boolean(document.querySelector("[data-radix-popper-content-wrapper]")),
    [],
  )
  const showCollapsedSidebar = () => {
    setIsCollapsedHovered(true)
  }

  useEffect(() => {
    if (!isCollapsedSidebarRevealed) {
      return
    }

    const isPointInRect = (
      rect: DOMRect | undefined,
      clientX: number,
      clientY: number,
    ) => {
      if (!rect) return false

      const buffer = 8
      return (
        clientX >= rect.left - buffer &&
        clientX <= rect.right + buffer &&
        clientY >= rect.top - buffer &&
        clientY <= rect.bottom + buffer
      )
    }

    const handlePointerMove = (event: PointerEvent) => {
      if (hasOpenFloatingMenu()) {
        return
      }

      const sidebarRect = sidebarRef.current?.getBoundingClientRect()
      const revealRect = revealRef.current?.getBoundingClientRect()
      const isInSidebar =
        isPointInRect(sidebarRect, event.clientX, event.clientY) ||
        isPointInRect(revealRect, event.clientX, event.clientY)

      if (!isInSidebar) {
        setIsCollapsedHovered(false)
      }
    }

    document.addEventListener("pointermove", handlePointerMove)

    return () => {
      document.removeEventListener("pointermove", handlePointerMove)
    }
  }, [hasOpenFloatingMenu, isCollapsedSidebarRevealed])

  return (
    <div className={`flex h-full min-w-0 bg-gray-50 ${className}`}>
      {/* 사이드 패널 */}
      <div
        ref={sidebarRef}
        className={`relative z-20 flex-shrink-0 ${
          isSidebarCollapsed
            ? "bg-slate-100"
            : "border-r border-gray-200 bg-white"
        } ${sidebarClassName}`}
        onMouseEnter={showCollapsedSidebar}
        onFocusCapture={showCollapsedSidebar}
        style={{
          width: `${isSidebarCollapsed ? collapsedWidth : sidebarWidth}px`,
          transition: isResizing ? undefined : "width 180ms ease",
        }}
      >
        {shouldRevealCollapsedSidebar ? (
          <>
            <div className="h-full min-h-0 overflow-hidden">
              {collapsedSidebar}
            </div>
            {isCollapsedSidebarRevealed ? (
              <div
                ref={revealRef}
                className="absolute z-30 min-h-0 translate-x-0 overflow-visible bg-transparent opacity-100 transition-[opacity,transform] duration-300 ease-out will-change-transform"
                onMouseEnter={showCollapsedSidebar}
                style={{
                  top: "14px",
                  bottom: "14px",
                  left: `${collapsedWidth}px`,
                  width: `${sidebarWidth + 14}px`,
                  paddingLeft: "14px",
                }}
              >
                {sidebarContent}
              </div>
            ) : null}
          </>
        ) : (
          <div className="h-full min-h-0 overflow-hidden">
            {isSidebarCollapsed ? collapsedSidebar : sidebarContent}
          </div>
        )}

        {/* 리사이즈 핸들 */}
        {!isSidebarCollapsed ? (
          <div
            className={`absolute top-0 right-0 w-1 h-full cursor-col-resize bg-transparent hover:bg-blue-500 transition-colors duration-200 ${resizerClassName}`}
            onMouseDown={startResizing}
          >
            <div className="w-full h-full flex items-center justify-center">
              <div className="w-0.5 h-8 bg-gray-300 hover:bg-blue-500 transition-colors duration-200"></div>
            </div>
          </div>
        ) : null}
      </div>

      {/* 메인 컨텐츠 영역 */}
      <div
        className={`min-w-0 flex-1 overflow-hidden bg-white ${mainClassName}`}
      >
        {mainContent}
      </div>
    </div>
  )
}
