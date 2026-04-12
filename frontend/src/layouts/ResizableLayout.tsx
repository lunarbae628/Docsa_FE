import { type ReactNode, useCallback, useEffect, useRef, useState } from "react"

interface ResizableLayoutProps {
  children: [ReactNode, ReactNode] // [sidebar content, main content]
  initialWidth?: number
  minWidth?: number
  maxWidth?: number
  isSidebarCollapsed?: boolean
  collapsedWidth?: number
  collapsedSidebar?: ReactNode
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
  onWidthChange,
  className = "",
  sidebarClassName = "",
  mainClassName = "",
  resizerClassName = "",
}: ResizableLayoutProps) {
  const [sidebarWidth, setSidebarWidth] = useState(initialWidth)
  const [isResizing, setIsResizing] = useState(false)
  const sidebarRef = useRef<HTMLDivElement>(null)

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

  return (
    <div className={`flex h-full bg-gray-50 ${className}`}>
      {/* 사이드 패널 */}
      <div
        ref={sidebarRef}
        className={`bg-white border-r border-gray-200 flex-shrink-0 relative ${sidebarClassName}`}
        style={{
          width: `${isSidebarCollapsed ? collapsedWidth : sidebarWidth}px`,
        }}
      >
        <div className="h-full overflow-auto">
          {isSidebarCollapsed ? collapsedSidebar : sidebarContent}
        </div>

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
      <div className={`flex-1 bg-white overflow-auto ${mainClassName}`}>
        {mainContent}
      </div>
    </div>
  )
}
