import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { OutputData } from "@editorjs/editorjs"
import {
  GitCommitHorizontal,
  GitCompareArrows,
  GitMerge,
  Play,
  Trash2,
  X,
} from "lucide-react"
import { useNavigate, useParams, useSearchParams } from "react-router"
import ResizableLayout from "@/layouts/ResizableLayout"
import DocumentGraph from "@/components/DocumentGraph"
import DocumentCompareView from "@/components/DocumentCompareView"
import DocumentEditor from "@/components/DocumentEditor"
import DocumentMergeView from "@/components/DocumentMergeView"
import BranchEditModal from "@/components/BranchEditModal"
import SaveCommitModal from "@/components/SaveCommitModal"
import { Button } from "@/components/ui/button"
import { apiClient } from "@/api/apiClient"
import { useGraphData } from "@/hooks/useGraphData"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { alertDialog } from "@/lib/utils"
import type { GraphDataType } from "@/types/graph"
import type { CommitNodeMenuType } from "@/components/CommitNode"
import type { TempNodeMenuType } from "@/components/TempNode"
import {
  editorDataToMarkdown,
  markdownToEditorData,
} from "@/lib/editorMarkdown"

type SnapshotBlock = { [key: string]: any }

type BranchRecord = {
  id: number
  name: string
  fromCommitId: number | null
  rootCommitId: number
  headCommitId: number | null
  saveId: number | null
}

type CommitRecord = {
  id: number
  branchId: number
  title: string
  description: string
  content: string
  blocks: SnapshotBlock[]
  createdAt: string
  kind: "commit" | "merge"
  loaded: boolean
}

type WorkspaceRecord = {
  id: number
  branchId: number
  content: string
  blocks: SnapshotBlock[]
  loaded: boolean
}

type CompareItemKind = "commit" | "workspace"

type ViewState =
  | { mode: "workspace"; branchId: number; workspaceId: number }
  | { mode: "commit"; branchId: number; commitId: number }
  | {
      mode: "compare"
      branchId: number
      baseKind: CompareItemKind
      baseId: number
      compareKind: CompareItemKind | null
      compareId: number | null
    }
  | {
      mode: "merge"
      branchId: number
      sourceKind: CompareItemKind
      sourceId: number
      targetKind: CompareItemKind | null
      targetId: number | null
    }

type SyncStatus = "idle" | "syncing" | "synced"

type BranchEditState = {
  commitId: number
  isLastCommit: boolean
  currentBranchName: string
} | null

type DeleteDialogState =
  | { type: "commit"; commitId: number }
  | { type: "branch"; branchId: number }
  | null

function createOutputData(blocks: SnapshotBlock[] | null | undefined): OutputData {
  return {
    time: Date.now(),
    version: "2.30.8",
    blocks: Array.isArray(blocks) ? blocks : [],
  }
}

function createBlocksFromMarkdown(markdown: string) {
  return (markdownToEditorData(markdown).blocks ?? []) as SnapshotBlock[]
}

function createSnapshot(markdown: string) {
  const blocks = createBlocksFromMarkdown(markdown)
  return { content: markdown, blocks }
}

const demoInitialDraft = createSnapshot(
  "프로젝트 소개\n이 문서는 팀이 문서 편집 흐름을 점검하기 위한 초기 초안이며, 문서 저장과 기록 생성의 경계를 차분하게 정리하는 데 목적이 있습니다.\n\n현재 범위\n- 문서 저장 흐름을 먼저 점검하고, 기록 생성 시점은 나중에 세밀하게 조정합니다.\n- 협업 기능은 제외하고, 단일 사용자가 문서를 안정적으로 다루는 경험에 집중합니다.",
)

const demoMainHead = createSnapshot(
  "프로젝트 소개\n이 문서는 팀이 문서 편집 흐름을 점검하기 위한 메인 초안이며, 문서 저장과 기록 생성의 경계를 안정적으로 정리하는 데 목적이 있습니다.\n\n현재 범위\n- 문서 저장 흐름에 Outbox 패턴을 우선 적용하고, 기록 생성 시점은 나중에 세밀하게 조정합니다.\n- 협업 기능은 제외하고, 단일 사용자가 문서를 안정적으로 다루는 경험에 집중합니다.",
)

const demoForkPoint = createSnapshot(
  "프로젝트 소개\n이 문서는 팀이 문서 편집 흐름을 점검하기 위한 브랜치 초안이며, 문서 저장과 기록 생성의 경계를 빠르게 정리하는 데 목적이 있습니다.\n\n현재 범위\n- 문서 저장 흐름을 먼저 확인하고, 기록 생성 시점은 조금 더 빠르게 드러나도록 구성합니다.\n- 협업 기능은 제외하고, 단일 사용자가 문서를 유연하게 다루는 경험에 집중합니다.",
)

const demoReleaseHead = createSnapshot(
  "프로젝트 소개\n이 문서는 팀이 문서 편집 흐름을 점검하기 위한 브랜치 초안이며, 문서 저장과 기록 생성의 경계를 선명하게 정리하는 데 목적이 있습니다.\n\n현재 범위\n- 문서 저장 흐름을 먼저 확인하고, 기록 생성 시점은 조금 더 빠르게 드러나도록 구성합니다.\n- 협업 기능은 제외하고, 단일 사용자가 문서를 유연하게 다루는 경험에 집중합니다.",
)

const demoMainWorkspace = createSnapshot(
  "프로젝트 소개\n이 문서는 팀이 문서 편집 흐름을 점검하기 위한 메인 초안이며, 문서 저장과 기록 생성의 경계를 안정적으로 정리하는 데 목적이 있습니다.\n\n현재 범위\n- 문서 저장 흐름에 Outbox 패턴을 우선 적용하고, 기록 생성 시점은 나중에 세밀하게 조정합니다.\n- 협업 기능은 제외하고, 단일 사용자가 문서를 안정적으로 다루는 경험에 집중합니다.\n- 현재 main branch에서 설명 문장을 조금 더 자연스럽게 다듬는 중입니다.",
)

const demoReleaseWorkspace = createSnapshot(
  "프로젝트 소개\n이 문서는 팀이 문서 편집 흐름을 점검하기 위한 브랜치 초안이며, 문서 저장과 기록 생성의 경계를 선명하게 정리하는 데 목적이 있습니다.\n\n현재 범위\n- 문서 저장 흐름을 먼저 확인하고, 기록 생성 시점은 조금 더 빠르게 드러나도록 구성합니다.\n- 협업 기능은 제외하고, 단일 사용자가 문서를 유연하게 다루는 경험에 집중합니다.\n- 현재 release-copy branch에서 리뷰용 표현을 조금 더 또렷하게 다듬는 중입니다.",
)

const initialBranches: BranchRecord[] = [
  {
    id: 1,
    name: "main",
    fromCommitId: null,
    rootCommitId: 1,
    headCommitId: 2,
    saveId: 1,
  },
  {
    id: 2,
    name: "release-copy",
    fromCommitId: 1,
    rootCommitId: 3,
    headCommitId: 4,
    saveId: 2,
  },
]

