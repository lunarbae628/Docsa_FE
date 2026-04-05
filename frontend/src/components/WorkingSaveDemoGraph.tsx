import { useMemo } from "react"
import type { Branch, Commit, GraphDataType } from "@/types/graph"
import { getBranchColor } from "@/lib/graphUtils"
import { Clock3, X } from "lucide-react"

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
  onBranchSelect: (branchId: number) => void
  onBranchDelete: (branchId: number) => void
}

type TimelineRow =
  | {
      key: string
      kind: "workspace"
      branch: Branch
      laneIndex: number
      color: string
      saveId: number
      isCurrent: boolean
      isBase: boolean
      isTarget: boolean
      canPickCompare: boolean
    }
  | {
      key: string
      kind: "commit"
      branch: Branch
      laneIndex: number
      color: string
      commit: Commit
      isCurrent: boolean
      isBase: boolean
      isTarget: boolean
      canPickCompare: boolean
      fromCommitId: number | null
      isBranchRoot: boolean
    }

type EdgePath = {
  key: string
  d: string
  color: string
  dashed?: boolean
}

const ROW_HEIGHT = 64
const LANE_START_X = 28
const LANE_GAP = 22
const GRAPH_PADDING_RIGHT = 24

function formatDateLabel(date: string) {
  return new Date(date).toLocaleString()
}

function sortCommitsDesc(commits: Commit[]) {
  return [...commits].sort((a, b) => {
    const timeDiff =
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    if (timeDiff !== 0) return timeDiff
    return b.id - a.id
  })
}

function buildRows(
  data: GraphDataType,
  currentCommitId: string | null,
  currentWorkspaceId: string | null,
  compareBaseCommitId?: number | null,
  compareTargetCommitId?: number | null,
  compareBaseWorkspaceId?: number | null,
  compareTargetWorkspaceId?: number | null,
) {
  const branchById = new Map(data.branches.map((branch) => [branch.id, branch]))
  const laneIndexByBranchId = new Map(
    data.branches.map((branch, index) => [branch.id, index]),
  )
  const rows: TimelineRow[] = []
  const workspaceByAnchorCommitId = new Map<number, TimelineRow[]>()
  for (const branch of data.branches) {
    if (!branch.saveId) continue

    const laneIndex = laneIndexByBranchId.get(branch.id) ?? 0
    const color = getBranchColor(branch.name)
    const workspaceRow: TimelineRow = {
      key: `workspace-${branch.saveId}`,
      kind: "workspace",
      branch,
      laneIndex,
      color,
      saveId: branch.saveId,
      isCurrent: currentWorkspaceId === String(branch.saveId),
      isBase: compareBaseWorkspaceId === branch.saveId,
      isTarget: compareTargetWorkspaceId === branch.saveId,
      canPickCompare:
        Boolean(compareBaseCommitId || compareBaseWorkspaceId) &&
        compareBaseWorkspaceId !== branch.saveId,
    }

    const anchorCommitId = branch.leafCommitId || branch.fromCommitId
    if (!anchorCommitId) {
      rows.push(workspaceRow)
      continue
    }

    const anchoredRows = workspaceByAnchorCommitId.get(anchorCommitId) ?? []
    anchoredRows.push(workspaceRow)
    workspaceByAnchorCommitId.set(anchorCommitId, anchoredRows)
  }

  for (const commit of sortCommitsDesc(data.commits)) {
    const branch = branchById.get(commit.branchId)
    if (!branch) continue

    const laneIndex = laneIndexByBranchId.get(branch.id) ?? 0
    const color = getBranchColor(branch.name)

    rows.push({
      key: `commit-${commit.id}`,
      kind: "commit",
      branch,
      laneIndex,
      color,
      commit,
      isCurrent: currentCommitId === String(commit.id),
      isBase: compareBaseCommitId === commit.id,
      isTarget: compareTargetCommitId === commit.id,
      canPickCompare:
        Boolean(compareBaseCommitId || compareBaseWorkspaceId) &&
        compareBaseCommitId !== commit.id,
      fromCommitId: branch.fromCommitId,
      isBranchRoot: branch.rootCommitId === commit.id && Boolean(branch.fromCommitId),
    })

    const anchoredWorkspaceRows = workspaceByAnchorCommitId.get(commit.id)
    if (anchoredWorkspaceRows) {
      rows.splice(rows.length - 1, 0, ...anchoredWorkspaceRows)
      workspaceByAnchorCommitId.delete(commit.id)
    }
  }

  for (const anchoredRows of workspaceByAnchorCommitId.values()) {
    rows.push(...anchoredRows)
  }

  return { rows, laneIndexByBranchId }
}

function ComparePills({
  isBase,
  isTarget,
  canPickCompare,
  onPick,
}: {
  isBase: boolean
  isTarget: boolean
  canPickCompare: boolean
  onPick: () => void
}) {
  return (
    <div className="flex items-center gap-1">
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
          onClick={(event) => {
            event.stopPropagation()
            onPick()
          }}
          className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold text-slate-600 hover:border-slate-300 hover:bg-slate-50"
        >
          비교
        </button>
      ) : null}
    </div>
  )
}

