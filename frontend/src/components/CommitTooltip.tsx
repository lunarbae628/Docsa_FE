import React from "react"
import { createPortal } from "react-dom"
import { Clock3 } from "lucide-react"
import type { HoveredCommit } from "@/types/graph"

interface CommitTooltipProps {
  hoveredCommit: HoveredCommit | null
}

const CommitTooltip = React.memo(function CommitTooltip({
  hoveredCommit,
}: CommitTooltipProps) {
  if (!hoveredCommit) return null

  const width = 280
  const viewportWidth = typeof window !== "undefined" ? window.innerWidth : 1440
  const viewportHeight = typeof window !== "undefined" ? window.innerHeight : 900
  const left = Math.min(
    Math.max(16, hoveredCommit.position.x - width / 2),
    viewportWidth - width - 16,
  )
  const top = Math.min(
    Math.max(16, hoveredCommit.position.y - 12),
    viewportHeight - 140,
  )

  return createPortal(
    <div
      className="pointer-events-none fixed z-[9999] min-w-[240px] max-w-[280px] rounded-2xl border border-slate-200/70 bg-white/96 px-3.5 py-3 shadow-[0_18px_44px_rgba(15,23,42,0.16)] backdrop-blur"
      style={{
        left,
        top,
      }}
    >
      <div className="mb-1.5 text-sm font-semibold text-slate-900">
        {hoveredCommit.commit.title}
      </div>
      <div
        className="text-xs leading-relaxed text-slate-500"
        style={{
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}
      >
        {hoveredCommit.commit.description || "기록된 설명이 없습니다."}
      </div>
      <div className="mt-2 flex items-center gap-1.5 border-t border-slate-100 pt-2 text-[11px] font-medium text-slate-400">
        <Clock3 className="h-3 w-3" />
        {new Date(hoveredCommit.commit.createdAt).toLocaleString("ko-KR", {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })}
      </div>
    </div>,
    document.body,
  )
})

export default CommitTooltip
