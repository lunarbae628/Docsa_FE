import { useCallback, useRef, useState } from "react"
import type { OutputData } from "@editorjs/editorjs"
import { useQueryClient } from "@tanstack/react-query"
import type { Dispatch, SetStateAction } from "react"
import type { SetURLSearchParams } from "react-router"
import { apiClient } from "@/api/apiClient"
import { alertDialog } from "@/lib/utils"
import type { GraphDataType } from "@/types/graph"
import type { CommitNodeMenuType } from "@/components/CommitNode"
import type { TempNodeMenuType } from "@/components/TempNode"
import { editorDataToMarkdown } from "@/lib/editorMarkdown"
import type {
  BranchRecord,
  CommitRecord,
  CompareItemKind,
  SnapshotBlock,
  ViewState,
  WorkspaceRecord,
} from "@/hooks/useDocumentWorkspaceBodyState"

type SyncStatus = "idle" | "syncing" | "synced"

export type BranchEditState = {
  commitId: number
  isLastCommit: boolean
  currentBranchName: string
} | null

export type DeleteDialogState =
  | { type: "commit"; commitId: number }
  | { type: "branch"; branchId: number }
  | null

type MergeBranchState = {
  mergedData: OutputData
  suggestedName: string
} | null

function toBranchSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9가-힣-_]/g, "")
}

function createUniqueBranchName(
  sourceTitle: string,
  targetTitle: string,
  branches: BranchRecord[],
) {
  const baseName = [
    "merge",
    toBranchSlug(sourceTitle).slice(0, 18),
    toBranchSlug(targetTitle).slice(0, 18),
  ]
    .filter(Boolean)
    .join("-")

  const usedNames = new Set(branches.map((branch) => branch.name))
  if (!usedNames.has(baseName)) {
    return baseName
  }

  let suffix = 2
  while (usedNames.has(`${baseName}-${suffix}`)) {
    suffix += 1
  }

  return `${baseName}-${suffix}`
}

function updateGraphCacheAfterCommitCreate(
  graphData: GraphDataType,
  branchId: number,
  commit: GraphDataType["commits"][number],
) {
  const nextBranches = graphData.branches.map((branch) =>
    branch.id === branchId
      ? {
          ...branch,
          rootCommitId: branch.rootCommitId ?? commit.id,
          leafCommitId: commit.id,
          mergeTargetCommitId: branch.mergeTargetCommitId ?? null,
        }
      : branch,
  )

  const targetBranch = graphData.branches.find((branch) => branch.id === branchId)
  const previousCommitId = targetBranch?.leafCommitId ?? null

  const nextEdges =
    previousCommitId && previousCommitId !== commit.id
      ? [...graphData.edges, { from: previousCommitId, to: commit.id }]
      : targetBranch?.fromCommitId
        ? [...graphData.edges, { from: targetBranch.fromCommitId, to: commit.id }]
        : graphData.edges

  return {
    ...graphData,
    commits: [...graphData.commits, commit],
    edges: nextEdges,
    branches: nextBranches,
  }
}

function updateGraphCacheAfterBranchCreate(
  graphData: GraphDataType,
  branch: GraphDataType["branches"][number],
) {
  return {
    ...graphData,
    branches: [...graphData.branches, branch],
  }
}

function updateGraphCacheAfterBranchRename(
  graphData: GraphDataType,
  branchId: number,
  name: string,
) {
  return {
    ...graphData,
    branches: graphData.branches.map((branch) =>
      branch.id === branchId ? { ...branch, name } : branch,
    ),
  }
}

function updateGraphCacheAfterCommitDelete(
  graphData: GraphDataType,
  branchId: number,
  commitId: number,
) {
  const remainingCommits = graphData.commits.filter((commit) => commit.id !== commitId)
  const branchCommits = remainingCommits
    .filter((commit) => commit.branchId === branchId)
    .sort((a, b) => a.id - b.id)
  const nextLeafCommitId = branchCommits[branchCommits.length - 1]?.id ?? null

  return {
    ...graphData,
    commits: remainingCommits,
    edges: graphData.edges.filter(
      (edge) => edge.from !== commitId && edge.to !== commitId,
    ),
    branches: graphData.branches.map((branch) =>
      branch.id === branchId ? { ...branch, leafCommitId: nextLeafCommitId } : branch,
    ),
  }
}