const initialCommits: CommitRecord[] = [
  {
    id: 1,
    branchId: 1,
    title: "Initial draft",
    description: "문서 구조 초안",
    ...demoInitialDraft,
    createdAt: "2026-04-05T09:00:00+09:00",
    kind: "commit",
    loaded: true,
  },
  {
    id: 2,
    branchId: 1,
    title: "Main head",
    description: "Outbox 적용 반영",
    ...demoMainHead,
    createdAt: "2026-04-05T09:30:00+09:00",
    kind: "commit",
    loaded: true,
  },
  {
    id: 3,
    branchId: 2,
    title: "Fork point work",
    description: "실험 브랜치 시작점",
    ...demoForkPoint,
    createdAt: "2026-04-05T10:00:00+09:00",
    kind: "commit",
    loaded: true,
  },
  {
    id: 4,
    branchId: 2,
    title: "Release copy head",
    description: "리뷰 전 working snapshot",
    ...demoReleaseHead,
    createdAt: "2026-04-05T10:30:00+09:00",
    kind: "commit",
    loaded: true,
  },
]

const initialWorkspaces: WorkspaceRecord[] = [
  {
    id: 1,
    branchId: 1,
    ...demoMainWorkspace,
    loaded: true,
  },
  {
    id: 2,
    branchId: 2,
    ...demoReleaseWorkspace,
    loaded: true,
  },
]

function getNextId(list: Array<{ id: number }>) {
  return Math.max(...list.map((item) => item.id), 0) + 1
}

function buildGraphData(
  branches: BranchRecord[],
  commits: CommitRecord[],
): GraphDataType {
  return {
    title: "문서 작업 흐름",
    commits: commits.map((commit) => ({
      id: commit.id,
      branchId: commit.branchId,
      title: commit.title,
      description: commit.description,
      createdAt: commit.createdAt,
    })),
    edges: commits.flatMap((commit) => {
      const branchCommits = commits
        .filter((candidate) => candidate.branchId === commit.branchId)
        .sort((a, b) => a.id - b.id)
      const index = branchCommits.findIndex(
        (candidate) => candidate.id === commit.id,
      )
      const previous = index > 0 ? branchCommits[index - 1] : null

      if (previous) {
        return [{ from: previous.id, to: commit.id }]
      }

      const branch = branches.find(
        (candidate) => candidate.id === commit.branchId,
      )
      if (branch?.fromCommitId) {
        return [{ from: branch.fromCommitId, to: commit.id }]
      }

      return []
    }),
    branches: branches.map((branch) => ({
      id: branch.id,
      name: branch.name,
      createdAt: "2026-04-05T09:00:00+09:00",
      fromCommitId: branch.fromCommitId,
      rootCommitId: branch.rootCommitId,
      leafCommitId: branch.headCommitId ?? 0,
      saveId: branch.saveId ?? null,
    })),
  }
}

function blocksToMarkdown(blocks: SnapshotBlock[] | null | undefined) {
  return editorDataToMarkdown(createOutputData(blocks))
}

function createCommitRecord(
  commit: GraphDataType["commits"][number],
  existing?: CommitRecord,
): CommitRecord {
  return {
    id: commit.id,
    branchId: commit.branchId,
    title: commit.title,
    description: commit.description,
    createdAt: commit.createdAt,
    kind: existing?.kind ?? "commit",
    content: existing?.content ?? "",
    blocks: existing?.blocks ?? [],
    loaded: existing?.loaded ?? false,
  }
}

function createWorkspaceRecord(
  branch: BranchRecord,
  existing?: WorkspaceRecord,
): WorkspaceRecord {
  return {
    id: Number(branch.saveId),
    branchId: branch.id,
    content: existing?.content ?? "",
    blocks: existing?.blocks ?? [],
    loaded: existing?.loaded ?? false,
  }
}

function resolveViewFromParams(
  params: URLSearchParams,
  branches: BranchRecord[],
  commits: CommitRecord[],
  workspaces: WorkspaceRecord[],
): ViewState {
  const mode = params.get("mode")
  const saveId = Number(params.get("saveId") || 0)
  const commitId = Number(params.get("commitId") || 0)

  if (mode === "save" && saveId) {
    const workspace = workspaces.find((item) => item.id === saveId)
    if (workspace) {
      return {
        mode: "workspace",
        branchId: workspace.branchId,
        workspaceId: workspace.id,
      }
    }
  }

  if (mode === "commit" && commitId) {
    const commit = commits.find((item) => item.id === commitId)
    if (commit) {
      return {
        mode: "commit",
        branchId: commit.branchId,
        commitId: commit.id,
      }
    }
  }

  const mainBranch =
    branches.find((branch) => branch.name === "main") ?? branches[0] ?? null
  const mainWorkspace = mainBranch
    ? workspaces.find((item) => item.branchId === mainBranch.id)
    : null

  if (mainWorkspace) {
    return {
      mode: "workspace",
      branchId: mainWorkspace.branchId,
      workspaceId: mainWorkspace.id,
    }
  }

  const firstCommit = mainBranch
    ? commits.find((item) => item.id === mainBranch.headCommitId)
    : commits[0] ?? null

  if (firstCommit) {
    return {
      mode: "commit",
      branchId: firstCommit.branchId,
      commitId: firstCommit.id,
    }
  }

  return {
    mode: "workspace",
    branchId: 1,
    workspaceId: 1,
  }
}

function isSameView(a: ViewState, b: ViewState) {
  if (a.mode !== b.mode) return false

  if (a.mode === "workspace" && b.mode === "workspace") {
    return a.branchId === b.branchId && a.workspaceId === b.workspaceId
  }

  if (a.mode === "commit" && b.mode === "commit") {
    return a.branchId === b.branchId && a.commitId === b.commitId
  }

  if (a.mode === "compare" && b.mode === "compare") {
    return (
      a.branchId === b.branchId &&
      a.baseKind === b.baseKind &&
      a.baseId === b.baseId &&
      a.compareKind === b.compareKind &&
      a.compareId === b.compareId
    )
  }

  if (a.mode === "merge" && b.mode === "merge") {
    return (
      a.branchId === b.branchId &&
      a.sourceKind === b.sourceKind &&
      a.sourceId === b.sourceId &&
      a.targetKind === b.targetKind &&
      a.targetId === b.targetId
    )
  }

  return false
}

