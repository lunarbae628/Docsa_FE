import React from "react"
import { createPortal } from "react-dom"
import type { HoveredCommit } from "@/types/graph"

interface CommitTooltipProps {
  hoveredCommit: HoveredCommit | null
}

const CommitTooltip = React.memo(function CommitTooltip({
  hoveredCommit,
}: CommitTooltipProps) {
  if (!hoveredCommit) return null

  return createPortal(
    <div
      className="pointer-events-none fixed min-w-[220px] max-w-[280px] rounded-2xl border border-slate-800 bg-slate-950/96 px-3 py-3 shadow-[0_18px_44px_rgba(15,23,42,0.45)] backdrop-blur"
      style={{
        left: hoveredCommit.position.x,
        top: hoveredCommit.position.y,
        zIndex: 9999,
      }}
    >
      <div className="mb-2 text-sm font-semibold text-white">
        {hoveredCommit.commit.title}
      </div>
      <div
        className="text-xs leading-relaxed text-slate-300"
        style={{
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}
      >
        {hoveredCommit.commit.description}
      </div>
      {/* 화살표 */}
      <div className="absolute bottom-full left-4 h-0 w-0 border-b-[6px] border-l-[6px] border-r-[6px] border-b-slate-950 border-l-transparent border-r-transparent" />
      <div className="absolute bottom-full left-4 -mb-px h-0 w-0 border-b-[7px] border-l-[7px] border-r-[7px] border-b-slate-800 border-l-transparent border-r-transparent" />
    </div>,
    document.body,
  )
})

export default CommitTooltip