function updateGraphCacheAfterBranchDelete(
  graphData: GraphDataType,
  branchId: number,
) {
  const removedCommitIds = new Set(
    graphData.commits
      .filter((commit) => commit.branchId === branchId)
      .map((commit) => commit.id),
  )

  return {
    ...graphData,
    branches: graphData.branches.filter((branch) => branch.id !== branchId),
    commits: graphData.commits.filter((commit) => commit.branchId !== branchId),
    edges: graphData.edges.filter(
      (edge) => !removedCommitIds.has(edge.from) && !removedCommitIds.has(edge.to),
    ),
  }
}

interface UseDocumentWorkspaceActionsParams {
  documentId: number
  isRealDocument: boolean
  branches: BranchRecord[]
  commits: CommitRecord[]
  workspaces: WorkspaceRecord[]
  view: ViewState
  setView: Dispatch<SetStateAction<ViewState>>
  setBranches: Dispatch<SetStateAction<BranchRecord[]>>
  setCommits: Dispatch<SetStateAction<CommitRecord[]>>
  setWorkspaces: Dispatch<SetStateAction<WorkspaceRecord[]>>
  searchParams: URLSearchParams
  setSearchParams: SetURLSearchParams
  currentBranch: BranchRecord | null
  currentWorkspace: WorkspaceRecord | null
  currentCommit: CommitRecord | null
  mainBranch: BranchRecord | null
  mainWorkspace: WorkspaceRecord | null
  mergeSourceItem: {
    kind: CompareItemKind
    id: number
    branchId: number
    title: string
  } | null
  mergeTargetItem: {
    kind: CompareItemKind
    id: number
    branchId: number
    title: string
  } | null
  refreshDocumentState: (params?: URLSearchParams, syncUrl?: boolean) => Promise<void>
  openWorkspaceByBranch: (branchId: number) => void
  openCommit: (branchId: number, commitId: number) => void
}

