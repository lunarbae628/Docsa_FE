import { memo, useMemo } from "react"
import ReactFlow, {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MarkerType,
  Position,
  type Edge,
  type Node,
  type NodeProps,
} from "reactflow"
import "reactflow/dist/style.css"
import type { Branch, Commit, GraphDataType } from "@/types/graph"
import { getBranchColor } from "@/lib/graphUtils"
import { GitCompareArrows, PencilLine } from "lucide-react"

interface WorkingSaveDemoGraphProps {
  data: GraphDataType
  currentCommitId: string | null
  currentWorkspaceId: string | null
  currentBranchId: number
  mainBranch: Branch
  compareBaseCommitId?: number | null
  compareTargetCommitId?: number | null
  compareBaseWorkspaceId?: number | null
  compareTargetWorkspaceId?: number | null
  onCommitOpen: (branchId: number, commitId: number) => void
  onWorkspaceOpen: (saveId: number) => void
  onCompareTargetPick: (kind: "commit" | "workspace", id: number) => void
}

type DemoCommitNodeData = {
  commit: Commit
  branchName: string
  color: string
  isCurrentCommit: boolean
  compareBaseCommitId?: number | null
  compareTargetCommitId?: number | null
  hasCompareBase: boolean
  onCommitOpen: (branchId: number, commitId: number) => void
  onCompareTargetPick: (kind: "commit" | "workspace", id: number) => void
}

type DemoWorkspaceNodeData = {
  saveId: number
  branchName: string
  color: string
  isCurrentWorkspace: boolean
  compareBaseWorkspaceId?: number | null
  compareTargetWorkspaceId?: number | null
  hasCompareBase: boolean
  onWorkspaceOpen: (saveId: number) => void
  onCompareTargetPick: (kind: "commit" | "workspace", id: number) => void
}

const START_X = 110
const START_Y = 84
const COLUMN_GAP = 280
const ROW_GAP = 238
const NODE_WIDTH = 190
const SAVE_OFFSET_Y = 210

const handleStyle = { background: "#64748b" }

const DemoCommitNode = memo(function DemoCommitNode({
  data,
}: NodeProps<DemoCommitNodeData>) {
  const commit = data.commit
  const isBase = data.compareBaseCommitId === commit.id
  const isTarget = data.compareTargetCommitId === commit.id
  const canPickCompare = data.hasCompareBase && !isBase

  return (
    <>
      <Handle type="target" position={Position.Top} style={handleStyle} />
      <Handle type="source" position={Position.Bottom} style={handleStyle} />
      <Handle type="source" position={Position.Right} id="right" style={handleStyle} />
      <Handle type="source" position={Position.Left} id="left" style={handleStyle} />
      <Handle type="target" position={Position.Top} id="top" style={handleStyle} />
      <Handle type="target" position={Position.Right} id="right" style={handleStyle} />
      <Handle type="target" position={Position.Left} id="left" style={handleStyle} />

      <div
        role="button"
        tabIndex={0}
        onClick={(e) => {
          e.stopPropagation()
          data.onCommitOpen(commit.branchId, commit.id)
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            data.onCommitOpen(commit.branchId, commit.id)
          }
        }}
        className={`relative rounded-xl border p-3 text-left shadow-sm transition ${
          data.isCurrentCommit
            ? "border-amber-300 bg-amber-50 ring-2 ring-amber-200/70"
            : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
        }`}
        style={{ width: NODE_WIDTH }}
      >
        <div className="pr-16">
          <div className="truncate text-sm font-semibold text-slate-900">{commit.title}</div>
          <div className="mt-1 line-clamp-2 min-h-[2.5rem] text-xs text-slate-500">
            {commit.description}
          </div>
          <div className="mt-2 text-[11px] text-slate-400">
            {new Date(commit.createdAt).toLocaleString()}
          </div>
        </div>

        <div
          className="mt-3 inline-flex rounded-full px-2 py-1 text-[11px] font-medium text-white"
          style={{ backgroundColor: data.color }}
        >
          {data.branchName}
        </div>

        <div className="absolute right-2 top-2 flex gap-1">
          {isBase ? (
            <span className="rounded-full bg-slate-900 px-2 py-1 text-[10px] font-semibold text-white">
              기준
            </span>
          ) : null}
          {isTarget ? (
            <span className="rounded-full bg-emerald-600 px-2 py-1 text-[10px] font-semibold text-white">
              비교
            </span>
          ) : null}
          {canPickCompare ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                data.onCompareTargetPick("commit", commit.id)
              }}
              className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold text-slate-600 shadow-sm hover:border-slate-300 hover:bg-slate-50"
            >
              비교
            </button>
          ) : null}
        </div>
      </div>
    </>
  )
})

