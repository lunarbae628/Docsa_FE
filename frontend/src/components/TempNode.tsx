import React from "react"
import { Handle, Position } from "reactflow"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Play } from "lucide-react"
import { GRAPH_LAYOUT } from "@/lib/graphUtils"

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

const TempNode = React.memo(function TempNode({
  tempId,
  branchName,
  color,
  isCurrentTemp,
  onNodeMenuClick,
  openDropdownId,
  setOpenDropdownId,
}: TempNodeProps) {
  return (
    <>
      <Handle
        type="target"
        position={Position.Top}
        style={{ background: "#555" }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        style={{ background: "#555" }}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        style={{ background: "#555" }}
      />
      <Handle
        type="source"
        position={Position.Left}
        id="left"
        style={{ background: "#555" }}
      />
      <Handle
        type="target"
        position={Position.Top}
        id="top"
        style={{ background: "#555" }}
      />

      <DropdownMenu
        open={openDropdownId === `temp-${tempId}`}
        onOpenChange={(open) => {
          setOpenDropdownId(open ? `temp-${tempId}` : null)
        }}
      >
        <DropdownMenuTrigger asChild>
          <div
            className={`relative p-3 cursor-pointer hover:bg-gray-50 rounded-lg transition-colors ${
              isCurrentTemp ? "bg-yellow-50 hover:bg-yellow-100" : ""
            }`}
            style={{ width: GRAPH_LAYOUT.NODE_WIDTH }}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-xs text-gray-600 mt-1 truncate invisible">
              working copy
            </div>
            <div className="font-semibold text-sm truncate text-gray-700">
              작업장
            </div>
            <div className="text-xs text-gray-500 mt-2 italic invisible">
              활성화됨
            </div>
            <div
              className="text-xs mt-2 px-2 py-1 rounded-full inline-block text-white opacity-80"
              style={{ backgroundColor: color }}
            >
              {branchName}
            </div>
          </div>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-44" alignOffset={80}>
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation()
              onNodeMenuClick("temp-edit", tempId, false)
              setOpenDropdownId(null)
            }}
            className="cursor-pointer"
          >
            <Play className="h-4 w-4 mr-2" />
            작업장 열기
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  )
})

export default TempNode