export function useDocumentWorkspaceActions({
  documentId,
  isRealDocument,
  branches,
  commits,
  workspaces,
  view,
  setView,
  setBranches,
  setCommits,
  setWorkspaces,
  searchParams,
  setSearchParams,
  currentBranch,
  currentWorkspace,
  currentCommit,
  mainBranch,
  mainWorkspace,
  mergeSourceItem,
  mergeTargetItem,
  refreshDocumentState,
  openWorkspaceByBranch,
  openCommit,
}: UseDocumentWorkspaceActionsParams) {
  const queryClient = useQueryClient()
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("synced")
  const [toast, setToast] = useState("작업장에서 문서를 편집 중입니다.")
  const [branchEditState, setBranchEditState] = useState<BranchEditState>(null)
  const [mergeBranchState, setMergeBranchState] = useState<MergeBranchState>(null)
  const [deleteDialog, setDeleteDialog] = useState<DeleteDialogState>(null)
  const [isCommitModalOpen, setIsCommitModalOpen] = useState(false)
  const [isActionPending, setIsActionPending] = useState(false)
  const syncTimerRef = useRef<number | null>(null)

  const canDeleteCurrentCommit = Boolean(
    view.mode === "commit" &&
      currentCommit &&
      currentBranch &&
      currentBranch.headCommitId === currentCommit.id &&
      currentBranch.rootCommitId !== currentCommit.id,
  )

  const handleWorkspaceChange = useCallback(
    (data: OutputData) => {
      if (!currentWorkspace || !isRealDocument) return

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
    [currentWorkspace, documentId, isRealDocument, setWorkspaces],
  )

  const handleCommitConfirm = useCallback(
    async ({ title, description }: { title: string; description?: string }) => {
      if (!currentBranch || !currentWorkspace || !isRealDocument) return

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

        queryClient.setQueryData<GraphDataType>(
          ["graphData", documentId],
          (current) =>
            current
              ? updateGraphCacheAfterCommitCreate(current, currentBranch.id, {
                  id: result.id,
                  branchId: currentBranch.id,
                  title,
                  description: description || "",
                  createdAt: new Date().toISOString(),
                })
              : current,
        )

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
      currentBranch,
      currentWorkspace,
      documentId,
      isRealDocument,
      queryClient,
      refreshDocumentState,
      setSearchParams,
    ],
  )

  const handleContinueEditClick = useCallback(
    (commitId: number) => {
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
    },
    [branches, commits],
  )

  const handleBranchEditConfirm = useCallback(
    async (branchName: string) => {
      if (!branchEditState || !isRealDocument) return

      const targetCommit = commits.find(
        (commit) => commit.id === branchEditState.commitId,
      )
      if (!targetCommit) return

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

        if (result.branchId) {
          queryClient.setQueryData<GraphDataType>(
            ["graphData", documentId],
            (current) =>
              current
                ? updateGraphCacheAfterBranchCreate(current, {
                    id: result.branchId,
                    name: branchName,
                    createdAt: new Date().toISOString(),
                    fromCommitId: targetCommit.id,
                    mergeTargetCommitId: null,
                    rootCommitId: null,
                    leafCommitId: null,
                    saveId: result.saveId ?? null,
                  })
                : current,
          )
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
      commits,
      documentId,
      isRealDocument,
      queryClient,
      refreshDocumentState,
      setSearchParams,
    ],
  )

  const handleCompareStart = useCallback(
    (kind: CompareItemKind, id: number, branchId: number) => {
      setView({
        mode: "compare",
        branchId,
        baseKind: kind,
        baseId: id,
        compareKind: null,
        compareId: null,
      })
      setToast("그래프에서 비교할 다른 기록이나 작업장을 고르세요.")
    },
    [setView],
  )

  const handleCompareTargetPick = useCallback(
    (kind: CompareItemKind, id: number) => {
      setView((prev) => {
        if (prev.mode !== "compare") return prev
        if (kind === prev.baseKind && id === prev.baseId) return prev

        return {
          mode: "compare",
          branchId: prev.branchId,
          baseKind: prev.baseKind,
          baseId: prev.baseId,
          compareKind: kind,
          compareId: id,
        }
      })
      setToast("두 버전을 나란히 비교 중입니다.")
    },
    [setView],
  )

  const handleMergeStart = useCallback(
    (kind: CompareItemKind, id: number, branchId: number) => {
      setView({
        mode: "merge",
        branchId,
        sourceKind: kind,
        sourceId: id,
        targetKind: null,
        targetId: null,
      })
      setToast("그래프에서 병합할 대상 브랜치의 기록이나 작업장을 고르세요.")
    },
    [setView],
  )

  const handleMergeTargetPick = useCallback(
    (kind: CompareItemKind, id: number) => {
      setView((prev) => {
        if (prev.mode !== "merge") return prev
        if (kind === prev.sourceKind && id === prev.sourceId) return prev

        return {
          mode: "merge",
          branchId: prev.branchId,
          sourceKind: prev.sourceKind,
          sourceId: prev.sourceId,
          targetKind: kind,
          targetId: id,
        }
      })
      setToast("병합 결과를 확인한 뒤 적용할 수 있습니다.")
    },
    [setView],
  )

  const handleDeleteCommit = useCallback(
    async (commitId: number) => {
      const targetCommit = commits.find((commit) => commit.id === commitId)
      const targetBranch = branches.find((branch) => branch.id === targetCommit?.branchId)
      if (!targetCommit || !targetBranch || !isRealDocument) return

      setIsActionPending(true)
      try {
        await apiClient.commit.deleteCommit({
          docId: documentId,
          commitId,
        })
        queryClient.setQueryData<GraphDataType>(
          ["graphData", documentId],
          (current) =>
            current
              ? updateGraphCacheAfterCommitDelete(current, targetBranch.id, commitId)
              : current,
        )
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
    [branches, commits, documentId, isRealDocument, queryClient, refreshDocumentState],
  )

  const handleDeleteBranch = useCallback(
    async (branchId: number) => {
      if (!mainWorkspace || !mainBranch || !isRealDocument) return

      const targetBranch = branches.find((branch) => branch.id === branchId)
      if (!targetBranch || targetBranch.id === mainBranch.id) return

      setIsActionPending(true)
      try {
        await apiClient.branch.deleteBranch({
          documentId,
          branchId,
        })
        queryClient.setQueryData<GraphDataType>(
          ["graphData", documentId],
          (current) =>
            current ? updateGraphCacheAfterBranchDelete(current, branchId) : current,
        )
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
      documentId,
      isRealDocument,
      mainBranch,
      mainWorkspace,
      queryClient,
      refreshDocumentState,
    ],
  )

  const commitMergeWorkspace = useCallback(
    async (mergedData: OutputData, mergeBranchName: string) => {
      const sourceItem = view.mode === "merge" ? mergeSourceItem : null
      if (!sourceItem || !mergeTargetItem || !isRealDocument) return

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
        const mergeResult = await apiClient.merge.merge({
          docId: documentId,
          mergeRequest: {
            branchName: mergeBranchName,
            baseCommitId,
            targetCommitId,
            content: (mergedData.blocks ?? []) as SnapshotBlock[],
          },
        })

        if (!mergeResult.saveId || !mergeResult.branchId) {
          throw new Error("병합 작업장을 만들지 못했습니다.")
        }

        queryClient.setQueryData<GraphDataType>(
          ["graphData", documentId],
          (current) =>
            current
              ? updateGraphCacheAfterBranchCreate(current, {
                  id: mergeResult.branchId,
                  name: mergeBranchName,
                  createdAt: new Date().toISOString(),
                  fromCommitId: baseCommitId,
                  mergeTargetCommitId: targetCommitId,
                  rootCommitId: null,
                  leafCommitId: null,
                  saveId: mergeResult.saveId ?? null,
                })
              : current,
        )

        const nextParams = new URLSearchParams({
          mode: "save",
          saveId: String(mergeResult.saveId),
        })
        await refreshDocumentState(nextParams, false)
        setSearchParams(nextParams, { replace: true })
        setToast(`${mergeBranchName} 작업장을 새로 만들었습니다.`)
        setMergeBranchState(null)
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
      documentId,
      isRealDocument,
      mergeSourceItem,
      mergeTargetItem,
      queryClient,
      refreshDocumentState,
      setSearchParams,
      view,
    ],
  )

  const handleDirectMerge = useCallback(
    async (mergedData: OutputData) => {
      const sourceItem = view.mode === "merge" ? mergeSourceItem : null
      if (!sourceItem || !mergeTargetItem) return

      const suggestedName = createUniqueBranchName(
        sourceItem.title,
        mergeTargetItem.title,
        branches,
      )

      setMergeBranchState({
        mergedData,
        suggestedName,
      })
    },
    [branches, mergeSourceItem, mergeTargetItem, view.mode],
  )

  const handleMergeBranchConfirm = useCallback(
    async (branchName: string) => {
      if (!mergeBranchState) return
      await commitMergeWorkspace(mergeBranchState.mergedData, branchName)
    },
    [commitMergeWorkspace, mergeBranchState],
  )

  const handleGraphNodeMenuClick = useCallback(
    (type: CommitNodeMenuType | TempNodeMenuType, targetId: number) => {
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
        }
      }
    },
    [
      branches,
      commits,
      handleCompareStart,
      handleContinueEditClick,
      handleMergeStart,
      openCommit,
      openWorkspaceByBranch,
    ],
  )

  const handleBranchRename = useCallback(
    async (branchId: number, newName: string) => {
      if (!isRealDocument) return

      setIsActionPending(true)
      try {
        await apiClient.branch.renameBranch({
          documentId,
          branchId,
          branchRenameRequest: {
            name: newName,
          },
        })
        queryClient.setQueryData<GraphDataType>(
          ["graphData", documentId],
          (current) =>
            current
              ? updateGraphCacheAfterBranchRename(current, branchId, newName)
              : current,
        )
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
    [documentId, isRealDocument, queryClient, refreshDocumentState, searchParams],
  )

  const dispose = useCallback(() => {
    if (syncTimerRef.current) {
      window.clearTimeout(syncTimerRef.current)
    }
  }, [])

  return {
    syncStatus,
    toast,
    setToast,
    branchEditState,
    setBranchEditState,
    mergeBranchState,
    setMergeBranchState,
    deleteDialog,
    setDeleteDialog,
    isCommitModalOpen,
    setIsCommitModalOpen,
    isActionPending,
    canDeleteCurrentCommit,
    handleWorkspaceChange,
    handleCommitConfirm,
    handleContinueEditClick,
    handleBranchEditConfirm,
    handleCompareStart,
    handleCompareTargetPick,
    handleMergeStart,
    handleMergeTargetPick,
    handleDeleteCommit,
    handleDeleteBranch,
    handleDirectMerge,
    handleMergeBranchConfirm,
    handleGraphNodeMenuClick,
    handleBranchRename,
    dispose,
  }
}