export default function DocumentWorkspacePage({
  demoMode = false,
}: {
  demoMode?: boolean
}) {
  const navigate = useNavigate()
  const { id: documentIdParam } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const queryDocumentId = Number(documentIdParam || 0)
  const isRealDocument = Number.isFinite(queryDocumentId) && queryDocumentId > 0
  const documentId = isRealDocument ? queryDocumentId : 0

  const [branches, setBranches] = useState<BranchRecord[]>(
    demoMode ? initialBranches : [],
  )
  const [commits, setCommits] = useState<CommitRecord[]>(
    demoMode ? initialCommits : [],
  )
  const [workspaces, setWorkspaces] = useState<WorkspaceRecord[]>(
    demoMode ? initialWorkspaces : [],
  )
  const [view, setView] = useState<ViewState>(
    demoMode
      ? {
          mode: "workspace",
          branchId: 1,
          workspaceId: 1,
        }
      : {
          mode: "workspace",
          branchId: 0,
          workspaceId: 0,
        },
  )
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("synced")
  const [toast, setToast] = useState("main 작업장에서 문서를 편집 중입니다.")
  const [branchEditState, setBranchEditState] = useState<BranchEditState>(null)
  const [deleteDialog, setDeleteDialog] = useState<DeleteDialogState>(null)
  const [isCommitModalOpen, setIsCommitModalOpen] = useState(false)
  const [isHydrating, setIsHydrating] = useState(false)
  const [isActionPending, setIsActionPending] = useState(false)
  const [hasBootstrapped, setHasBootstrapped] = useState(demoMode)
  const syncTimerRef = useRef<number | null>(null)
  const loadingCommitIdsRef = useRef<Set<number>>(new Set())
  const loadingWorkspaceIdsRef = useRef<Set<number>>(new Set())
  const commitsRef = useRef<CommitRecord[]>(demoMode ? initialCommits : [])
  const workspacesRef = useRef<WorkspaceRecord[]>(demoMode ? initialWorkspaces : [])
  const previousDocumentIdRef = useRef<number | null>(null)

  const graphQuery = useGraphData({ documentId })

  useEffect(() => {
    commitsRef.current = commits
  }, [commits])

  useEffect(() => {
    workspacesRef.current = workspaces
  }, [workspaces])

  const pushViewToUrl = useCallback(
    (nextView: ViewState, replace = false) => {
      if (demoMode || !isRealDocument) return

      if (nextView.mode === "workspace") {
        setSearchParams(
          {
            mode: "save",
            saveId: String(nextView.workspaceId),
          },
          { replace },
        )
        return
      }

      if (nextView.mode === "commit") {
        setSearchParams(
          {
            mode: "commit",
            commitId: String(nextView.commitId),
          },
          { replace },
        )
      }
    },
    [demoMode, isRealDocument, setSearchParams],
  )

  const hydrateFromGraph = useCallback(
    async (
      sourceGraphData: GraphDataType,
      params: URLSearchParams,
      syncUrl = false,
    ) => {
      if (demoMode || !isRealDocument) return

      setIsHydrating(true)

      try {
        const nextBranches: BranchRecord[] = sourceGraphData.branches.map((branch) => ({
          id: branch.id,
          name: branch.name,
          fromCommitId: branch.fromCommitId,
          rootCommitId: branch.rootCommitId,
          headCommitId: branch.leafCommitId || null,
          saveId: branch.saveId ?? null,
        }))

        const nextCommitResponses = sourceGraphData.commits.map((commit) =>
          createCommitRecord(
            commit,
            commitsRef.current.find((item) => item.id === commit.id),
          ),
        )
        const nextWorkspaceResponses = nextBranches
          .filter((branch) => branch.saveId)
          .map((branch) =>
            createWorkspaceRecord(
              branch,
              workspacesRef.current.find((item) => item.id === branch.saveId),
            ),
          )

        setBranches(nextBranches)
        setCommits(nextCommitResponses)
        setWorkspaces(nextWorkspaceResponses)

        const nextView = resolveViewFromParams(
          params,
          nextBranches,
          nextCommitResponses,
          nextWorkspaceResponses,
        )
        setView((prev) => (isSameView(prev, nextView) ? prev : nextView))
        setHasBootstrapped(true)

        if (syncUrl) {
          const currentMode = params.get("mode")
          const currentSaveId = params.get("saveId")
          const currentCommitId = params.get("commitId")
          const shouldSyncUrl =
            (nextView.mode === "workspace" &&
              (currentMode !== "save" ||
                currentSaveId !== String(nextView.workspaceId))) ||
            (nextView.mode === "commit" &&
              (currentMode !== "commit" ||
                currentCommitId !== String(nextView.commitId)))

          if (shouldSyncUrl) {
            pushViewToUrl(nextView, true)
          }
        }
      } finally {
        setIsHydrating(false)
      }
    },
    [demoMode, isRealDocument, pushViewToUrl],
  )

  const refreshDocumentState = useCallback(
    async (params?: URLSearchParams, syncUrl = true) => {
      if (demoMode || !isRealDocument) return

      const response = await graphQuery.refetch()
      if (response.data) {
        await hydrateFromGraph(response.data, params ?? searchParams, syncUrl)
      }
    },
    [demoMode, graphQuery, hydrateFromGraph, isRealDocument, searchParams],
  )

  useEffect(() => {
    if (demoMode || !isRealDocument) return
    if (!graphQuery.data) return

    void hydrateFromGraph(graphQuery.data, searchParams, true)
  }, [demoMode, graphQuery.data, hydrateFromGraph, isRealDocument])

  useEffect(() => {
    if (demoMode || !isRealDocument) return
    if (!branches.length) return

    const nextView = resolveViewFromParams(searchParams, branches, commits, workspaces)
    setView((prev) => (isSameView(prev, nextView) ? prev : nextView))
  }, [branches, commits, demoMode, isRealDocument, searchParams, workspaces])

  const loadCommitContent = useCallback(
    async (commitId: number) => {
      if (demoMode || !isRealDocument || !commitId) return

      const existing = commitsRef.current.find((item) => item.id === commitId)
      if (existing?.loaded || loadingCommitIdsRef.current.has(commitId)) return

      loadingCommitIdsRef.current.add(commitId)

      try {
        const response = await apiClient.commit.getCommit({
          docId: documentId,
          commitId,
        })
        const nextBlocks = (response.content ?? []) as SnapshotBlock[]

        setCommits((prev) =>
          prev.map((commit) =>
            commit.id === commitId
              ? {
                  ...commit,
                  blocks: nextBlocks,
                  content: blocksToMarkdown(nextBlocks),
                  loaded: true,
                }
              : commit,
          ),
        )
      } finally {
        loadingCommitIdsRef.current.delete(commitId)
      }
    },
    [demoMode, documentId, isRealDocument],
  )

  const loadWorkspaceContent = useCallback(
    async (workspaceId: number) => {
      if (demoMode || !isRealDocument || !workspaceId) return

      const existing = workspacesRef.current.find((item) => item.id === workspaceId)
      if (existing?.loaded || loadingWorkspaceIdsRef.current.has(workspaceId)) return

      loadingWorkspaceIdsRef.current.add(workspaceId)

      try {
        const response = await apiClient.save.getSave({
          docId: documentId,
          saveId: workspaceId,
        })
        const nextBlocks = (response.content ?? []) as SnapshotBlock[]

        setWorkspaces((prev) =>
          prev.map((workspace) =>
            workspace.id === workspaceId
              ? {
                  ...workspace,
                  blocks: nextBlocks,
                  content: blocksToMarkdown(nextBlocks),
                  loaded: true,
                }
              : workspace,
          ),
        )
      } finally {
        loadingWorkspaceIdsRef.current.delete(workspaceId)
      }
    },
    [demoMode, documentId, isRealDocument],
  )

  useEffect(() => {
    if (demoMode || !isRealDocument) return

    const commitIdsToLoad = new Set<number>()
    const workspaceIdsToLoad = new Set<number>()

    if (view.mode === "workspace" && view.workspaceId) {
      workspaceIdsToLoad.add(view.workspaceId)
    }

    if (view.mode === "commit" && view.commitId) {
      commitIdsToLoad.add(view.commitId)
    }

    if (view.mode === "compare") {
      if (view.baseKind === "commit") {
        commitIdsToLoad.add(view.baseId)
      } else {
        workspaceIdsToLoad.add(view.baseId)
      }

      if (view.compareKind === "commit" && view.compareId) {
        commitIdsToLoad.add(view.compareId)
      } else if (view.compareKind === "workspace" && view.compareId) {
        workspaceIdsToLoad.add(view.compareId)
      }
    }

    if (view.mode === "merge") {
      if (view.sourceKind === "commit") {
        commitIdsToLoad.add(view.sourceId)
      } else {
        workspaceIdsToLoad.add(view.sourceId)
      }

      if (view.targetKind === "commit" && view.targetId) {
        commitIdsToLoad.add(view.targetId)
      } else if (view.targetKind === "workspace" && view.targetId) {
        workspaceIdsToLoad.add(view.targetId)
      }
    }

    commitIdsToLoad.forEach((commitId) => {
      void loadCommitContent(commitId)
    })
    workspaceIdsToLoad.forEach((workspaceId) => {
      void loadWorkspaceContent(workspaceId)
    })
  }, [
    demoMode,
    isRealDocument,
    loadCommitContent,
    loadWorkspaceContent,
    view,
  ])

  useEffect(() => {
    const previousDocumentId = previousDocumentIdRef.current
    previousDocumentIdRef.current = documentId

    if (previousDocumentId === null) {
      return
    }

    if (previousDocumentId !== documentId) {
      setHasBootstrapped(demoMode)
      if (!demoMode) {
        setBranches([])
        setCommits([])
        setWorkspaces([])
      }
    }
  }, [demoMode, documentId])

  useEffect(() => {
    return () => {
      if (syncTimerRef.current) {
        window.clearTimeout(syncTimerRef.current)
      }
    }
  }, [])

  const graphData = useMemo(
    () => buildGraphData(branches, commits),
    [branches, commits],
  )

  const mainBranch = useMemo(() => {
    return (
      graphData.branches.find((branch) => branch.name === "main") ??
      graphData.branches[0] ??
      null
    )
  }, [graphData.branches])

  const currentBranch = useMemo(() => {
    return branches.find((branch) => branch.id === view.branchId) ?? null
  }, [branches, view.branchId])

  const currentWorkspace = useMemo(() => {
    if (view.mode !== "workspace") return null
    return (
      workspaces.find((workspace) => workspace.id === view.workspaceId) ?? null
    )
  }, [view, workspaces])

  const currentCommit = useMemo(() => {
    if (view.mode !== "commit") return null
    return commits.find((commit) => commit.id === view.commitId) ?? null
  }, [commits, view])

  const compareBaseItem = useMemo(() => {
    if (view.mode !== "compare") return null
    if (view.baseKind === "commit") {
      const commit = commits.find((item) => item.id === view.baseId)
      if (!commit) return null
      const branch = branches.find((item) => item.id === commit.branchId)
      return {
        kind: "commit" as const,
        id: commit.id,
        branchId: commit.branchId,
        title: commit.title,
        subtitle: branch ? `${branch.name} 기록` : "기록",
        content: commit.content,
        blocks: commit.blocks,
        loaded: commit.loaded,
      }
    }

    const workspace = workspaces.find((item) => item.id === view.baseId)
    if (!workspace) return null
    const branch = branches.find((item) => item.id === workspace.branchId)
    return {
      kind: "workspace" as const,
      id: workspace.id,
      branchId: workspace.branchId,
      title: branch ? `${branch.name} 작업장` : "작업장",
      subtitle: "현재 편집 상태",
      content: workspace.content,
      blocks: workspace.blocks,
      loaded: workspace.loaded,
    }
  }, [branches, commits, view, workspaces])

  const compareTargetItem = useMemo(() => {
    if (view.mode !== "compare" || !view.compareId || !view.compareKind) return null
    if (view.compareKind === "commit") {
      const commit = commits.find((item) => item.id === view.compareId)
      if (!commit) return null
      const branch = branches.find((item) => item.id === commit.branchId)
      return {
        kind: "commit" as const,
        id: commit.id,
        branchId: commit.branchId,
        title: commit.title,
        subtitle: branch ? `${branch.name} 기록` : "기록",
        content: commit.content,
        blocks: commit.blocks,
        loaded: commit.loaded,
      }
    }

    const workspace = workspaces.find((item) => item.id === view.compareId)
    if (!workspace) return null
    const branch = branches.find((item) => item.id === workspace.branchId)
    return {
      kind: "workspace" as const,
      id: workspace.id,
      branchId: workspace.branchId,
      title: branch ? `${branch.name} 작업장` : "작업장",
      subtitle: "현재 편집 상태",
      content: workspace.content,
      blocks: workspace.blocks,
      loaded: workspace.loaded,
    }
  }, [branches, commits, view, workspaces])

  const mainWorkspace = useMemo(() => {
    if (!mainBranch) return null
    return workspaces.find((workspace) => workspace.branchId === mainBranch.id) ?? null
  }, [workspaces, mainBranch])

  const mergeSourceItem = useMemo(() => {
    if (view.mode !== "merge") return null

    if (view.sourceKind === "commit") {
      const commit = commits.find((item) => item.id === view.sourceId)
      if (!commit) return null
      const branch = branches.find((item) => item.id === commit.branchId)
      return {
        kind: "commit" as const,
        id: commit.id,
        branchId: commit.branchId,
        title: commit.title,
        subtitle: branch ? `${branch.name} 기록` : "기록",
        content: commit.content,
        blocks: commit.blocks,
        loaded: commit.loaded,
      }
    }

    const workspace = workspaces.find((item) => item.id === view.sourceId)
    if (!workspace) return null
    const branch = branches.find((item) => item.id === workspace.branchId)
    return {
      kind: "workspace" as const,
      id: workspace.id,
      branchId: workspace.branchId,
      title: branch ? `${branch.name} 작업장` : "작업장",
      subtitle: "현재 편집 상태",
      content: workspace.content,
      blocks: workspace.blocks,
      loaded: workspace.loaded,
    }
  }, [branches, commits, view, workspaces])

  const mergeTargetItem = useMemo(() => {
    if (view.mode !== "merge" || !view.targetId || !view.targetKind) return null

    if (view.targetKind === "commit") {
      const commit = commits.find((item) => item.id === view.targetId)
      if (!commit) return null
      const branch = branches.find((item) => item.id === commit.branchId)
      return {
        kind: "commit" as const,
        id: commit.id,
        branchId: commit.branchId,
        title: commit.title,
        subtitle: branch ? `${branch.name} 기록` : "기록",
        content: commit.content,
        blocks: commit.blocks,
        loaded: commit.loaded,
      }
    }

    const workspace = workspaces.find((item) => item.id === view.targetId)
    if (!workspace) return null
    const branch = branches.find((item) => item.id === workspace.branchId)
    return {
      kind: "workspace" as const,
      id: workspace.id,
      branchId: workspace.branchId,
      title: branch ? `${branch.name} 작업장` : "작업장",
      subtitle: "현재 편집 상태",
      content: workspace.content,
      blocks: workspace.blocks,
      loaded: workspace.loaded,
    }
  }, [branches, commits, view, workspaces])

  const mergeSourceData = useMemo(() => {
    return mergeSourceItem ? createOutputData(mergeSourceItem.blocks) : null
  }, [mergeSourceItem])

  const mergeTargetData = useMemo(() => {
    return mergeTargetItem ? createOutputData(mergeTargetItem.blocks) : null
  }, [mergeTargetItem])

  const currentBranchCommits = useMemo(() => {
    if (!currentBranch) return []
    return commits
      .filter((commit) => commit.branchId === currentBranch.id)
      .sort((a, b) => a.id - b.id)
  }, [commits, currentBranch])

  const canDeleteCurrentCommit = Boolean(
    view.mode === "commit" &&
      currentCommit &&
      currentBranch &&
      currentBranch.headCommitId === currentCommit.id &&
      currentBranch.rootCommitId !== currentCommit.id,
  )

  const openWorkspaceByBranch = useCallback(
    (branchId: number) => {
      const branch = branches.find((item) => item.id === branchId)
      if (!branch?.saveId) return

      const nextView: ViewState = {
        mode: "workspace",
        branchId,
        workspaceId: branch.saveId,
      }
      setView(nextView)
      pushViewToUrl(nextView)
    },
    [branches, pushViewToUrl],
  )

  const openCommit = useCallback(
    (branchId: number, commitId: number) => {
      const targetCommit = commits.find((item) => item.id === commitId)
      const nextView: ViewState = { mode: "commit", branchId, commitId }
      setView(nextView)
      pushViewToUrl(nextView)
      setToast(`기록 '${targetCommit?.title ?? commitId}' 화면을 열었습니다.`)
    },
    [commits, pushViewToUrl],
  )

  const handleWorkspaceChange = useCallback(
    (data: OutputData) => {
      if (!currentWorkspace) return

      const nextBlocks = (data.blocks ?? []) as SnapshotBlock[]
      const nextContent = editorDataToMarkdown(data)

      setWorkspaces((prev) =>
        prev.map((workspace) =>
          workspace.id === currentWorkspace.id
            ? { ...workspace, blocks: nextBlocks, content: nextContent }
            : workspace,
        ),
      )
      setSyncStatus("syncing")

      if (syncTimerRef.current) {
        window.clearTimeout(syncTimerRef.current)
      }

      syncTimerRef.current = window.setTimeout(async () => {
        if (demoMode || !isRealDocument) {
          setSyncStatus("synced")
          setToast("작업 내용이 자동 반영되었습니다.")
          return
        }

        try {
          await apiClient.save.updateSave({
            docId: documentId,
            saveId: currentWorkspace.id,
            saveUpdateRequest: {
              content: nextBlocks,
            },
          })
          setSyncStatus("synced")
          setToast("작업 내용이 자동 반영되었습니다.")
        } catch (error: any) {
          setSyncStatus("idle")
          await alertDialog(
            error.message || "작업장 자동 저장에 실패했습니다.",
            "오류",
            "destructive",
          )
        }
      }, 700)
    },
    [currentWorkspace, demoMode, documentId, isRealDocument],
  )

  const handleCommitConfirm = useCallback(
    async ({ title, description }: { title: string; description?: string }) => {
      if (!currentBranch || !currentWorkspace) return

      if (demoMode || !isRealDocument) {
        const nextCommitId = getNextId(commits)
        const nextCommit: CommitRecord = {
          id: nextCommitId,
          branchId: currentBranch.id,
          title,
          description: description || "현재 작업장에서 남긴 기록",
          content: currentWorkspace.content,
          blocks: currentWorkspace.blocks,
          createdAt: new Date().toISOString(),
          kind: "commit",
          loaded: true,
        }

        setCommits((prev) => [...prev, nextCommit])
        setBranches((prev) =>
          prev.map((branch) =>
            branch.id === currentBranch.id
              ? { ...branch, headCommitId: nextCommitId }
              : branch,
          ),
        )
        setIsCommitModalOpen(false)
        setSyncStatus("synced")
        setToast(`기록 '${title}'이 생성됐고, 작업장은 그대로 유지됩니다.`)
        return
      }

      setIsActionPending(true)
      try {
        const currentBlocks = currentWorkspace.blocks
        const result = await apiClient.commit.createCommit({
          docId: documentId,
          createCommitRequest: {
            title,
            description,
            blocks: currentBlocks,
            blockOrders: currentBlocks.map((block, index) => block.id ?? String(index)),
            branchId: currentBranch.id,
          },
        })

        if (!result.id) {
          throw new Error("기록 ID가 없습니다.")
        }

        setIsCommitModalOpen(false)
        const nextParams = new URLSearchParams({
          mode: "save",
          saveId: String(currentWorkspace.id),
        })
        await refreshDocumentState(nextParams, false)
        setSearchParams(nextParams, { replace: true })
        setToast(`기록 '${title}'을 남기고 작업장을 그대로 유지했습니다.`)
      } catch (error: any) {
        await alertDialog(
          error.message || "기록 생성에 실패했습니다.",
          "오류",
          "destructive",
        )
      } finally {
        setIsActionPending(false)
      }
    },
    [
      commits,
      currentBranch,
      currentWorkspace,
      documentId,
      isRealDocument,
      refreshDocumentState,
      setSearchParams,
    ],
  )

  const handleContinueEditClick = (commitId: number) => {
    const targetCommit = commits.find((commit) => commit.id === commitId)
    const targetBranch = branches.find(
      (branch) => branch.id === targetCommit?.branchId,
    )
    if (!targetCommit || !targetBranch) return

    setBranchEditState({
      commitId: targetCommit.id,
      isLastCommit: false,
      currentBranchName: targetBranch.name,
    })
  }

  const handleBranchEditConfirm = useCallback(
    async (branchName: string) => {
      if (!branchEditState) return

      const targetCommit = commits.find(
        (commit) => commit.id === branchEditState.commitId,
      )
      const targetBranch = branches.find(
        (branch) => branch.id === targetCommit?.branchId,
      )
      if (!targetCommit || !targetBranch) return

      if (demoMode || !isRealDocument) {
        const nextBranchId = getNextId(branches)
        const nextWorkspaceId = getNextId(workspaces)

        setBranches((prev) => [
          ...prev,
          {
            id: nextBranchId,
            name: branchName,
            fromCommitId: targetCommit.id,
            rootCommitId: targetCommit.id,
            headCommitId: null,
            saveId: nextWorkspaceId,
          },
        ])

        setWorkspaces((prev) => [
          ...prev,
          {
            id: nextWorkspaceId,
            branchId: nextBranchId,
            content: `${targetCommit.content}\n\n[새 작업장에서 이어서 편집]`,
            blocks: createBlocksFromMarkdown(
              `${targetCommit.content}\n\n[새 작업장에서 이어서 편집]`,
            ),
            loaded: true,
          },
        ])

        const nextView: ViewState = {
          mode: "workspace",
          branchId: nextBranchId,
          workspaceId: nextWorkspaceId,
        }
        setView(nextView)
        setSyncStatus("synced")
        setToast(`${branchName} 작업장이 열렸습니다.`)
        setBranchEditState(null)
        return
      }

      setIsActionPending(true)
      try {
        const result = await apiClient.branch.createBranch({
          documentId,
          branchCreateRequest: {
            name: branchName,
            fromCommitId: targetCommit.id,
          },
        })

        setBranchEditState(null)

        if (!result.saveId) {
          throw new Error("작업장을 만들지 못했습니다.")
        }

        const nextParams = new URLSearchParams({
          mode: "save",
          saveId: String(result.saveId),
        })
        await refreshDocumentState(nextParams, false)
        setSearchParams(nextParams, { replace: true })
        setToast(`${branchName} 작업장을 열었습니다.`)
      } catch (error: any) {
        await alertDialog(
          error.message || "이어서 작업하기에 실패했습니다.",
          "오류",
          "destructive",
        )
      } finally {
        setIsActionPending(false)
      }
    },
    [
      branchEditState,
      branches,
      commits,
      documentId,
      isRealDocument,
      refreshDocumentState,
      setSearchParams,
      workspaces,
    ],
  )

  const handleCompareStart = (kind: CompareItemKind, id: number, branchId: number) => {
    setView({
      mode: "compare",
      branchId,
      baseKind: kind,
      baseId: id,
      compareKind: null,
      compareId: null,
    })
    setToast("그래프에서 비교할 다른 기록이나 작업장을 고르세요.")
  }

  const handleCompareTargetPick = (kind: CompareItemKind, id: number) => {
    if (view.mode !== "compare") return
    if (kind === view.baseKind && id === view.baseId) return

    setView({
      mode: "compare",
      branchId: view.branchId,
      baseKind: view.baseKind,
      baseId: view.baseId,
      compareKind: kind,
      compareId: id,
    })
    setToast("두 버전을 나란히 비교 중입니다.")
  }

  const handleMergeStart = (kind: CompareItemKind, id: number, branchId: number) => {
    setView({
      mode: "merge",
      branchId,
      sourceKind: kind,
      sourceId: id,
      targetKind: null,
      targetId: null,
    })
    setToast("그래프에서 병합할 대상 브랜치의 기록이나 작업장을 고르세요.")
  }

  const handleMergeTargetPick = (kind: CompareItemKind, id: number) => {
    if (view.mode !== "merge") return
    if (kind === view.sourceKind && id === view.sourceId) return

    setView({
      mode: "merge",
      branchId: view.branchId,
      sourceKind: view.sourceKind,
      sourceId: view.sourceId,
      targetKind: kind,
      targetId: id,
    })
    setToast("병합 결과를 확인한 뒤 적용할 수 있습니다.")
  }

  const handleDeleteCommit = useCallback(
    async (commitId: number) => {
      const targetCommit = commits.find((commit) => commit.id === commitId)
      const targetBranch = branches.find((branch) => branch.id === targetCommit?.branchId)
      if (!targetCommit || !targetBranch) return

      if (demoMode || !isRealDocument) {
        const branchCommits = commits
          .filter((commit) => commit.branchId === targetBranch.id)
          .sort((a, b) => a.id - b.id)
        const previousCommit = branchCommits[branchCommits.length - 2]
        if (!previousCommit) return

        setCommits((prev) => prev.filter((commit) => commit.id !== targetCommit.id))
        setBranches((prev) =>
          prev.map((branch) =>
            branch.id === targetBranch.id
              ? { ...branch, headCommitId: previousCommit.id }
              : branch,
          ),
        )
        openCommit(targetBranch.id, previousCommit.id)
        setToast(`기록 "${targetCommit.title}"을 삭제했습니다.`)
        setDeleteDialog(null)
        return
      }

      setIsActionPending(true)
      try {
        await apiClient.commit.deleteCommit({
          docId: documentId,
          commitId,
        })
        setDeleteDialog(null)
        await refreshDocumentState(new URLSearchParams(), true)
        setToast(`기록 "${targetCommit.title}"을 삭제했습니다.`)
      } catch (error: any) {
        await alertDialog(
          error.message || "기록 삭제에 실패했습니다.",
          "오류",
          "destructive",
        )
      } finally {
        setIsActionPending(false)
      }
    },
    [branches, commits, documentId, isRealDocument, openCommit, refreshDocumentState],
  )

  const handleDeleteBranch = useCallback(
    async (branchId: number) => {
      if (!mainWorkspace || !mainBranch) return

      const targetBranch = branches.find((branch) => branch.id === branchId)
      if (!targetBranch || targetBranch.id === mainBranch.id) return

      if (demoMode || !isRealDocument) {
        const commitIds = new Set(
          commits
            .filter((commit) => commit.branchId === targetBranch.id)
            .map((commit) => commit.id),
        )

        setCommits((prev) => prev.filter((commit) => !commitIds.has(commit.id)))
        setBranches((prev) => prev.filter((branch) => branch.id !== targetBranch.id))
        setWorkspaces((prev) =>
          prev.filter((workspace) => workspace.id !== targetBranch.saveId),
        )
        openWorkspaceByBranch(mainBranch.id)
        setToast(`${targetBranch.name} 브랜치를 삭제하고 main 작업장으로 돌아왔습니다.`)
        setDeleteDialog(null)
        return
      }

      setIsActionPending(true)
      try {
        await apiClient.branch.deleteBranch({
          documentId,
          branchId,
        })
        setDeleteDialog(null)
        await refreshDocumentState(new URLSearchParams(), true)
        setToast(`${targetBranch.name} 브랜치를 삭제하고 main 작업장으로 돌아왔습니다.`)
      } catch (error: any) {
        await alertDialog(
          error.message || "브랜치 삭제에 실패했습니다.",
          "오류",
          "destructive",
        )
      } finally {
        setIsActionPending(false)
      }
    },
    [
      branches,
      commits,
      documentId,
      isRealDocument,
      mainBranch,
      mainWorkspace,
      openWorkspaceByBranch,
      refreshDocumentState,
    ],
  )

  const handleDirectMerge = useCallback(
    async (mergedData: OutputData) => {
      const sourceItem = view.mode === "merge" ? mergeSourceItem : null
      if (!sourceItem || !mergeTargetItem) return

      const targetBranch = branches.find((branch) => branch.id === mergeTargetItem.branchId)
      const targetWorkspace = workspaces.find(
        (workspace) => workspace.branchId === mergeTargetItem.branchId,
      )
      if (!targetBranch || !targetWorkspace) return

      if (demoMode || !isRealDocument) {
        const nextCommitId = getNextId(commits)
        const mergedBlocks = (mergedData.blocks ?? []) as SnapshotBlock[]
        const mergedContent = editorDataToMarkdown(mergedData)

        setCommits((prev) => [
          ...prev,
          {
            id: nextCommitId,
            branchId: targetBranch.id,
            title: `${sourceItem.title} 병합`,
            description: `${targetBranch.name}에 ${sourceItem.title} 반영`,
            content: mergedContent,
            blocks: mergedBlocks,
            createdAt: new Date().toISOString(),
            kind: "merge",
            loaded: true,
          },
        ])

        setBranches((prev) =>
          prev.map((branch) =>
            branch.id === targetBranch.id
              ? { ...branch, headCommitId: nextCommitId }
              : branch,
          ),
        )

        setWorkspaces((prev) =>
          prev.map((workspace) =>
            workspace.id === targetWorkspace.id
              ? { ...workspace, content: mergedContent, blocks: mergedBlocks }
              : workspace,
          ),
        )

        openCommit(targetBranch.id, nextCommitId)
        setToast(`${targetBranch.name}에 ${sourceItem.title} 내용을 병합했습니다.`)
        return
      }

      const resolveCommitId = (kind: CompareItemKind, id: number) => {
        if (kind === "commit") return id
        const branch = branches.find((item) => item.saveId === id)
        return branch?.headCommitId ?? branch?.rootCommitId ?? null
      }

      const baseCommitId = resolveCommitId(view.sourceKind, view.sourceId)
      const targetCommitId =
        view.targetKind && view.targetId
          ? resolveCommitId(view.targetKind, view.targetId)
          : null

      if (!baseCommitId || !targetCommitId) {
        await alertDialog(
          "현재 백엔드는 저장 상태끼리의 병합을 직접 지원하지 않습니다. 기준 기록을 찾을 수 없습니다.",
          "오류",
          "destructive",
        )
        return
      }

      setIsActionPending(true)
      try {
        const mergeResult = await apiClient.commit.mergeCommit({
          docId: documentId,
          mergeCommitRequest: {
            title: `${sourceItem.title} 병합`,
            description: `${targetBranch.name}에 ${sourceItem.title} 반영`,
            baseCommitId,
            targetCommitId,
            content: (mergedData.blocks ?? []) as SnapshotBlock[],
          },
        })

        if (!mergeResult.id) {
          throw new Error("병합 기록 ID가 없습니다.")
        }

        const nextParams = new URLSearchParams({
          mode: "save",
          saveId: String(targetWorkspace.id),
        })
        await refreshDocumentState(nextParams, false)
        setSearchParams(nextParams, { replace: true })

        setToast(`${targetBranch.name}에 ${sourceItem.title} 내용을 병합했습니다.`)
      } catch (error: any) {
        await alertDialog(
          error.message || "병합 적용에 실패했습니다.",
          "오류",
          "destructive",
        )
      } finally {
        setIsActionPending(false)
      }
    },
    [
      branches,
      commits,
      documentId,
      isRealDocument,
      mergeSourceItem,
      mergeTargetItem,
      openCommit,
      refreshDocumentState,
      setSearchParams,
      view,
      workspaces,
    ],
  )

  const handleGraphNodeMenuClick = (
    type: CommitNodeMenuType | TempNodeMenuType,
    targetId: number,
  ) => {
    switch (type) {
      case "commit-view": {
        const commit = commits.find((item) => item.id === targetId)
        if (!commit) return
        openCommit(commit.branchId, commit.id)
        return
      }
      case "commit-compare": {
        const commit = commits.find((item) => item.id === targetId)
        if (!commit) return
        handleCompareStart("commit", commit.id, commit.branchId)
        return
      }
      case "commit-continueEdit":
        handleContinueEditClick(targetId)
        return
      case "commit-delete":
        setDeleteDialog({ type: "commit", commitId: targetId })
        return
      case "commit-merge": {
        const commit = commits.find((item) => item.id === targetId)
        if (!commit) return
        handleMergeStart("commit", commit.id, commit.branchId)
        return
      }
      case "temp-edit": {
        const branch = branches.find((item) => item.saveId === targetId)
        if (!branch) return
        openWorkspaceByBranch(branch.id)
        setToast(`${branch.name} 작업장을 열었습니다.`)
        return
      }
    }
  }

  const handleBranchRename = useCallback(
    async (branchId: number, newName: string) => {
      if (demoMode || !isRealDocument) {
        setBranches((prev) =>
          prev.map((branch) =>
            branch.id === branchId ? { ...branch, name: newName } : branch,
          ),
        )
        if (view.branchId === branchId) {
          setToast(`${newName} 브랜치 이름으로 변경했습니다.`)
        }
        return
      }

      setIsActionPending(true)
      try {
        await apiClient.branch.renameBranch({
          documentId,
          branchId,
          branchRenameRequest: {
            name: newName,
          },
        })
        await refreshDocumentState(searchParams, false)
        setToast(`${newName} 브랜치 이름으로 변경했습니다.`)
      } catch (error: any) {
        await alertDialog(
          error.message || "브랜치 이름 변경에 실패했습니다.",
          "오류",
          "destructive",
        )
      } finally {
        setIsActionPending(false)
      }
    },
    [
      documentId,
      isRealDocument,
      refreshDocumentState,
      searchParams,
      view.branchId,
    ],
  )

  const rightTitle =
    view.mode === "workspace"
      ? `${currentBranch?.name ?? "branch"} 작업장`
      : view.mode === "compare"
        ? "기록 비교"
        : view.mode === "merge"
          ? "기록 병합"
          : `${currentBranch?.name ?? "branch"} 기록`

  const graphMainBranch =
    mainBranch ??
    ({
      id: 0,
      name: "main",
      createdAt: new Date().toISOString(),
      fromCommitId: null,
      rootCommitId: 0,
      leafCommitId: 0,
      saveId: null,
    } satisfies GraphDataType["branches"][number])

  if (!demoMode && !isRealDocument) {
    return (
      <div className="flex h-full min-h-0 w-full items-center justify-center bg-slate-100 text-sm text-slate-500">
        문서 경로가 올바르지 않습니다.
      </div>
    )
  }

  if (
    !demoMode &&
    isRealDocument &&
    !hasBootstrapped &&
    (graphQuery.isLoading || isHydrating || !graphQuery.data)
  ) {
    return (
      <div className="flex h-full min-h-0 w-full items-center justify-center bg-slate-100 text-sm text-slate-500">
        문서 흐름을 불러오는 중입니다...
      </div>
    )
  }

  if (!demoMode && isRealDocument && !hasBootstrapped && graphQuery.error) {
    return (
      <div className="flex h-full min-h-0 w-full items-center justify-center bg-slate-100 text-sm text-red-500">
        문서 흐름을 불러오지 못했습니다.
      </div>
    )
  }

  return (
    <>
      <div
        className={`w-full overflow-hidden bg-slate-100 ${
          demoMode ? "h-screen min-h-screen" : "h-full min-h-0"
        }`}
      >
        <ResizableLayout
          initialWidth={450}
          minWidth={340}
          maxWidth={860}
          className="h-full min-h-0"
          sidebarClassName="h-full min-h-0"
          mainClassName="h-full min-h-0 bg-slate-100"
        >
          <div className="h-full min-h-0 bg-slate-100 p-3">
            <DocumentGraph
              data={graphData}
              mainBranch={graphMainBranch}
              currentBranchId={view.branchId}
              currentCommitId={
                view.mode === "commit"
                  ? String(view.commitId)
                  : view.mode === "compare" && view.baseKind === "commit"
                    ? String(view.baseId)
                    : view.mode === "merge" && view.sourceKind === "commit"
                      ? String(view.sourceId)
                      : null
              }
              currentSaveId={
                view.mode === "workspace"
                  ? String(view.workspaceId)
                  : view.mode === "merge" && view.sourceKind === "workspace"
                    ? String(view.sourceId)
                    : null
              }
              onNodeMenuClick={handleGraphNodeMenuClick}
              onBranchSelect={(branchId) => {
                openWorkspaceByBranch(branchId)
                const branch = branches.find((item) => item.id === branchId)
                if (branch) {
                  setToast(`${branch.name} 작업장을 열었습니다.`)
                }
              }}
              onBranchDelete={(branchId) => setDeleteDialog({ type: "branch", branchId })}
              onBranchRename={handleBranchRename}
              compareSelection={
                view.mode === "compare"
                  ? {
                      active: true,
                      baseKind: view.baseKind,
                      baseId: view.baseId,
                    }
                  : null
              }
              mergeSelection={
                view.mode === "merge"
                  ? {
                      active: true,
                      sourceKind: view.sourceKind,
                      sourceId: view.sourceId,
                    }
                  : null
              }
              onCompareTargetPick={handleCompareTargetPick}
              onMergeTargetPick={handleMergeTargetPick}
            />
          </div>

          <div className="h-full min-h-0 bg-slate-100 p-3">
            <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">
                    {rightTitle}
                  </p>
                  {view.mode === "commit" && currentCommit ? (
                    <p className="truncate text-xs text-slate-500">
                      {currentCommit.title}
                    </p>
                  ) : null}
                  {view.mode === "compare" && compareBaseItem ? (
                    <p className="truncate text-xs text-slate-500">
                      {compareBaseItem.title} 기준 비교
                    </p>
                  ) : null}
                  {view.mode === "merge" && mergeSourceItem ? (
                    <p className="truncate text-xs text-slate-500">
                      {mergeTargetItem
                        ? `${mergeSourceItem.title} -> ${mergeTargetItem.title}`
                        : `${mergeSourceItem.title} 기준 병합`}
                    </p>
                  ) : null}
                  {view.mode === "workspace" ? (
                    <p className="truncate text-xs text-slate-500">{toast}</p>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  {view.mode === "workspace" ? (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          currentWorkspace &&
                          handleCompareStart("workspace", currentWorkspace.id, view.branchId)
                        }
                      >
                        <GitCompareArrows className="h-4 w-4" /> 비교하기
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => setIsCommitModalOpen(true)}
                        disabled={isActionPending}
                      >
                        <GitCommitHorizontal className="h-4 w-4" /> 기록하기
                      </Button>
                    </>
                  ) : null}
                  {view.mode === "commit" && currentCommit ? (
                    <>
                      <Button
                        size="sm"
                        onClick={() =>
                          handleMergeStart("commit", currentCommit.id, currentCommit.branchId)
                        }
                      >
                        <GitMerge className="h-4 w-4" /> 병합하기
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          handleCompareStart("commit", currentCommit.id, currentCommit.branchId)
                        }
                      >
                        <GitCompareArrows className="h-4 w-4" /> 비교하기
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleContinueEditClick(currentCommit.id)}
                      >
                        <Play className="h-4 w-4" /> 이어서 작업하기
                      </Button>
                      {canDeleteCurrentCommit ? (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() =>
                            setDeleteDialog({
                              type: "commit",
                              commitId: currentCommit.id,
                            })
                          }
                        >
                          <Trash2 className="h-4 w-4" /> 기록 삭제
                        </Button>
                      ) : null}
                    </>
                  ) : null}
                  {view.mode === "compare" && compareBaseItem ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        compareBaseItem.kind === "commit"
                          ? openCommit(compareBaseItem.branchId, compareBaseItem.id)
                          : openWorkspaceByBranch(compareBaseItem.branchId)
                      }
                    >
                      <X className="h-4 w-4" /> 비교 종료
                    </Button>
                  ) : null}
                  {view.mode === "merge" && mergeSourceItem ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        mergeSourceItem.kind === "commit"
                          ? openCommit(mergeSourceItem.branchId, mergeSourceItem.id)
                          : openWorkspaceByBranch(mergeSourceItem.branchId)
                      }
                    >
                      <X className="h-4 w-4" /> 병합 종료
                    </Button>
                  ) : null}
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                    {syncStatus === "syncing"
                      ? "자동 반영 중"
                      : syncStatus === "synced"
                        ? "자동 반영됨"
                        : "대기 중"}
                  </span>
                </div>
              </div>

              {view.mode !== "workspace" ? (
                <div className="border-b border-slate-200 bg-slate-50 px-5 py-2 text-xs text-slate-500">
                  {toast}
                </div>
              ) : null}

              <div
                className={`flex-1 overflow-auto ${
                  view.mode === "compare" ? "bg-slate-50 p-4" : "bg-white px-5 py-4"
                }`}
              >
                {view.mode === "workspace" ? (
                  currentWorkspace?.loaded ? (
                    <div className="h-full min-h-[760px]">
                      <DocumentEditor
                        key={`workspace-${currentWorkspace?.id ?? "empty"}`}
                        isEditable={true}
                        initialData={createOutputData(currentWorkspace?.blocks)}
                        onDataChange={handleWorkspaceChange}
                        disableAutoUpdate={true}
                        minimalChrome={true}
                        contentLayout="document"
                      />
                    </div>
                  ) : (
                    <div className="flex h-full min-h-[760px] items-center justify-center text-sm text-slate-500">
                      선택한 작업장을 불러오는 중입니다...
                    </div>
                  )
                ) : view.mode === "commit" ? (
                  currentCommit?.loaded ? (
                    <div className="h-full min-h-[760px]">
                      <DocumentEditor
                        key={`commit-${currentCommit?.id ?? "empty"}`}
                        isEditable={false}
                        initialData={createOutputData(currentCommit?.blocks)}
                        minimalChrome={true}
                        contentLayout="document"
                      />
                    </div>
                  ) : (
                    <div className="flex h-full min-h-[760px] items-center justify-center text-sm text-slate-500">
                      선택한 기록을 불러오는 중입니다...
                    </div>
                  )
                ) : view.mode === "merge" ? (
                  mergeSourceData &&
                  mergeTargetData &&
                  mergeSourceItem?.loaded &&
                  mergeTargetItem?.loaded ? (
                    <div className="h-full min-h-[760px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                      <DocumentMergeView
                        baseData={mergeSourceData}
                        targetData={mergeTargetData}
                        initialMergedData={mergeTargetData}
                        baseLabel={mergeSourceItem?.title ?? "병합 원본"}
                        targetLabel={mergeTargetItem?.title ?? "병합 대상"}
                        title="기록 병합"
                        className="h-full"
                        onCancel={() =>
                          mergeSourceItem?.kind === "commit"
                            ? openCommit(mergeSourceItem.branchId, mergeSourceItem.id)
                            : openWorkspaceByBranch(mergeSourceItem.branchId)
                        }
                        onSave={handleDirectMerge}
                      />
                    </div>
                  ) : (
                    <div className="flex h-full min-h-[760px] items-center justify-center rounded-2xl border border-slate-200 bg-white text-sm text-slate-500 shadow-sm">
                      {view.mode === "merge" && view.targetId
                        ? "선택한 병합 대상을 불러오는 중입니다..."
                        : "병합할 대상 기록 또는 작업장을 먼저 선택하세요."}
                    </div>
                  )
                ) : compareTargetItem &&
                  compareBaseItem &&
                  compareBaseItem.loaded &&
                  compareTargetItem.loaded ? (
                  <DocumentCompareView
                    leftData={createOutputData(compareBaseItem.blocks)}
                    rightData={createOutputData(compareTargetItem.blocks)}
                    leftLabel={compareBaseItem.title}
                    leftSubtitle={compareBaseItem.subtitle}
                    rightLabel={compareTargetItem.title}
                    rightSubtitle={compareTargetItem.subtitle}
                    className="h-full min-h-[760px]"
                  />
                ) : (
                  <div className="flex h-full min-h-[760px] items-center justify-center rounded-2xl border border-slate-200 bg-white text-sm text-slate-500 shadow-sm">
                    {view.mode === "compare" && view.compareId
                      ? "선택한 비교 대상을 불러오는 중입니다..."
                      : "그래프에서 비교할 다른 기록이나 작업장을 선택하세요."}
                  </div>
                )}
              </div>
            </div>
          </div>
        </ResizableLayout>
      </div>

      <SaveCommitModal
        isOpen={isCommitModalOpen}
        onClose={() => setIsCommitModalOpen(false)}
        mode="commit"
        onConfirm={handleCommitConfirm}
        isLoading={isActionPending}
      />

      <BranchEditModal
        isOpen={!!branchEditState}
        onClose={() => setBranchEditState(null)}
        onConfirm={handleBranchEditConfirm}
        isLastCommit={branchEditState?.isLastCommit || false}
        defaultBranchName={branchEditState?.currentBranchName || ""}
      />

      <AlertDialog open={!!deleteDialog} onOpenChange={(open) => !open && setDeleteDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleteDialog?.type === "commit" ? "기록을 삭제할까요?" : "브랜치를 삭제할까요?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteDialog?.type === "commit"
                ? "현재 보고 있는 기록만 삭제됩니다. 이전 기록과 작업장은 그대로 유지됩니다."
                : "브랜치와 그 아래 기록들이 함께 제거됩니다. 작업장은 별도 삭제 없이 브랜치 정리 흐름에 포함됩니다."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={() => {
                if (deleteDialog?.type === "commit") {
                  void handleDeleteCommit(deleteDialog.commitId)
                  return
                }
                void handleDeleteBranch(deleteDialog.branchId)
              }}
            >
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
