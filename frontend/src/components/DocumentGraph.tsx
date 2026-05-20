import {
  type ReactNode,
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from "react"
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
  targetKind: "commit" | "workspace" | null
  targetId: number | null
}

type MergeSelectionState = {
  active: boolean
  sourceKind: "commit" | "workspace"
  sourceId: number
  targetKind: "commit" | "workspace" | null
  targetId: number | null
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
  panelAction?: ReactNode
  isOverlay?: boolean
}

const edgeTypes = {
  timeline: TimelineEdge,
}

function AutoFitView({
  nodeCount,
  edgeCount,
  containerRef,
}: {
  nodeCount: number
  edgeCount: number
  containerRef: RefObject<HTMLDivElement | null>
}) {
  const { fitView } = useReactFlow()

  // biome-ignore lint/correctness/useExhaustiveDependencies: 그래프 데이터/컨테이너 크기가 바뀔 때 화면을 다시 맞춘다.
  useEffect(() => {
    const fitGraph = (duration = 240) => {
      requestAnimationFrame(() => {
        void fitView({ padding: 0.18, duration })
      })
    }

    fitGraph()

    const container = containerRef.current
    if (!container || typeof ResizeObserver === "undefined") {
      return
    }

    let resizeFrame = 0
    const resizeObserver = new ResizeObserver(() => {
      window.cancelAnimationFrame(resizeFrame)
      resizeFrame = window.requestAnimationFrame(() => fitGraph(180))
    })
    resizeObserver.observe(container)

    return () => {
      window.cancelAnimationFrame(resizeFrame)
      resizeObserver.disconnect()
    }
  }, [fitView, nodeCount, edgeCount, containerRef])

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
  selectionRole: "base" | "source" | "target" | null
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
      selectionRole={data.selectionRole}
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
  selectionRole: "base" | "source" | "target" | null
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
      selectionRole={data.selectionRole}
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
  panelAction,
  isOverlay = false,
}: DocumentGraphProps) {
  const flowKey = `${data.branches.length}-${data.commits.length}-${data.edges.length}`
  const flowContainerRef = useRef<HTMLDivElement | null>(null)
  const activeCommitId =
    currentCommitId ??
    (currentSaveId
      ? null
      : mainBranch?.leafCommitId != null
        ? mainBranch.leafCommitId.toString()
        : null)
  const activeSaveId = currentSaveId
  const isMainBranchLeafCommit =
    mainBranch?.leafCommitId != null &&
    mainBranch.leafCommitId.toString() === activeCommitId

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

  const resolveCommitSelectionRole = useCallback(
    (commitId: number | null | undefined) => {
      if (!commitId) return null
      if (
        compareSelection?.active &&
        compareSelection.baseKind === "commit" &&
        compareSelection.baseId === commitId
      ) {
        return "base" as const
      }
      if (
        compareSelection?.active &&
        compareSelection.targetKind === "commit" &&
        compareSelection.targetId === commitId
      ) {
        return "target" as const
      }
      if (
        mergeSelection?.active &&
        mergeSelection.sourceKind === "commit" &&
        mergeSelection.sourceId === commitId
      ) {
        return "source" as const
      }
      if (
        mergeSelection?.active &&
        mergeSelection.targetKind === "commit" &&
        mergeSelection.targetId === commitId
      ) {
        return "target" as const
      }
      return null
    },
    [compareSelection, mergeSelection],
  )

  const resolveWorkspaceSelectionRole = useCallback(
    (saveId: number | null | undefined) => {
      if (!saveId) return null
      if (
        compareSelection?.active &&
        compareSelection.baseKind === "workspace" &&
        compareSelection.baseId === saveId
      ) {
        return "base" as const
      }
      if (
        compareSelection?.active &&
        compareSelection.targetKind === "workspace" &&
        compareSelection.targetId === saveId
      ) {
        return "target" as const
      }
      if (
        mergeSelection?.active &&
        mergeSelection.sourceKind === "workspace" &&
        mergeSelection.sourceId === saveId
      ) {
        return "source" as const
      }
      if (
        mergeSelection?.active &&
        mergeSelection.targetKind === "workspace" &&
        mergeSelection.targetId === saveId
      ) {
        return "target" as const
      }
      return null
    },
    [compareSelection, mergeSelection],
  )

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
          selectionRole:
            node.data.nodeType === "commit"
              ? resolveCommitSelectionRole(node.data.commit?.id)
              : node.data.nodeType === "temp"
                ? resolveWorkspaceSelectionRole(node.data.saveId)
                : null,
        },
      })),
    [
      rawNodes,
      onNodeMenuClick,
      isCurrentCommitLastCommit,
      resolveCommitSelectionRole,
      resolveWorkspaceSelectionRole,
    ],
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
      if (mergeSelection?.active) {
        if (
          onMergeTargetPick &&
          !(
            mergeSelection.sourceKind === "commit" &&
            mergeSelection.sourceId === node.data.commit.id
          )
        ) {
          onMergeTargetPick("commit", node.data.commit.id)
        }
        return
      }

      if (compareSelection?.active) {
        if (
          onCompareTargetPick &&
          !(
            compareSelection.baseKind === "commit" &&
            compareSelection.baseId === node.data.commit.id
          )
        ) {
          onCompareTargetPick("commit", node.data.commit.id)
        }
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
      if (mergeSelection?.active) {
        if (
          onMergeTargetPick &&
          !(
            mergeSelection.sourceKind === "workspace" &&
            mergeSelection.sourceId === node.data.saveId
          )
        ) {
          onMergeTargetPick("workspace", node.data.saveId)
        }
        return
      }

      if (compareSelection?.active) {
        if (
          onCompareTargetPick &&
          !(
            compareSelection.baseKind === "workspace" &&
            compareSelection.baseId === node.data.saveId
          )
        ) {
          onCompareTargetPick("workspace", node.data.saveId)
        }
        return
      }

      onNodeMenuClick("temp-edit", node.data.saveId, false)
    }
  }

  return (
    <div className="relative h-full w-full">
      <div
        className={`flex h-full min-h-0 w-full flex-col overflow-hidden bg-white ${
          isOverlay
            ? "rounded-[28px] shadow-[0_24px_80px_rgba(15,23,42,0.18)] ring-1 ring-slate-950/[0.04]"
            : "rounded-[28px] border border-slate-200/90 shadow-[0_20px_60px_rgba(15,23,42,0.08)]"
        }`}
      >
        <BranchTabs
          branches={data.branches}
          commits={data.commits}
          currentBranchId={currentBranchId}
          onBranchSelect={onBranchSelect}
          onBranchDelete={onBranchDelete}
          onBranchRename={onBranchRename}
          panelAction={panelAction}
        />

        <div
          ref={flowContainerRef}
          className="min-h-0 flex-1 bg-[radial-gradient(circle_at_top,#f9fbff_0%,#f8fafc_45%,#f5f7fb_100%)]"
        >
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
            .doc-graph-flow .react-flow__controls {
              box-shadow: 0 14px 28px rgba(15, 23, 42, 0.12) !important;
              border-radius: 18px !important;
              overflow: hidden !important;
              border: 1px solid #e2e8f0 !important;
            }
            .doc-graph-flow .react-flow__controls-button {
              background: rgba(255,255,255,0.98) !important;
              border-bottom: 1px solid #e2e8f0 !important;
            }
            .doc-graph-flow .react-flow__controls-button:last-child {
              border-bottom: none !important;
            }
            .doc-graph-flow .react-flow__controls-button svg {
              fill: #334155 !important;
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
            fitViewOptions={{ padding: 0.18 }}
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
            <AutoFitView
              nodeCount={nodes.length}
              edgeCount={edges.length}
              containerRef={flowContainerRef}
            />
            <Background
              variant={BackgroundVariant.Dots}
              gap={18}
              size={1.2}
              color="#e2e8f0"
            />
            <Controls className="[&_button]:!h-9 [&_button]:!w-9 [&_button]:!text-slate-700 [&_button:hover]:!bg-slate-50" />
          </ReactFlow>
        </div>
      </div>
    </div>
  )
}
