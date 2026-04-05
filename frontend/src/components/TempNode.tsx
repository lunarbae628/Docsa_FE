import React from "react"
import { FilePenLine, Sparkles } from "lucide-react"
import { Handle, Position } from "reactflow"

export type TempNodeMenuType = "temp-edit"

interface TempNodeProps {
  tempId: number
  branchName: string
  color: string
  isCurrentTemp: boolean
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
  onNodeMenuClick,
}: TempNodeProps) {
  return (
    <>
      <Handle type="target" position={Position.Top} style={HANDLE_STYLE} />
      <Handle type="source" position={Position.Bottom} style={HANDLE_STYLE} />

      <div
        className={`nodrag nopan w-[220px] rounded-[22px] border bg-white p-4 text-left shadow-[0_16px_34px_rgba(15,23,42,0.08)] transition-all hover:-translate-y-0.5 hover:shadow-[0_18px_40px_rgba(15,23,42,0.12)] ${
          isCurrentTemp
            ? "border-slate-900 ring-4 ring-amber-100"
            : "border-slate-200 hover:border-slate-300"
        }`}
      >
        <div className="flex items-start gap-3">
          <div
            className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl"
            style={{ backgroundColor: `${color}16`, color }}
          >
            <FilePenLine className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-lg font-semibold tracking-[-0.03em] text-slate-900">
                편집중
              </span>
              <span
                className="inline-flex h-6 items-center rounded-full px-2.5 text-[11px] font-semibold"
                style={{ backgroundColor: `${color}14`, color }}
              >
                워크스페이스
              </span>
            </div>
            <div className="mt-1 text-sm text-slate-500">
              아직 기록되지 않은 변경사항
            </div>
            <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-400">
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
