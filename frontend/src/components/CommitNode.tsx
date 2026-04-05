import React, { useState } from "react"
import { Clock3, GitCommitHorizontal } from "lucide-react"
import { Handle, Position } from "reactflow"
import type { Commit } from "@/types/graph"
import CommitTooltip from "@/components/CommitTooltip"

export type CommitNodeMenuType =
  | "commit-view"
  | "commit-compare"
  | "commit-continueEdit"
  | "commit-delete"
  | "commit-merge"

interface CommitNodeProps {
  commit: Commit
  branchName: string
  color: string
  isCurrentCommit: boolean
  isLastCommit: boolean
  showMergeButton: boolean
  onNodeMenuClick: (
    type: CommitNodeMenuType,
    commitId: number,
    isLastCommit: boolean,
  ) => void
  openDropdownId: string | null
  setOpenDropdownId: (id: string | null) => void
}

const HANDLE_STYLE = {
  background: "transparent",
  border: "none",
  width: 12,
  height: 12,
  opacity: 0,
}

function formatDateLabel(date: string) {
  return new Date(date).toLocaleString("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

const CommitNode = React.memo(function CommitNode({
  commit,
  color,
  isCurrentCommit,
  isLastCommit,
  showMergeButton,
  onNodeMenuClick,
}: CommitNodeProps) {
  const [hoveredCommit, setHoveredCommit] = useState<{
    commit: Commit
    position: { x: number; y: number }
  } | null>(null)

  return (
    <>
      <Handle type="target" position={Position.Top} style={HANDLE_STYLE} />
      <Handle type="source" position={Position.Bottom} style={HANDLE_STYLE} />

      <div
        className={`nodrag nopan group relative w-[220px] rounded-[22px] ${
          isCurrentCommit ? "ring-4 ring-slate-200" : ""
        }`}
        onMouseEnter={(e) => {
          const rect = e.currentTarget.getBoundingClientRect()
          setHoveredCommit({
            commit,
            position: {
              x: rect.left + rect.width / 2 - 140,
              y: rect.bottom + 12,
            },
          })
        }}
        onMouseLeave={() => setHoveredCommit(null)}
      >
        <div
          className={`w-full rounded-[22px] border bg-white p-4 text-left shadow-[0_16px_34px_rgba(15,23,42,0.08)] transition-all hover:-translate-y-0.5 hover:shadow-[0_18px_40px_rgba(15,23,42,0.12)] ${
            isCurrentCommit
              ? "border-slate-900"
              : "border-slate-200 hover:border-slate-300"
          }`}
        >
          <div className="flex items-start gap-3">
          <div
            className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl"
            style={{ backgroundColor: `${color}18`, color }}
          >
            <GitCommitHorizontal className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-lg font-semibold tracking-[-0.03em] text-slate-900">
              {commit.title}
            </div>
            <div className="mt-1 line-clamp-2 text-sm leading-5 text-slate-500">
              {commit.description || "기록된 변경사항"}
            </div>
            <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-400">
              <Clock3 className="h-3.5 w-3.5" />
              {formatDateLabel(commit.createdAt)}
            </div>
          </div>
          </div>
        </div>
      </div>

      <CommitTooltip hoveredCommit={hoveredCommit} />
    </>
  )
})

export default CommitNode
