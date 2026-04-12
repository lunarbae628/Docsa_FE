import React from "react"
import { FilePenLine, Sparkles } from "lucide-react"
import { Handle, Position } from "reactflow"

export type TempNodeMenuType = "temp-edit"

interface TempNodeProps {
  tempId: number
  branchName: string
  color: string
  isCurrentTemp: boolean
  selectionRole?: "base" | "source" | "target" | null
  title: string
  description: string
  onNodeMenuClick: (
    type: "temp-edit",
    commitId: number,
    isLastCommit?: boolean,
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

const TempNode = React.memo(function TempNode({
  tempId,
  color,
  isCurrentTemp,
  selectionRole,
  onNodeMenuClick,
}: TempNodeProps) {
  return (
    <>
      <Handle type="target" position={Position.Top} style={HANDLE_STYLE} />
      <Handle type="source" position={Position.Bottom} style={HANDLE_STYLE} />

      <div
        className={`nodrag nopan w-[228px] rounded-[24px] border bg-white px-4 py-3.5 text-left shadow-[0_12px_28px_rgba(15,23,42,0.07)] transition-colors ${
          selectionRole === "target"
            ? "border-emerald-500 bg-emerald-50/50 ring-4 ring-emerald-100"
            : selectionRole
              ? "border-orange-400 bg-orange-50/50 ring-4 ring-orange-100"
              : isCurrentTemp
            ? "border-amber-400 bg-amber-50/50 ring-4 ring-amber-100"
            : "border-slate-200 hover:border-slate-300"
        }`}
      >
        <div
          className="mb-3 h-1.5 w-12 rounded-full"
          style={{ backgroundColor: color }}
        />
        <div className="flex items-start gap-3">
          <div
            className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border"
            style={{ backgroundColor: `${color}12`, color, borderColor: `${color}24` }}
          >
            <FilePenLine className="h-4.5 w-4.5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-[15px] font-semibold tracking-[-0.03em] text-slate-900">
                편집중
              </span>
              <span
                className="inline-flex h-6 items-center rounded-full px-2.5 text-[11px] font-semibold"
                style={{ backgroundColor: `${color}14`, color }}
              >
                {selectionRole === "target"
                  ? "선택 대상"
                  : selectionRole
                    ? "기준"
                    : "워크스페이스"}
              </span>
            </div>
            <div className="mt-1 text-[13px] text-slate-500">
              아직 기록되지 않은 변경사항
            </div>
            <div className="mt-3 flex items-center gap-1.5 text-[11px] text-slate-400">
              <Sparkles className="h-3.5 w-3.5" />
              클릭해서 이어서 편집
            </div>
          </div>
        </div>
      </div>
    </>
  )
})

export default TempNode
