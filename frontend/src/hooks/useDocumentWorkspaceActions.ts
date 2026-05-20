import type { ThumbnailSyncResponse } from "@/api/__generated__"
import { apiClient } from "@/api/apiClient"
import type { CommitNodeMenuType } from "@/components/CommitNode"
import type { TempNodeMenuType } from "@/components/TempNode"
import { useDialog } from "@/components/ui/alert-dialog"
import type {
  BranchRecord,
  CommitRecord,
  CompareItemKind,
  SnapshotBlock,
  ViewState,
  WorkspaceRecord,
} from "@/hooks/useDocumentWorkspaceBodyState"
import { getApiErrorMessage } from "@/lib/apiError"
import { generateDocumentThumbnailArtifact } from "@/lib/documentThumbnails"
import { editorDataToMarkdown } from "@/lib/editorMarkdown"
import { alertDialog } from "@/lib/utils"
import type { GraphDataType } from "@/types/graph"
import type { OutputData } from "@editorjs/editorjs"
import { useQueryClient } from "@tanstack/react-query"
import { useCallback, useRef, useState } from "react"
import type { Dispatch, SetStateAction } from "react"
import type { SetURLSearchParams } from "react-router"

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

type PendingWorkspaceSave = {
  saveId: number
  blocks: SnapshotBlock[]
}

async function syncDocumentThumbnail({
  documentId,
  blocks,
  thumbnail,
}: {
  documentId: number
  blocks: SnapshotBlock[]
  thumbnail: ThumbnailSyncResponse | undefined
}) {
  if (typeof thumbnail?.requestToken !== "number") {
    return
  }

  const artifact = await generateDocumentThumbnailArtifact({ blocks })
  if (!artifact) {
    return
  }

  if (thumbnail.signature === artifact.signature) {
    return
  }

  const uploaded = await apiClient.image.uploadDocumentThumbnail({
    docId: documentId,
    file: artifact.file,
  })

  await apiClient.thumbnail.finalizeDocumentThumbnail(documentId, {
    imageId: uploaded.imageId,
    requestToken: thumbnail.requestToken,
    signature: artifact.signature,
  })
}

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

  const targetBranch = graphData.branches.find(
    (branch) => branch.id === branchId,
  )
  const previousCommitId = targetBranch?.leafCommitId ?? null

  const nextEdges = [...graphData.edges]
  const edgeKeys = new Set(nextEdges.map((edge) => `${edge.from}-${edge.to}`))

  const addEdge = (fromCommitId: number | null | undefined) => {
    if (!fromCommitId || fromCommitId === commit.id) return
    const edgeKey = `${fromCommitId}-${commit.id}`
    if (edgeKeys.has(edgeKey)) return
    edgeKeys.add(edgeKey)
    nextEdges.push({ from: fromCommitId, to: commit.id })
  }

  if (previousCommitId && previousCommitId !== commit.id) {
    addEdge(previousCommitId)
  } else {
    addEdge(targetBranch?.fromCommitId)
    addEdge(targetBranch?.mergeTargetCommitId)
  }

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
  const remainingCommits = graphData.commits.filter(
    (commit) => commit.id !== commitId,
  )
  const branchCommits = remainingCommits
    .filter((commit) => commit.branchId === branchId)
    .sort((a, b) => a.id - b.id)
  const nextRootCommitId = branchCommits[0]?.id ?? null
  const nextLeafCommitId = branchCommits[branchCommits.length - 1]?.id ?? null

  return {
    ...graphData,
    commits: remainingCommits,
    edges: graphData.edges.filter(
      (edge) => edge.from !== commitId && edge.to !== commitId,
    ),
    branches: graphData.branches.map((branch) =>
      branch.id === branchId
        ? {
            ...branch,
            fromCommitId:
              branch.fromCommitId === commitId ? null : branch.fromCommitId,
            mergeTargetCommitId:
              branch.mergeTargetCommitId === commitId
                ? null
                : branch.mergeTargetCommitId,
            rootCommitId: nextRootCommitId,
            leafCommitId: nextLeafCommitId,
          }
        : {
            ...branch,
            fromCommitId:
              branch.fromCommitId === commitId ? null : branch.fromCommitId,
            mergeTargetCommitId:
              branch.mergeTargetCommitId === commitId
                ? null
                : branch.mergeTargetCommitId,
            rootCommitId:
              branch.rootCommitId === commitId ? null : branch.rootCommitId,
            leafCommitId:
              branch.leafCommitId === commitId ? null : branch.leafCommitId,
          },
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
      (edge) =>
        !removedCommitIds.has(edge.from) && !removedCommitIds.has(edge.to),
    ),
  }
}

