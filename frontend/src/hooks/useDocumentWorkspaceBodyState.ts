import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { OutputData } from "@editorjs/editorjs"
import type { UseQueryResult } from "@tanstack/react-query"
import type { SetURLSearchParams } from "react-router"
import type { GraphDataType } from "@/types/graph"
import { editorDataToMarkdown } from "@/lib/editorMarkdown"

export type SnapshotBlock = { [key: string]: any }

export type BranchRecord = {
  id: number
  name: string
  fromCommitId: number | null
  rootCommitId: number | null
  headCommitId: number | null
  saveId: number | null
}

export type CommitRecord = {
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

export type WorkspaceRecord = {
  id: number
  branchId: number
  content: string
  blocks: SnapshotBlock[]
  loaded: boolean
}

export type CompareItemKind = "commit" | "workspace"

export type ViewState =
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

export function createOutputData(
  blocks: SnapshotBlock[] | null | undefined,
): OutputData {
  return {
    time: Date.now(),
    version: "2.30.8",
    blocks: Array.isArray(blocks) ? blocks : [],
  }
}

export function blocksToMarkdown(blocks: SnapshotBlock[] | null | undefined) {
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
    const branch =
      branches.find((item) => item.saveId === saveId) ??
      (workspace ? branches.find((item) => item.id === workspace.branchId) : null) ??
      null

    return {
      mode: "workspace",
      branchId: workspace?.branchId ?? branch?.id ?? 0,
      workspaceId: workspace?.id ?? saveId,
    }
  }

  if (mode === "commit" && commitId) {
    const commit = commits.find((item) => item.id === commitId)
    const branch =
      branches.find((item) => item.headCommitId === commitId) ??
      branches.find((item) => item.rootCommitId === commitId) ??
      branches.find((item) => item.fromCommitId === commitId) ??
      null

    return {
      mode: "commit",
      branchId: commit?.branchId ?? branch?.id ?? 0,
      commitId: commit?.id ?? commitId,
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
    branchId: 0,
    workspaceId: 0,
  }
}

function resolveImmediateViewFromParams(params: URLSearchParams): ViewState | null {
  const mode = params.get("mode")
  const saveId = Number(params.get("saveId") || 0)
  const commitId = Number(params.get("commitId") || 0)

  if (mode === "save" && saveId) {
    return { mode: "workspace", branchId: 0, workspaceId: saveId }
  }

  if (mode === "commit" && commitId) {
    return { mode: "commit", branchId: 0, commitId }
  }

  return null
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

type GraphQueryLike = UseQueryResult<GraphDataType, Error>

interface UseDocumentWorkspaceBodyStateParams {
  documentId: number
  isRealDocument: boolean
  searchParams: URLSearchParams
  setSearchParams: SetURLSearchParams
  graphQuery: GraphQueryLike
  directSelectedData: SnapshotBlock[] | null | undefined
  requestedDocumentMode: "save" | "commit" | null
  requestedSaveId: number
  requestedCommitId: number
}

export function useDocumentWorkspaceBodyState({
  documentId,
  isRealDocument,
  searchParams,
  setSearchParams,
  graphQuery,
  directSelectedData,
  requestedDocumentMode,
  requestedSaveId,
  requestedCommitId,
}: UseDocumentWorkspaceBodyStateParams) {
  const [branches, setBranches] = useState<BranchRecord[]>([])
  const [commits, setCommits] = useState<CommitRecord[]>([])
  const [workspaces, setWorkspaces] = useState<WorkspaceRecord[]>([])
  const [view, setView] = useState<ViewState>(
    resolveImmediateViewFromParams(searchParams) ?? {
      mode: "workspace",
      branchId: 0,
      workspaceId: 0,
    },
  )
  const [isHydrating, setIsHydrating] = useState(false)
  const [hasBootstrapped, setHasBootstrapped] = useState(false)
  const commitsRef = useRef<CommitRecord[]>([])
  const workspacesRef = useRef<WorkspaceRecord[]>([])
  const previousDocumentIdRef = useRef<number | null>(null)

  useEffect(() => {
    commitsRef.current = commits
  }, [commits])

  useEffect(() => {
    workspacesRef.current = workspaces
  }, [workspaces])

  const pushViewToUrl = useCallback(
    (nextView: ViewState, replace = false) => {
      if (!isRealDocument) return

      if (nextView.mode === "workspace") {
        setSearchParams(
          { mode: "save", saveId: String(nextView.workspaceId) },
          { replace },
        )
        return
      }

      if (nextView.mode === "commit") {
        setSearchParams(
          { mode: "commit", commitId: String(nextView.commitId) },
          { replace },
        )
      }
    },
    [isRealDocument, setSearchParams],
  )

  const hydrateFromGraph = useCallback(
    async (
      sourceGraphData: GraphDataType,
      params: URLSearchParams,
      syncUrl = false,
    ) => {
      if (!isRealDocument) return

      setIsHydrating(true)

      try {
        const nextBranches: BranchRecord[] = sourceGraphData.branches.map((branch) => ({
          id: branch.id,
          name: branch.name,
          fromCommitId: branch.fromCommitId,
          rootCommitId: branch.rootCommitId,
          headCommitId: branch.leafCommitId ?? null,
          saveId: branch.saveId ?? null,
        }))

        const nextCommits = sourceGraphData.commits.map((commit) =>
          createCommitRecord(
            commit,
            commitsRef.current.find((item) => item.id === commit.id),
          ),
        )
        const nextWorkspaces = nextBranches
          .filter((branch) => branch.saveId)
          .map((branch) =>
            createWorkspaceRecord(
              branch,
              workspacesRef.current.find((item) => item.id === branch.saveId),
            ),
          )

        setBranches(nextBranches)
        setCommits(nextCommits)
        setWorkspaces(nextWorkspaces)

        const nextView = resolveViewFromParams(
          params,
          nextBranches,
          nextCommits,
          nextWorkspaces,
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
    [isRealDocument, pushViewToUrl],
  )

  const refreshDocumentState = useCallback(
    async (params?: URLSearchParams, syncUrl = true) => {
      if (!isRealDocument) return

      const response = await graphQuery.refetch()
      if (response.data) {
        await hydrateFromGraph(response.data, params ?? searchParams, syncUrl)
      }
    },
    [graphQuery, hydrateFromGraph, isRealDocument, searchParams],
  )

  useEffect(() => {
    if (!isRealDocument) return

    const immediateView = resolveImmediateViewFromParams(searchParams)
    if (!immediateView) return

    setView((prev) => (isSameView(prev, immediateView) ? prev : immediateView))
  }, [isRealDocument, searchParams])

  useEffect(() => {
    if (!isRealDocument) return
    if (!requestedDocumentMode) return
    if (!directSelectedData) return

    if (requestedDocumentMode === "save" && requestedSaveId) {
      const nextBlocks = directSelectedData
      const nextContent = blocksToMarkdown(nextBlocks)
      const saveId = requestedSaveId

      setWorkspaces((prev) => {
        const existing = prev.find((workspace) => workspace.id === saveId)

        if (!existing) {
          return [
            ...prev,
            {
              id: saveId,
              branchId: branches.find((branch) => branch.saveId === saveId)?.id ?? 0,
              content: nextContent,
              blocks: nextBlocks,
              loaded: true,
            },
          ]
        }

        return prev.map((workspace) =>
          workspace.id === saveId
            ? {
                ...workspace,
                branchId:
                  workspace.branchId ||
                  branches.find((branch) => branch.saveId === saveId)?.id ||
                  0,
                content: nextContent,
                blocks: nextBlocks,
                loaded: true,
              }
            : workspace,
        )
      })

      return
    }

    if (requestedDocumentMode !== "commit" || !requestedCommitId) return

    const nextBlocks = directSelectedData
    const nextContent = blocksToMarkdown(nextBlocks)
    const commitId = requestedCommitId

    setCommits((prev) => {
      const existing = prev.find((commit) => commit.id === commitId)

      if (!existing) {
        return [
          ...prev,
          {
            id: commitId,
            branchId:
              branches.find((branch) =>
                [branch.headCommitId, branch.rootCommitId, branch.fromCommitId].includes(
                  commitId,
                ),
              )?.id ?? 0,
            title: `기록 ${commitId}`,
            description: "",
            content: nextContent,
            blocks: nextBlocks,
            createdAt: new Date().toISOString(),
            kind: "commit",
            loaded: true,
          },
        ]
      }

      return prev.map((commit) =>
        commit.id === commitId
          ? {
              ...commit,
              branchId:
                commit.branchId ||
                branches.find((branch) =>
                  [branch.headCommitId, branch.rootCommitId, branch.fromCommitId].includes(
                    commitId,
                  ),
                )?.id ||
                0,
              content: nextContent,
              blocks: nextBlocks,
              loaded: true,
            }
          : commit,
      )
    })
  }, [
    branches,
    directSelectedData,
    isRealDocument,
    requestedCommitId,
    requestedDocumentMode,
    requestedSaveId,
  ])

  useEffect(() => {
    if (!isRealDocument) return
    if (!graphQuery.data) return

    void hydrateFromGraph(graphQuery.data, searchParams, true)
  }, [graphQuery.data, hydrateFromGraph, isRealDocument, searchParams])

  useEffect(() => {
    if (!isRealDocument) return
    if (!branches.length) return

    const nextView = resolveViewFromParams(searchParams, branches, commits, workspaces)
    setView((prev) => (isSameView(prev, nextView) ? prev : nextView))
  }, [branches, commits, isRealDocument, searchParams, workspaces])

  useEffect(() => {
    const previousDocumentId = previousDocumentIdRef.current
    previousDocumentIdRef.current = documentId

    if (previousDocumentId === null) return

    if (previousDocumentId !== documentId) {
      setHasBootstrapped(false)
      setBranches([])
      setCommits([])
      setWorkspaces([])
    }
  }, [documentId])

  const currentBranch = useMemo(
    () => branches.find((branch) => branch.id === view.branchId) ?? null,
    [branches, view.branchId],
  )

  const currentWorkspace = useMemo(() => {
    if (view.mode !== "workspace") return null
    return workspaces.find((workspace) => workspace.id === view.workspaceId) ?? null
  }, [view, workspaces])

  const currentCommit = useMemo(() => {
    if (view.mode !== "commit") return null
    return commits.find((commit) => commit.id === view.commitId) ?? null
  }, [commits, view])

  const openWorkspaceByBranch = useCallback(
    (branchId: number) => {
      const branch = branches.find((item) => item.id === branchId)
      if (!branch?.saveId) return

      const nextView: ViewState = { mode: "workspace", branchId, workspaceId: branch.saveId }
      setView(nextView)
      pushViewToUrl(nextView)
    },
    [branches, pushViewToUrl],
  )

  const openCommit = useCallback(
    (branchId: number, commitId: number) => {
      const nextView: ViewState = { mode: "commit", branchId, commitId }
      setView(nextView)
      pushViewToUrl(nextView)
    },
    [pushViewToUrl],
  )

  return {
    branches,
    setBranches,
    commits,
    setCommits,
    workspaces,
    setWorkspaces,
    view,
    setView,
    currentBranch,
    currentWorkspace,
    currentCommit,
    hasBootstrapped,
    isHydrating,
    refreshDocumentState,
    openWorkspaceByBranch,
    openCommit,
  }
}