const DemoWorkspaceNode = memo(function DemoWorkspaceNode({
  data,
}: NodeProps<DemoWorkspaceNodeData>) {
  const isBase = data.compareBaseWorkspaceId === data.saveId
  const isTarget = data.compareTargetWorkspaceId === data.saveId
  const canPickCompare = data.hasCompareBase && !isBase

  return (
    <>
      <Handle type="target" position={Position.Top} style={handleStyle} />
      <Handle type="target" position={Position.Top} id="top" style={handleStyle} />
      <Handle type="target" position={Position.Right} id="right" style={handleStyle} />
      <Handle type="target" position={Position.Left} id="left" style={handleStyle} />

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          data.onWorkspaceOpen(data.saveId)
        }}
        className={`relative rounded-xl border border-dashed p-3 text-left shadow-sm transition ${
          data.isCurrentWorkspace
            ? "border-amber-300 bg-amber-50 ring-2 ring-amber-200/70"
            : "border-slate-300 bg-slate-50 hover:border-slate-400 hover:bg-slate-100"
        }`}
        style={{ width: NODE_WIDTH }}
      >
        <div className="pr-16 text-sm font-semibold text-slate-800">작업장</div>
        <div className="mt-1 text-xs text-slate-500">현재 브랜치에서 이어지는 편집 상태</div>
        <div className="mt-3 flex items-center justify-between">
          <span
            className="rounded-full px-2 py-1 text-[11px] font-medium text-white"
            style={{ backgroundColor: data.color }}
          >
            {data.branchName}
          </span>
          <span className="inline-flex items-center gap-1 text-xs text-slate-500">
            <PencilLine className="h-3 w-3" /> 열기
          </span>
        </div>

        <div className="absolute right-2 top-2 flex gap-1">
          {isBase ? (
            <span className="rounded-full bg-slate-900 px-2 py-1 text-[10px] font-semibold text-white">
              기준
            </span>
          ) : null}
          {isTarget ? (
            <span className="rounded-full bg-emerald-600 px-2 py-1 text-[10px] font-semibold text-white">
              비교
            </span>
          ) : null}
          {canPickCompare ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                data.onCompareTargetPick("workspace", data.saveId)
              }}
              className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold text-slate-600 shadow-sm hover:border-slate-300 hover:bg-slate-50"
            >
              비교
            </button>
          ) : null}
        </div>
      </button>
    </>
  )
})

function getOrderedBranches(branches: Branch[], commits: Commit[]) {
  return [...branches].sort((a, b) => {
    if (a.name === "main") return -1
    if (b.name === "main") return 1

    const aRoot = commits.find((commit) => commit.id === a.rootCommitId)
    const bRoot = commits.find((commit) => commit.id === b.rootCommitId)
    const aTime = aRoot ? new Date(aRoot.createdAt).getTime() : a.id
    const bTime = bRoot ? new Date(bRoot.createdAt).getTime() : b.id
    return aTime - bTime
  })
}

function getCommitDepths(data: GraphDataType) {
  const depths = new Map<number, number>()

  for (const branch of data.branches) {
    if (!depths.has(branch.rootCommitId)) {
      depths.set(branch.rootCommitId, 0)
    }
  }

  let changed = true
  while (changed) {
    changed = false
    for (const edge of data.edges) {
      const sourceDepth = depths.get(edge.from)
      if (sourceDepth === undefined) continue
      const targetDepth = depths.get(edge.to)
      const nextDepth = sourceDepth + 1
      if (targetDepth === undefined || targetDepth < nextDepth) {
        depths.set(edge.to, nextDepth)
        changed = true
      }
    }
  }

  return depths
}

