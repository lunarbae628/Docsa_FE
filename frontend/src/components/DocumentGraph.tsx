import { useEffect, useMemo } from "react"
import ReactFlow, {
  Background,
  BackgroundVariant,
  Controls,
  type OnInit,
  type NodeMouseHandler,
  type NodeProps,
  useReactFlow,
} from "reactflow"
import "reactflow/dist/style.css"
import BranchTabs from "@/components/BranchTabs"
import CommitNode, { type CommitNodeMenuType } from "@/components/CommitNode"
import TempNode, { type TempNodeMenuType } from "@/components/TempNode"
import TimelineEdge from "@/components/TimelineEdge"
import { useGraphRender } from "@/hooks/useGraphData"
import type { Branch, GraphDataType } from "@/types/graph"
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

export interface DocumentGraphProps {
  data: GraphDataType
  currentCommitId: string | null
  currentSaveId: string | null
  currentBranchId: number
  mainBranch: Branch
  onNodeMenuClick: (
    type: CommitNodeMenuType | TempNodeMenuType,
    commitId: number,
    isLastCommit?: boolean,
  ) => void
  onBranchSelect?: (branchId: number) => void
  onBranchDelete?: (branchId: number) => void
  onBranchRename?: (branchId: number, newName: string) => void | Promise<void>
  compareSelection?: CompareSelectionState | null
  mergeSelection?: MergeSelectionState | null
  onCompareTargetPick?: (kind: "commit" | "workspace", id: number) => void
  onMergeTargetPick?: (kind: "commit" | "workspace", id: number) => void
}

const edgeTypes = {
  timeline: TimelineEdge,
}

function AutoFitView({
  nodeCount,
  edgeCount,
}: {
  nodeCount: number
  edgeCount: number
}) {
  const { fitView } = useReactFlow()

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      void fitView({ padding: 0.2, duration: 300 })
    })

    return () => cancelAnimationFrame(frame)
  }, [fitView, nodeCount, edgeCount])

  return null
}

function CommitFlowNode({
  data,
}: NodeProps<{
  commit: any
  branchName: string
  color: string
  isCurrentCommit: boolean
  isLastCommit: boolean
  showMergeButton: boolean
  onNodeMenuClick: DocumentGraphProps["onNodeMenuClick"]
  isCurrentCommitLastCommit: boolean
}>) {
  return (
    <CommitNode
      commit={data.commit}
      branchName={data.branchName}
      color={data.color}
      isCurrentCommit={data.isCurrentCommit}
      isLastCommit={data.isLastCommit}
      showMergeButton={data.showMergeButton && data.isCurrentCommitLastCommit}
      onNodeMenuClick={data.onNodeMenuClick}
      openDropdownId={null}
      setOpenDropdownId={() => {}}
    />
  )
}

function TempFlowNode({
  data,
}: NodeProps<{
  saveId: number
  branchName: string
  color: string
  isCurrentTemp: boolean
  title: string
  description: string
  onNodeMenuClick: DocumentGraphProps["onNodeMenuClick"]
}>) {
  return (
    <TempNode
      tempId={data.saveId}
      branchName={data.branchName}
      color={data.color}
      isCurrentTemp={data.isCurrentTemp}
      title={data.title}
      description={data.description}
      onNodeMenuClick={data.onNodeMenuClick}
      openDropdownId={null}
      setOpenDropdownId={() => {}}
    />
  )
}