function updateBranchRecordsAfterCommitDelete(
  branches: BranchRecord[],
  commits: CommitRecord[],
  branchId: number,
  commitId: number,
) {
  const remainingBranchCommits = commits
    .filter((commit) => commit.branchId === branchId && commit.id !== commitId)
    .sort((a, b) => a.id - b.id)

  const nextRootCommitId = remainingBranchCommits[0]?.id ?? null
  const nextHeadCommitId =
    remainingBranchCommits[remainingBranchCommits.length - 1]?.id ?? null

  return branches.map((branch) =>
    branch.id === branchId
      ? {
          ...branch,
          rootCommitId: nextRootCommitId,
          headCommitId: nextHeadCommitId,
        }
      : branch,
  )
}

function removeCommitRecord(commits: CommitRecord[], commitId: number) {
  return commits.filter((commit) => commit.id !== commitId)
}

function removeBranchRecords(
  branches: BranchRecord[],
  commits: CommitRecord[],
  workspaces: WorkspaceRecord[],
  branchId: number,
) {
  return {
    branches: branches.filter((branch) => branch.id !== branchId),
    commits: commits.filter((commit) => commit.branchId !== branchId),
    workspaces: workspaces.filter(
      (workspace) => workspace.branchId !== branchId,
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
  updateGraphData: (updater: (current: GraphDataType) => GraphDataType) => void
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
  refreshDocumentState: (
    params?: URLSearchParams,
    syncUrl?: boolean,
  ) => Promise<void>
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
  updateGraphData,
  mergeSourceItem,
  mergeTargetItem,
  refreshDocumentState,
  openWorkspaceByBranch,
  openCommit,
}: UseDocumentWorkspaceActionsParams) {
  const { showAlertDialog } = useDialog()
  const queryClient = useQueryClient()
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("synced")
  const [toast, setToast] = useState("")
  const [branchEditState, setBranchEditState] = useState<BranchEditState>(null)
  const [mergeBranchState, setMergeBranchState] =
    useState<MergeBranchState>(null)
  const [deleteDialog, setDeleteDialog] = useState<DeleteDialogState>(null)
  const [isCommitModalOpen, setIsCommitModalOpen] = useState(false)
  const [isActionPending, setIsActionPending] = useState(false)
  const syncTimerRef = useRef<number | null>(null)
  const pendingSaveRef = useRef<PendingWorkspaceSave | null>(null)
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve())

  const canDeleteCurrentCommit = Boolean(
    view.mode === "commit" &&
      currentCommit &&
      currentBranch &&
      currentBranch.headCommitId === currentCommit.id,
  )

  const persistWorkspaceBlocks = useCallback(
    (saveId: number, blocks: SnapshotBlock[]) => {
      const saveRequest = saveQueueRef.current
        .catch(() => undefined)
        .then(async () => {
          const saveResponse = await apiClient.save.updateSave({
            docId: documentId,
            saveId,
            saveUpdateRequest: {
              content: blocks,
            },
          })

          void syncDocumentThumbnail({
            documentId,
            blocks,
            thumbnail: saveResponse.thumbnail,
          })
            .then(() => {
              void queryClient.invalidateQueries({ queryKey: ["documents"] })
            })
            .catch((error) => {
              console.warn("문서 썸네일 동기화에 실패했습니다.", error)
            })

          queryClient.setQueryData(
            ["snapshotContent", documentId, "workspace", saveId],
            blocks,
          )

          if (
            pendingSaveRef.current?.saveId === saveId &&
            pendingSaveRef.current.blocks === blocks
          ) {
            pendingSaveRef.current = null
          }
        })

      saveQueueRef.current = saveRequest
      return saveRequest
    },
    [documentId, queryClient],
  )

  const handleWorkspaceChange = useCallback(
    (data: OutputData) => {
      if (!currentWorkspace || !isRealDocument) return

      const nextBlocks = (data.blocks ?? []) as SnapshotBlock[]
      const nextContent = editorDataToMarkdown(data)
      pendingSaveRef.current = {
        saveId: currentWorkspace.id,
        blocks: nextBlocks,
      }

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
        syncTimerRef.current = null

        try {
          await persistWorkspaceBlocks(currentWorkspace.id, nextBlocks)

          if (!pendingSaveRef.current) {
            setSyncStatus("synced")
            setToast("자동 저장됨")
          }
        } catch (error: any) {
          setSyncStatus("idle")
          await alertDialog(
            await getApiErrorMessage(
              error,
              "워크스페이스 자동 저장에 실패했습니다.",
            ),
            "오류",
            "destructive",
          )
        }
      }, 700)
    },
    [currentWorkspace, isRealDocument, persistWorkspaceBlocks, setWorkspaces],
  )

  const handleCommitConfirm = useCallback(
    async ({ title, description }: { title: string; description?: string }) => {
      if (!currentBranch || !currentWorkspace || !isRealDocument) return

      setIsActionPending(true)
      try {
        if (syncTimerRef.current) {
          window.clearTimeout(syncTimerRef.current)
          syncTimerRef.current = null
        }

        const currentBlocks =
          pendingSaveRef.current?.saveId === currentWorkspace.id
            ? pendingSaveRef.current.blocks
            : currentWorkspace.blocks

        await persistWorkspaceBlocks(currentWorkspace.id, currentBlocks)
        setSyncStatus("synced")

        const result = await apiClient.commit.createCommit({
          docId: documentId,
          createCommitRequest: {
            title,
            description,
            blocks: currentBlocks,
            blockOrders: currentBlocks.map(
              (block, index) => block.id ?? String(index),
            ),
            branchId: currentBranch.id,
          },
        })

        if (!result.id) {
          throw new Error("기록 ID가 없습니다.")
        }

        updateGraphData((current) =>
          updateGraphCacheAfterCommitCreate(current, currentBranch.id, {
            id: result.id,
            branchId: currentBranch.id,
            title,
            description: description || "",
            createdAt: new Date().toISOString(),
          }),
        )

        setIsCommitModalOpen(false)
        const nextParams = new URLSearchParams({
          mode: "save",
          saveId: String(currentWorkspace.id),
        })
        await refreshDocumentState(nextParams, false)
        setWorkspaces((prev) =>
          prev.map((workspace) =>
            workspace.id === currentWorkspace.id
              ? {
                  ...workspace,
                  content: editorDataToMarkdown({
                    time: Date.now(),
                    version: "2.30.8",
                    blocks: currentBlocks,
                  }),
                  blocks: currentBlocks,
                  loaded: true,
                }
              : workspace,
          ),
        )
        setSearchParams(nextParams, { replace: true })
        setToast("기록 생성됨")
      } catch (error: any) {
        await alertDialog(
          await getApiErrorMessage(error, "기록 생성에 실패했습니다."),
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
      persistWorkspaceBlocks,
      refreshDocumentState,
      setSearchParams,
      setWorkspaces,
      updateGraphData,
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
          throw new Error("워크스페이스를 만들지 못했습니다.")
        }

        if (result.branchId) {
          updateGraphData((current) =>
            updateGraphCacheAfterBranchCreate(current, {
              id: result.branchId,
              name: branchName,
              createdAt: new Date().toISOString(),
              fromCommitId: targetCommit.id,
              mergeTargetCommitId: null,
              rootCommitId: null,
              leafCommitId: null,
              saveId: result.saveId ?? null,
            }),
          )
        }

        const nextParams = new URLSearchParams({
          mode: "save",
          saveId: String(result.saveId),
        })
        await refreshDocumentState(nextParams, false)
        setSearchParams(nextParams, { replace: true })
        setToast("새 브랜치 열림")
      } catch (error: any) {
        await alertDialog(
          await getApiErrorMessage(error, "브랜치 생성에 실패했습니다."),
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
      refreshDocumentState,
      setSearchParams,
      updateGraphData,
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
      setToast("비교할 브랜치 선택")
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
      setToast("브랜치 비교 중")
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
      setToast("병합할 브랜치 선택")
    },
    [setView],
  )

  const handleMergeTargetPick = useCallback(
    (kind: CompareItemKind, id: number) => {
      if (kind === "workspace") {
        void alertDialog(
          "워크스페이스는 기록으로 남긴 뒤 브랜치 병합할 수 있습니다.",
          "선택 불가",
        )
        return
      }

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
      setToast("브랜치 병합 미리보기")
    },
    [setView],
  )

  const handleDeleteCommit = useCallback(
    async (commitId: number) => {
      const targetCommit = commits.find((commit) => commit.id === commitId)
      const targetBranch = branches.find(
        (branch) => branch.id === targetCommit?.branchId,
      )
      if (!targetCommit || !targetBranch || !isRealDocument) return

      setIsActionPending(true)
      try {
        await apiClient.commit.deleteCommit({
          docId: documentId,
          commitId,
        })
        updateGraphData((current) =>
          updateGraphCacheAfterCommitDelete(current, targetBranch.id, commitId),
        )
        setCommits((prev) => removeCommitRecord(prev, commitId))
        setBranches((prev) =>
          updateBranchRecordsAfterCommitDelete(
            prev,
            commits,
            targetBranch.id,
            commitId,
          ),
        )
        setDeleteDialog(null)

        const nextParams = targetBranch.saveId
          ? new URLSearchParams({
              mode: "save",
              saveId: String(targetBranch.saveId),
            })
          : new URLSearchParams()

        if (targetBranch.saveId) {
          setSearchParams(nextParams, { replace: true })
        }
        void queryClient.refetchQueries({
          queryKey: ["graphData", documentId],
          type: "active",
        })
        setToast(`기록 "${targetCommit.title}"을 삭제했습니다.`)
      } catch (error: any) {
        await alertDialog(
          await getApiErrorMessage(error, "기록 삭제에 실패했습니다."),
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
      setBranches,
      setCommits,
      setSearchParams,
      queryClient,
      updateGraphData,
    ],
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
        updateGraphData((current) =>
          updateGraphCacheAfterBranchDelete(current, branchId),
        )
        const nextLocalState = removeBranchRecords(
          branches,
          commits,
          workspaces,
          branchId,
        )
        setBranches(nextLocalState.branches)
        setCommits(nextLocalState.commits)
        setWorkspaces(nextLocalState.workspaces)
        setDeleteDialog(null)

        const nextParams = mainWorkspace?.id
          ? new URLSearchParams({
              mode: "save",
              saveId: String(mainWorkspace.id),
            })
          : new URLSearchParams()

        if (mainWorkspace?.id) {
          setSearchParams(nextParams, { replace: true })
        }
        void queryClient.refetchQueries({
          queryKey: ["graphData", documentId],
          type: "active",
        })
        setToast("브랜치 삭제됨")
      } catch (error: any) {
        await showAlertDialog(
          await getApiErrorMessage(error, "브랜치 삭제에 실패했습니다."),
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
      setBranches,
      setCommits,
      setSearchParams,
      setWorkspaces,
      queryClient,
      updateGraphData,
      workspaces,
      showAlertDialog,
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
          throw new Error("병합 워크스페이스를 만들지 못했습니다.")
        }

        const mergedSaveId = mergeResult.saveId
        const mergedBranchId = mergeResult.branchId
        const mergedBlocks = (mergedData.blocks ?? []) as SnapshotBlock[]

        updateGraphData((current) =>
          updateGraphCacheAfterBranchCreate(current, {
            id: mergedBranchId,
            name: mergeBranchName,
            createdAt: new Date().toISOString(),
            fromCommitId: baseCommitId,
            mergeTargetCommitId: targetCommitId,
            rootCommitId: null,
            leafCommitId: null,
            saveId: mergedSaveId,
          }),
        )
        queryClient.setQueryData(
          ["snapshotContent", documentId, "workspace", mergedSaveId],
          mergedBlocks,
        )
        setWorkspaces((prev) => {
          const nextWorkspace: WorkspaceRecord = {
            id: mergedSaveId,
            branchId: mergedBranchId,
            content: editorDataToMarkdown({
              time: Date.now(),
              version: "2.30.8",
              blocks: mergedBlocks,
            }),
            blocks: mergedBlocks,
            loaded: true,
          }

          if (prev.some((workspace) => workspace.id === nextWorkspace.id)) {
            return prev.map((workspace) =>
              workspace.id === nextWorkspace.id ? nextWorkspace : workspace,
            )
          }

          return [...prev, nextWorkspace]
        })

        const nextParams = new URLSearchParams({
          mode: "save",
          saveId: String(mergedSaveId),
        })
        setView({
          mode: "workspace",
          branchId: mergedBranchId,
          workspaceId: mergedSaveId,
        })
        await refreshDocumentState(nextParams, false)
        setSearchParams(nextParams, { replace: true })
        setToast("병합 브랜치 생성됨")
        setMergeBranchState(null)
      } catch (error: any) {
        await alertDialog(
          await getApiErrorMessage(error, "병합 적용에 실패했습니다."),
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
      setView,
      setWorkspaces,
      updateGraphData,
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
            newName,
          },
        })
        updateGraphData((current) =>
          updateGraphCacheAfterBranchRename(current, branchId, newName),
        )
        await refreshDocumentState(searchParams, false)
        setToast(`${newName} 브랜치 이름으로 변경했습니다.`)
      } catch (error: any) {
        await alertDialog(
          await getApiErrorMessage(error, "브랜치 이름 변경에 실패했습니다."),
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
      updateGraphData,
    ],
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