const nodeTypes = {
  demoCommit: DemoCommitNode,
  demoWorkspace: DemoWorkspaceNode,
}

export default function WorkingSaveDemoGraph({
  data,
  currentCommitId,
  currentWorkspaceId,
  currentBranchId,
  compareBaseCommitId,
  compareTargetCommitId,
  compareBaseWorkspaceId,
  compareTargetWorkspaceId,
  onCommitOpen,
  onWorkspaceOpen,
  onCompareTargetPick,
}: WorkingSaveDemoGraphProps) {
  const orderedBranches = useMemo(
    () => getOrderedBranches(data.branches, data.commits),
    [data.branches, data.commits],
  )

  const branchIndexById = useMemo(
    () => new Map(orderedBranches.map((branch, index) => [branch.id, index])),
    [orderedBranches],
  )

  const depthByCommitId = useMemo(() => getCommitDepths(data), [data])

  const branchMeta = useMemo(() => {
    return orderedBranches.map((branch) => ({
      branch,
      color: getBranchColor(branch.name),
      isCurrent: branch.id === currentBranchId,
    }))
  }, [orderedBranches, currentBranchId])

  const nodes = useMemo<Node[]>(() => {
    const commitNodes = data.commits.map((commit) => {
      const branch = orderedBranches.find((item) => item.id === commit.branchId)
      const branchIndex = branchIndexById.get(commit.branchId) ?? 0
      const x = START_X + branchIndex * COLUMN_GAP
      const y = START_Y + (depthByCommitId.get(commit.id) ?? 0) * ROW_GAP
      const color = getBranchColor(branch?.name ?? "branch")

      return {
        id: `commit-${commit.id}`,
        type: "demoCommit",
        position: { x, y },
        data: {
          commit,
          branchName: branch?.name ?? "branch",
          color,
          isCurrentCommit: currentCommitId === String(commit.id),
          compareBaseCommitId,
          compareTargetCommitId,
          hasCompareBase: Boolean(compareBaseCommitId || compareBaseWorkspaceId),
          onCommitOpen,
          onCompareTargetPick,
        },
        style: { width: NODE_WIDTH, background: "transparent", border: "none", padding: 0 },
        sourcePosition: Position.Bottom,
        targetPosition: Position.Top,
      }
    })

    const workspaceNodes = orderedBranches
      .filter((branch) => branch.saveId)
      .map((branch) => {
        const branchIndex = branchIndexById.get(branch.id) ?? 0
        const x = START_X + branchIndex * COLUMN_GAP
        const branchCommits = data.commits.filter((commit) => commit.branchId === branch.id)
        const maxDepth = branchCommits.length
          ? Math.max(...branchCommits.map((commit) => depthByCommitId.get(commit.id) ?? 0))
          : branch.fromCommitId
            ? (depthByCommitId.get(branch.fromCommitId) ?? 0) + 1
            : 0
        const y = START_Y + maxDepth * ROW_GAP + SAVE_OFFSET_Y
        const color = getBranchColor(branch.name)

        return {
          id: `save-${branch.saveId}`,
          type: "demoWorkspace",
          position: { x, y },
          data: {
            saveId: branch.saveId,
            branchName: branch.name,
            color,
            isCurrentWorkspace: currentWorkspaceId === String(branch.saveId),
            compareBaseWorkspaceId,
            compareTargetWorkspaceId,
            hasCompareBase: Boolean(compareBaseCommitId || compareBaseWorkspaceId),
            onWorkspaceOpen,
            onCompareTargetPick,
          },
          style: { width: NODE_WIDTH, background: "transparent", border: "none", padding: 0 },
          sourcePosition: Position.Bottom,
          targetPosition: Position.Top,
        }
      })

    return [...commitNodes, ...workspaceNodes]
  }, [
    data.commits,
    orderedBranches,
    branchIndexById,
    depthByCommitId,
    currentCommitId,
    currentWorkspaceId,
    compareBaseCommitId,
    compareTargetCommitId,
    compareBaseWorkspaceId,
    compareTargetWorkspaceId,
    onCommitOpen,
    onCompareTargetPick,
    onWorkspaceOpen,
  ])

  const edges = useMemo<Edge[]>(() => {
    const commitEdges = data.edges.map((edge) => {
      const fromCommit = data.commits.find((commit) => commit.id === edge.from)
      const toCommit = data.commits.find((commit) => commit.id === edge.to)
      const sameBranch = fromCommit?.branchId === toCommit?.branchId
      const fromBranchIndex = branchIndexById.get(fromCommit?.branchId ?? 0) ?? 0
      const toBranchIndex = branchIndexById.get(toCommit?.branchId ?? 0) ?? 0
      const toDepth = depthByCommitId.get(edge.to) ?? 0
      const hasUpperNodesInTargetBranch = data.commits.some((commit) => {
        const commitDepth = depthByCommitId.get(commit.id) ?? 0
        return commit.branchId === toCommit?.branchId && commit.id !== edge.to && commitDepth < toDepth
      })

      let sourceHandle: string | undefined
      let targetHandle: string | undefined

      if (!sameBranch) {
        if (toBranchIndex > fromBranchIndex) {
          sourceHandle = "right"
          targetHandle = hasUpperNodesInTargetBranch ? "left" : "top"
        } else {
          sourceHandle = "left"
          targetHandle = hasUpperNodesInTargetBranch ? "right" : "top"
        }
      }

      return {
        id: `edge-${edge.from}-${edge.to}`,
        source: `commit-${edge.from}`,
        target: `commit-${edge.to}`,
        sourceHandle,
        targetHandle,
        type: sameBranch ? "smoothstep" : "default",
        animated: !sameBranch,
        style: {
          stroke: sameBranch ? "#64748b" : "#10b981",
          strokeWidth: sameBranch ? 2 : 2.2,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: sameBranch ? "#64748b" : "#10b981",
        },
      }
    })

    const workspaceEdges = orderedBranches
      .filter((branch) => branch.saveId)
      .map((branch) => {
        const sourceCommitId = branch.leafCommitId || branch.fromCommitId
        if (!sourceCommitId) return null

        return {
          id: `save-edge-${branch.id}`,
          source: `commit-${sourceCommitId}`,
          target: `save-${branch.saveId}`,
          sourceHandle: undefined,
          targetHandle: "top",
          type: "smoothstep",
          animated: true,
          style: {
            stroke: "#f59e0b",
            strokeWidth: 2,
            strokeDasharray: "6 4",
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: "#f59e0b",
          },
        }
      })
      .filter(Boolean) as Edge[]

    return [...commitEdges, ...workspaceEdges]
  }, [data.commits, data.edges, orderedBranches, branchIndexById, depthByCommitId])

  const compareGuideVisible = Boolean(compareBaseCommitId || compareBaseWorkspaceId)

  return (
    <div className="flex h-full w-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 bg-white px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          {branchMeta.map(({ branch, color, isCurrent }) => (
            <div
              key={branch.id}
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium ${
                isCurrent
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200 bg-slate-50 text-slate-700"
              }`}
            >
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: isCurrent ? "#ffffff" : color }}
              />
              {branch.name}
            </div>
          ))}
        </div>
      </div>

      {compareGuideVisible ? (
        <div className="flex items-center gap-2 border-b border-indigo-100 bg-indigo-50 px-4 py-2 text-xs font-medium text-indigo-700">
          <GitCompareArrows className="h-3.5 w-3.5" />
          기준 버전을 열어둔 상태입니다. 다른 기록이나 작업장의 비교 버튼으로 바로 대상을 고르세요.
        </div>
      ) : null}

      <div className="min-h-0 flex-1 bg-slate-50">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.16 }}
        >
          <Background variant={BackgroundVariant.Dots} gap={14} size={1} />
          <Controls />
        </ReactFlow>
      </div>
    </div>
  )
}