function CommitHoverTooltip({ commit }: { commit: Commit }) {
  return (
    <div className="pointer-events-none absolute left-0 top-full z-20 mt-2 hidden w-[280px] rounded-2xl border border-slate-200 bg-white px-3 py-3 text-left shadow-[0_18px_40px_rgba(15,23,42,0.18)] group-hover:block">
      <div className="text-sm font-semibold text-slate-900">{commit.title}</div>
      {commit.description ? (
        <div className="mt-1 text-xs leading-5 text-slate-500">{commit.description}</div>
      ) : null}
      <div className="mt-2 flex items-center gap-1 text-[11px] text-slate-400">
        <Clock3 className="h-3 w-3" />
        {formatDateLabel(commit.createdAt)}
      </div>
    </div>
  )
}

export default function WorkingSaveDemoGraph({
  data,
  currentCommitId,
  currentWorkspaceId,
  currentBranchId,
  mainBranch,
  compareBaseCommitId,
  compareTargetCommitId,
  compareBaseWorkspaceId,
  compareTargetWorkspaceId,
  onCommitOpen,
  onWorkspaceOpen,
  onCompareTargetPick,
  onBranchSelect,
  onBranchDelete,
}: WorkingSaveDemoGraphProps) {
  const { rows, laneIndexByBranchId } = useMemo(
    () =>
      buildRows(
        data,
        currentCommitId,
        currentWorkspaceId,
        compareBaseCommitId,
        compareTargetCommitId,
        compareBaseWorkspaceId,
        compareTargetWorkspaceId,
      ),
    [
      data,
      currentCommitId,
      currentWorkspaceId,
      compareBaseCommitId,
      compareTargetCommitId,
      compareBaseWorkspaceId,
      compareTargetWorkspaceId,
    ],
  )

  const laneCount = Math.max(data.branches.length, 1)
  const graphWidth = LANE_START_X + (laneCount - 1) * LANE_GAP + GRAPH_PADDING_RIGHT
  const graphHeight = Math.max(rows.length * ROW_HEIGHT, ROW_HEIGHT)

  const rowIndexByKey = useMemo(
    () => new Map(rows.map((row, index) => [row.key, index])),
    [rows],
  )

  const edgePaths = useMemo<EdgePath[]>(() => {
    const branchRowGroups = new Map<number, TimelineRow[]>()

    for (const row of rows) {
      const branchRows = branchRowGroups.get(row.branch.id) ?? []
      branchRows.push(row)
      branchRowGroups.set(row.branch.id, branchRows)
    }

    const paths: EdgePath[] = []

    for (const [branchId, branchRows] of branchRowGroups.entries()) {
      for (let index = 0; index < branchRows.length - 1; index += 1) {
        const fromRow = branchRows[index]
        const toRow = branchRows[index + 1]
        const x = LANE_START_X + fromRow.laneIndex * LANE_GAP
        const fromY = rowIndexByKey.get(fromRow.key)! * ROW_HEIGHT + ROW_HEIGHT / 2
        const toY = rowIndexByKey.get(toRow.key)! * ROW_HEIGHT + ROW_HEIGHT / 2

        paths.push({
          key: `flow-${branchId}-${index}`,
          d: `M ${x} ${fromY} L ${x} ${toY}`,
          color: fromRow.color,
          dashed: fromRow.kind === "workspace",
        })
      }

    }

    for (const row of rows) {
      const branchRootSourceCommitId =
        row.kind === "commit"
          ? row.isBranchRoot
            ? row.fromCommitId
            : null
          : row.branch.fromCommitId && row.branch.leafCommitId === 0
            ? row.branch.fromCommitId
            : null

      if (!branchRootSourceCommitId) continue

      const parentRowIndex = rowIndexByKey.get(`commit-${branchRootSourceCommitId}`)
      const childRowIndex = rowIndexByKey.get(row.key)
      const parentLaneIndex = laneIndexByBranchId.get(
        data.commits.find((commit) => commit.id === branchRootSourceCommitId)?.branchId ?? 0,
      )

      if (
        parentRowIndex === undefined ||
        childRowIndex === undefined ||
        parentLaneIndex === undefined
      ) {
        continue
      }

      const childX = LANE_START_X + row.laneIndex * LANE_GAP
      const parentX = LANE_START_X + parentLaneIndex * LANE_GAP
      const childY = childRowIndex * ROW_HEIGHT + ROW_HEIGHT / 2
      const parentY = parentRowIndex * ROW_HEIGHT + ROW_HEIGHT / 2
      const midY = childY + (parentY - childY) * 0.55

      paths.push({
        key: `fork-${row.key}`,
        d: `M ${childX} ${childY} C ${childX} ${midY}, ${parentX} ${midY}, ${parentX} ${parentY}`,
        color: row.color,
        dashed: row.kind === "workspace",
      })
    }

    return paths
  }, [data.commits, laneIndexByBranchId, rowIndexByKey, rows])

  const branchMeta = useMemo(() => {
    return data.branches.map((branch) => ({
      branch,
      color: getBranchColor(branch.name),
      isCurrent: branch.id === currentBranchId,
    }))
  }, [data.branches, currentBranchId])

  const compareGuideVisible = Boolean(compareBaseCommitId || compareBaseWorkspaceId)

  return (
    <div className="flex h-full w-full flex-col overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 bg-white px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          {branchMeta.map(({ branch, color, isCurrent }) => (
            <div
              key={branch.id}
              className={`inline-flex items-center rounded-full border text-xs font-medium transition ${
                isCurrent
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-white"
              }`}
            >
              <button
                type="button"
                onClick={() => onBranchSelect(branch.id)}
                className="inline-flex items-center gap-2 px-3 py-1.5"
              >
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: isCurrent ? "#ffffff" : color }}
                />
                {branch.name}
              </button>
              {branch.id !== mainBranch.id ? (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation()
                    onBranchDelete(branch.id)
                  }}
                  aria-label={`${branch.name} 브랜치 삭제`}
                  className={`mr-1 inline-flex h-5 w-5 items-center justify-center rounded-full transition ${
                    isCurrent
                      ? "text-white/80 hover:bg-white/15 hover:text-white"
                      : "text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                  }`}
                >
                  <X className="h-3 w-3" />
                </button>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      {compareGuideVisible ? (
        <div className="border-b border-emerald-100 bg-emerald-50 px-4 py-2 text-xs font-medium text-emerald-700">
          기준 버전을 고른 상태입니다.
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-auto bg-[#fbfcfe]">
        <div className="relative min-h-full min-w-0">
          <svg
            className="pointer-events-none absolute left-0 top-0"
            width={graphWidth}
            height={graphHeight}
            viewBox={`0 0 ${graphWidth} ${graphHeight}`}
            fill="none"
          >
            {edgePaths.map((path) => (
              <path
                key={path.key}
                d={path.d}
                stroke={path.color}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeDasharray={path.dashed ? "6 6" : undefined}
                opacity={0.95}
              />
            ))}
          </svg>

          <div className="relative">
            {rows.map((row, index) => {
              const nodeX = LANE_START_X + row.laneIndex * LANE_GAP
              const contentOffset = graphWidth + row.laneIndex * 16
              const rowBaseClass = row.isCurrent
                ? "bg-amber-50/90"
                : "hover:bg-slate-50/90"

              if (row.kind === "workspace") {
                return (
                  <div
                    key={row.key}
                    className={`relative flex items-center border-b border-slate-100/90 ${rowBaseClass}`}
                    style={{ height: ROW_HEIGHT }}
                  >
                    <div
                      className="absolute top-1/2 z-10 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] bg-white shadow-sm"
                      style={{
                        left: nodeX,
                        borderColor: row.color,
                        borderStyle: "dashed",
                      }}
                    />

                    <div style={{ width: contentOffset }} />

                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => onWorkspaceOpen(row.saveId)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault()
                          onWorkspaceOpen(row.saveId)
                        }
                      }}
                      className="flex min-w-0 flex-1 items-center justify-between gap-3 pr-4"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-slate-900">
                            편집중
                          </span>
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        <ComparePills
                          isBase={row.isBase}
                          isTarget={row.isTarget}
                          canPickCompare={row.canPickCompare}
                          onPick={() => onCompareTargetPick("workspace", row.saveId)}
                        />
                      </div>
                    </div>
                  </div>
                )
              }

              return (
                <div
                  key={row.key}
                  className={`relative flex items-center border-b border-slate-100/90 ${rowBaseClass}`}
                  style={{ height: ROW_HEIGHT }}
                >
                <div
                  className={`absolute top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 shadow-sm ${
                    row.isBranchRoot ? "h-4.5 w-4.5 ring-4 ring-white" : "h-3.5 w-3.5"
                  }`}
                  style={{
                      left: nodeX,
                      borderColor: row.color,
                      backgroundColor: row.color,
                    }}
                  />

                  <div style={{ width: contentOffset }} />

                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => onCommitOpen(row.branch.id, row.commit.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault()
                        onCommitOpen(row.branch.id, row.commit.id)
                      }
                    }}
                    className="group relative flex min-w-0 flex-1 items-center justify-between gap-3 pr-4"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-semibold text-slate-900">
                          {row.commit.title}
                        </span>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-3">
                      <ComparePills
                        isBase={row.isBase}
                        isTarget={row.isTarget}
                        canPickCompare={row.canPickCompare}
                        onPick={() => onCompareTargetPick("commit", row.commit.id)}
                      />
                    </div>

                    <CommitHoverTooltip commit={row.commit} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