export default function DocumentGraph({
  data,
  currentCommitId,
  currentSaveId,
  currentBranchId,
  mainBranch,
  onNodeMenuClick,
  onBranchSelect,
  onBranchDelete,
  onBranchRename,
  compareSelection,
  mergeSelection,
  onCompareTargetPick,
  onMergeTargetPick,
}: DocumentGraphProps) {
  const flowKey = `${data.branches.length}-${data.commits.length}-${data.edges.length}`
  const activeCommitId =
    currentCommitId ??
    (currentSaveId ? null : mainBranch?.leafCommitId?.toString())
  const activeSaveId = currentSaveId
  const isMainBranchLeafCommit =
    mainBranch?.leafCommitId.toString() === activeCommitId

  const { nodes: rawNodes, edges } = useGraphRender({
    data,
    activeCommitId,
    activeSaveId,
    isMainBranchLeafCommit,
  })

  const currentBranch = data.branches.find(
    (branch) => branch.id === currentBranchId,
  )
  const isCurrentCommitLastCommit =
    currentBranch?.leafCommitId === Number(currentCommitId) &&
    !currentBranch?.saveId

  const nodes = useMemo(
    () =>
      rawNodes.map((node: any) => ({
        ...node,
        draggable: false,
        selectable: false,
        data: {
          ...node.data,
          onNodeMenuClick,
          isCurrentCommitLastCommit,
        },
      })),
    [rawNodes, onNodeMenuClick, isCurrentCommitLastCommit],
  )

  const nodeTypes = useMemo(
    () => ({
      commitNode: CommitFlowNode,
      tempNode: TempFlowNode,
    }),
    [],
  )

  const handleInit: OnInit = (instance) => {
    void instance.fitView({ padding: 0.2, duration: 0 })
  }

  const handleFlowNodeClick: NodeMouseHandler = (event, node: any) => {
    const target = event.target as HTMLElement | null
    if (target?.closest("[data-graph-action='true']")) {
      return
    }

    if (node?.data?.nodeType === "commit" && node.data.commit) {
      if (
        mergeSelection?.active &&
        onMergeTargetPick &&
        !(mergeSelection.sourceKind === "commit" && mergeSelection.sourceId === node.data.commit.id)
      ) {
        onMergeTargetPick("commit", node.data.commit.id)
        return
      }

      if (
        compareSelection?.active &&
        onCompareTargetPick &&
        !(compareSelection.baseKind === "commit" && compareSelection.baseId === node.data.commit.id)
      ) {
        onCompareTargetPick("commit", node.data.commit.id)
        return
      }

      onNodeMenuClick(
        "commit-view",
        node.data.commit.id,
        Boolean(node.data.isLastCommit),
      )
      return
    }

    if (node?.data?.nodeType === "temp" && node.data.saveId) {
      if (
        mergeSelection?.active &&
        onMergeTargetPick &&
        !(mergeSelection.sourceKind === "workspace" && mergeSelection.sourceId === node.data.saveId)
      ) {
        onMergeTargetPick("workspace", node.data.saveId)
        return
      }

      if (
        compareSelection?.active &&
        onCompareTargetPick &&
        !(compareSelection.baseKind === "workspace" && compareSelection.baseId === node.data.saveId)
      ) {
        onCompareTargetPick("workspace", node.data.saveId)
        return
      }

      onNodeMenuClick("temp-edit", node.data.saveId, false)
    }
  }

  return (
    <div className="relative h-full w-full">
      <div className="flex h-full min-h-0 w-full flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
        <div className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
          <div>
            <div className="text-base font-semibold tracking-[-0.03em] text-slate-900">
              작업 흐름
            </div>
            <div className="mt-1 text-xs text-slate-500">
              {mergeSelection?.active
                ? "병합할 대상을 그래프에서 선택하세요."
                : compareSelection?.active
                ? "비교할 대상을 그래프에서 선택하세요."
                : "브랜치와 편집중 상태를 세로 그래프로 확인합니다."}
            </div>
          </div>
        </div>

        <BranchTabs
          branches={data.branches}
          commits={data.commits}
          currentBranchId={currentBranchId}
          onBranchSelect={onBranchSelect}
          onBranchDelete={onBranchDelete}
          onBranchRename={onBranchRename}
        />

        <div className="min-h-0 flex-1 bg-[linear-gradient(180deg,#fcfdff_0%,#f8fafc_100%)]">
          <style>{`
            .doc-graph-flow,
            .doc-graph-flow .react-flow__container,
            .doc-graph-flow .react-flow__renderer,
            .doc-graph-flow .react-flow__zoompane,
            .doc-graph-flow .react-flow__selectionpane,
            .doc-graph-flow .react-flow__viewport,
            .doc-graph-flow .react-flow__pane {
              cursor: default !important;
            }
            .doc-graph-flow .react-flow__node,
            .doc-graph-flow .react-flow__node * {
              cursor: pointer !important;
            }
          `}</style>
          <ReactFlow
            key={flowKey}
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onInit={handleInit}
            onNodeClick={handleFlowNodeClick}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable={false}
            panOnDrag={true}
            panOnScroll={true}
            zoomOnScroll={true}
            zoomOnPinch={true}
            zoomOnDoubleClick={false}
            selectionOnDrag={false}
            selectionKeyCode={null}
            className="doc-graph-flow bg-transparent"
            proOptions={{ hideAttribution: true }}
          >
            <AutoFitView nodeCount={nodes.length} edgeCount={edges.length} />
            <Background
              variant={BackgroundVariant.Dots}
              gap={18}
              size={1.2}
              color="#e2e8f0"
            />
            <Controls className="!shadow-none [&_button]:!h-9 [&_button]:!w-9 [&_button]:!border-slate-200 [&_button]:!bg-white [&_button]:!text-slate-700 [&_button:hover]:!bg-slate-50" />
          </ReactFlow>
        </div>
      </div>
    </div>
  )
}
