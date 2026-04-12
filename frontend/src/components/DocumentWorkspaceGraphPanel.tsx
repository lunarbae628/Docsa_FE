import { memo } from "react"
import DocumentGraph from "@/components/DocumentGraph"
import type { Branch, GraphDataType } from "@/types/graph"
import type { CommitNodeMenuType } from "@/components/CommitNode"
import type { TempNodeMenuType } from "@/components/TempNode"

type CompareSelectionState = {
  active: boolean
  baseKind: "commit" | "workspace"
  baseId: number
}

type MergeSelectionState = {
  active: boolean
  sourceKind: "commit" | "workspace"
  sourceId: number
}

interface DocumentWorkspaceGraphPanelProps {
  graphData: GraphDataType
  mainBranch: Branch
  isInitialLoading?: boolean
  hasError?: boolean
  currentBranchId: number
  currentCommitId: string | null
  currentSaveId: string | null
  compareSelection: CompareSelectionState | null
  mergeSelection: MergeSelectionState | null
  onNodeMenuClick: (
    type: CommitNodeMenuType | TempNodeMenuType,
    commitId: number,
    isLastCommit?: boolean,
  ) => void
  onBranchSelect?: (branchId: number) => void
  onBranchDelete?: (branchId: number) => void
  onBranchRename?: (branchId: number, newName: string) => void | Promise<void>
  onCompareTargetPick?: (kind: "commit" | "workspace", id: number) => void
  onMergeTargetPick?: (kind: "commit" | "workspace", id: number) => void
}

function DocumentWorkspaceGraphPanelComponent({
  graphData,
  mainBranch,
  isInitialLoading = false,
  hasError = false,
  currentBranchId,
  currentCommitId,
  currentSaveId,
  compareSelection,
  mergeSelection,
  onNodeMenuClick,
  onBranchSelect,
  onBranchDelete,
  onBranchRename,
  onCompareTargetPick,
  onMergeTargetPick,
}: DocumentWorkspaceGraphPanelProps) {
  const hasGraph =
    graphData.branches.length > 0 ||
    graphData.commits.length > 0 ||
    graphData.edges.length > 0

  if (isInitialLoading) {
    return (
      <div className="h-full min-h-0 bg-slate-100 p-3">
        <div className="flex h-full min-h-0 w-full items-center justify-center rounded-[28px] border border-slate-200 bg-white text-sm text-slate-500 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
          작업 흐름을 불러오는 중입니다...
        </div>
      </div>
    )
  }

  if (hasError && !hasGraph) {
    return (
      <div className="h-full min-h-0 bg-slate-100 p-3">
        <div className="flex h-full min-h-0 w-full items-center justify-center rounded-[28px] border border-slate-200 bg-white text-sm text-red-500 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
          작업 흐름을 불러오지 못했습니다.
        </div>
      </div>
    )
  }

  return (
    <div className="h-full min-h-0 bg-slate-100 p-3">
      <DocumentGraph
        data={graphData}
        mainBranch={mainBranch}
        currentBranchId={currentBranchId}
        currentCommitId={currentCommitId}
        currentSaveId={currentSaveId}
        onNodeMenuClick={onNodeMenuClick}
        onBranchSelect={onBranchSelect}
        onBranchDelete={onBranchDelete}
        onBranchRename={onBranchRename}
        compareSelection={compareSelection}
        mergeSelection={mergeSelection}
        onCompareTargetPick={onCompareTargetPick}
        onMergeTargetPick={onMergeTargetPick}
      />
    </div>
  )
}

const DocumentWorkspaceGraphPanel = memo(DocumentWorkspaceGraphPanelComponent)

export default DocumentWorkspaceGraphPanel
