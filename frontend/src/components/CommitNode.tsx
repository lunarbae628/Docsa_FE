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
  selectionRole?: "base" | "source" | "target" | null
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
  selectionRole,
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
        className={`nodrag nopan group relative w-[228px] rounded-[24px] ${
          selectionRole === "target"
            ? "ring-4 ring-emerald-100"
            : selectionRole
              ? "ring-4 ring-orange-100"
              : isCurrentCommit
                ? "ring-4 ring-sky-100"
                : ""
        }`}
        onMouseEnter={(e) => {
          const rect = e.currentTarget.getBoundingClientRect()
          setHoveredCommit({
            commit,
            position: {
              x: rect.left + rect.width / 2,
              y: rect.top - 10,
            },
          })
        }}
        onMouseLeave={() => setHoveredCommit(null)}
      >
        <div
          className={`w-full rounded-[24px] border bg-white px-4 py-3.5 text-left shadow-[0_12px_28px_rgba(15,23,42,0.07)] transition-colors ${
            selectionRole === "target"
              ? "border-emerald-500 bg-emerald-50/40"
              : selectionRole
                ? "border-orange-400 bg-orange-50/40"
                : isCurrentCommit
              ? "border-sky-500 bg-sky-50/40"
              : "border-slate-200 group-hover:border-slate-300"
          }`}
        >
          <div
            className="mb-3 h-1.5 w-12 rounded-full"
            style={{ backgroundColor: color }}
          />
          <div className="flex items-start gap-3">
          <div
            className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border"
            style={{ backgroundColor: `${color}12`, color, borderColor: `${color}26` }}
          >
            <GitCommitHorizontal className="h-4.5 w-4.5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[15px] font-semibold tracking-[-0.03em] text-slate-900">
              {commit.title}
            </div>
            {selectionRole ? (
              <div
                className={`mt-1 inline-flex h-5 items-center rounded-full px-2 text-[10px] font-bold ${
                  selectionRole === "target"
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-orange-100 text-orange-700"
                }`}
              >
                {selectionRole === "target" ? "선택 대상" : "기준"}
              </div>
            ) : null}
            <div className="mt-1 line-clamp-2 text-[13px] leading-5 text-slate-500">
              {commit.description || "기록된 변경사항"}
            </div>
            <div className="mt-3 flex items-center gap-1.5 text-[11px] text-slate-400">
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
