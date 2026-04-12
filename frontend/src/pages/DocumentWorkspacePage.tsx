import BranchEditModal from "@/components/BranchEditModal"
import DocumentCompareView from "@/components/DocumentCompareView"
import DocumentEditor from "@/components/DocumentEditor"
import DocumentMergeView from "@/components/DocumentMergeView"
import DocumentSidebarQuickMenu from "@/components/DocumentSidebarQuickMenu"
import DocumentWorkspaceGraphPanel from "@/components/DocumentWorkspaceGraphPanel"
import SaveCommitModal from "@/components/SaveCommitModal"
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
import { Button } from "@/components/ui/button"
import { useDocumentContent } from "@/hooks/useDocumentContent"
import { useDocumentWorkspaceActions } from "@/hooks/useDocumentWorkspaceActions"
import {
  createOutputData,
  useDocumentWorkspaceBodyState,
} from "@/hooks/useDocumentWorkspaceBodyState"
import { useDocumentWorkspaceGraphState } from "@/hooks/useDocumentWorkspaceGraphState"
import { useDocumentWorkspaceReviewState } from "@/hooks/useDocumentWorkspaceReviewState"
import ResizableLayout from "@/layouts/ResizableLayout"
import type { GraphDataType } from "@/types/graph"
import {
  CircleCheck,
  CloudOff,
  GitCommitHorizontal,
  GitCompareArrows,
  GitMerge,
  Loader2,
  PanelLeftClose,
  PanelLeftOpen,
  Play,
  Trash2,
  X,
} from "lucide-react"
import { useEffect, useState } from "react"
import { useParams, useSearchParams } from "react-router"

function useDelayedFlag(value: boolean, delayMs = 180) {
  const [isDelayed, setIsDelayed] = useState(false)

  useEffect(() => {
    if (!value) {
      setIsDelayed(false)
      return
    }

    const timer = window.setTimeout(() => setIsDelayed(true), delayMs)
    return () => window.clearTimeout(timer)
  }, [delayMs, value])

  return isDelayed
}

function DocumentPendingCanvas({
  label,
  visible,
  compact = false,
}: {
  label: string
  visible: boolean
  compact?: boolean
}) {
  return (
    <div className="h-full min-h-[760px] bg-white px-16 py-14">
      <div
        className={`mx-auto max-w-3xl transition-opacity duration-200 ${
          visible ? "opacity-100" : "opacity-0"
        }`}
      >
        <div className="mb-10 flex items-center gap-3 text-xs font-medium text-slate-400">
          <span className="h-2 w-2 rounded-full bg-slate-300" />
          {label}
        </div>
        <div className="space-y-5">
          <div className="h-7 w-2/5 rounded-full bg-slate-100" />
          <div className="h-4 w-full rounded-full bg-slate-100" />
          <div className="h-4 w-11/12 rounded-full bg-slate-100" />
          <div className="h-4 w-4/5 rounded-full bg-slate-100" />
          {!compact ? (
            <>
              <div className="mt-8 h-4 w-10/12 rounded-full bg-slate-100" />
              <div className="h-4 w-7/12 rounded-full bg-slate-100" />
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function WorkspaceAutosaveStatus({
  status,
}: {
  status: "idle" | "syncing" | "synced"
}) {
  const isSyncing = status === "syncing"
  const isSynced = status === "synced"

  return (
    <div
      className={`flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold shadow-sm transition-colors ${
        isSyncing
          ? "border-amber-200 bg-amber-50 text-amber-700"
          : isSynced
            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
            : "border-red-200 bg-red-50 text-red-700"
      }`}
    >
      {isSyncing ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : isSynced ? (
        <CircleCheck className="h-4 w-4" />
      ) : (
        <CloudOff className="h-4 w-4" />
      )}
      <span className="whitespace-nowrap">
        {isSyncing
          ? "워크스페이스 저장 중"
          : isSynced
            ? "워크스페이스 저장됨"
            : "저장 확인 필요"}
      </span>
    </div>
  )
}

export default function DocumentWorkspacePage() {
  const { id: documentIdParam } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const [isGraphCollapsed, setIsGraphCollapsed] = useState(false)
  const queryDocumentId = Number(documentIdParam || 0)
  const isRealDocument = Number.isFinite(queryDocumentId) && queryDocumentId > 0
  const documentId = isRealDocument ? queryDocumentId : 0

  const requestedMode = searchParams.get("mode")
  const requestedSaveId =
    requestedMode === "save" ? Number(searchParams.get("saveId") || 0) : 0
  const requestedCommitId =
    requestedMode === "commit" ? Number(searchParams.get("commitId") || 0) : 0
  const requestedDocumentMode =
    requestedMode === "save" || requestedMode === "commit"
      ? requestedMode
      : null

  const {
    graphQuery,
    graphData,
    updateGraphData,
    mainBranch,
    isInitialLoading,
  } = useDocumentWorkspaceGraphState(documentId)

  const directSelectedContent = useDocumentContent({
    documentMode: (requestedDocumentMode ?? "save") as "save" | "commit",
    commitId: requestedCommitId ? String(requestedCommitId) : null,
    saveId: requestedSaveId ? String(requestedSaveId) : null,
    compareId: null,
    documentId,
    currentBranchLastCommitId: null,
  })

  const {
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
  } = useDocumentWorkspaceBodyState({
    documentId,
    isRealDocument,
    searchParams,
    setSearchParams,
    graphQuery,
    directSelectedData: directSelectedContent.originalData,
    requestedDocumentMode,
    requestedSaveId,
    requestedCommitId,
  })

  const {
    compareBaseItem,
    compareTargetItem,
    compareBaseData,
    compareTargetData,
    compareBaseSnapshotQuery,
    compareTargetSnapshotQuery,
    compareBaseReady,
    compareTargetReady,
    mergeSourceItem,
    mergeTargetItem,
    mergeSourceData,
    mergeTargetData,
    mergeSourceSnapshotQuery,
    mergeTargetSnapshotQuery,
    mergeBaseReady,
    mergeTargetReady,
  } = useDocumentWorkspaceReviewState({
    documentId,
    isRealDocument,
    view,
    branches,
    commits,
    workspaces,
  })

  const derivedMainWorkspace = mainBranch?.id
    ? (workspaces.find((workspace) => workspace.branchId === mainBranch.id) ??
      null)
    : null

  const {
    syncStatus,
    toast,
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
  } = useDocumentWorkspaceActions({
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
    mainWorkspace: derivedMainWorkspace,
    updateGraphData,
    mergeSourceItem: mergeSourceItem
      ? {
          kind: mergeSourceItem.kind,
          id: mergeSourceItem.id,
          branchId: mergeSourceItem.branchId,
          title: mergeSourceItem.title,
        }
      : null,
    mergeTargetItem: mergeTargetItem
      ? {
          kind: mergeTargetItem.kind,
          id: mergeTargetItem.id,
          branchId: mergeTargetItem.branchId,
          title: mergeTargetItem.title,
        }
      : null,
    refreshDocumentState,
    openWorkspaceByBranch,
    openCommit,
  })

  useEffect(() => dispose, [dispose])

  const rightTitle =
    view.mode === "workspace"
      ? `${currentBranch?.name ?? "branch"} 워크스페이스`
      : view.mode === "compare"
        ? "기록 비교"
        : view.mode === "merge"
          ? "기록 병합"
          : `${currentBranch?.name ?? "branch"} 기록`

  const isCurrentWorkspaceContentReady =
    view.mode === "workspace" &&
    currentWorkspace?.loaded &&
    requestedDocumentMode === "save" &&
    requestedSaveId === currentWorkspace.id &&
    directSelectedContent.isCurrentDataReady

  const isCurrentCommitContentReady =
    view.mode === "commit" &&
    currentCommit?.loaded &&
    requestedDocumentMode === "commit" &&
    requestedCommitId === currentCommit.id &&
    directSelectedContent.isCurrentDataReady

  const showDirectContentPending = useDelayedFlag(
    (view.mode === "workspace" && !isCurrentWorkspaceContentReady) ||
      (view.mode === "commit" && !isCurrentCommitContentReady),
  )
  const showReviewContentPending = useDelayedFlag(
    view.mode === "compare"
      ? !compareBaseReady ||
          Boolean(compareBaseItem && view.compareId && !compareTargetReady)
      : view.mode === "merge"
        ? !mergeBaseReady ||
          Boolean(mergeSourceItem && view.targetId && !mergeTargetReady)
        : false,
  )

  const graphMainBranch =
    mainBranch ??
    ({
      id: 0,
      name: "main",
      createdAt: new Date().toISOString(),
      fromCommitId: null,
      mergeTargetCommitId: null,
      rootCommitId: null,
      leafCommitId: null,
      saveId: null,
    } satisfies GraphDataType["branches"][number])

  if (!isRealDocument) {
    return (
      <div className="flex h-full min-h-0 w-full items-center justify-center bg-slate-100 text-sm text-slate-500">
        문서 경로가 올바르지 않습니다.
      </div>
    )
  }

  if (
    !hasBootstrapped &&
    (graphQuery.isLoading || isHydrating || !graphQuery.data)
  ) {
    return (
      <div className="flex h-full min-h-0 w-full items-center justify-center bg-slate-100 text-sm text-slate-500">
        문서 흐름을 불러오는 중입니다...
      </div>
    )
  }

  if (!hasBootstrapped && graphQuery.error) {
    return (
      <div className="flex h-full min-h-0 w-full items-center justify-center bg-slate-100 text-sm text-red-500">
        문서 흐름을 불러오지 못했습니다.
      </div>
    )
  }

  return (
    <>
      <div className="h-full min-h-0 w-full overflow-hidden bg-slate-100">
        <ResizableLayout
          initialWidth={450}
          minWidth={340}
          maxWidth={860}
          isSidebarCollapsed={isGraphCollapsed}
          collapsedWidth={58}
          collapsedSidebar={
            <div className="flex h-full min-h-0 items-start justify-center bg-slate-100 p-3">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-10 w-10 rounded-2xl border-slate-200 bg-white shadow-sm"
                title="그래프 열기"
                onClick={() => setIsGraphCollapsed(false)}
              >
                <PanelLeftOpen className="h-4 w-4" />
              </Button>
            </div>
          }
          className="h-full min-h-0"
          sidebarClassName="h-full min-h-0"
          mainClassName="h-full min-h-0 bg-slate-100"
        >
          <div className="relative h-full min-h-0">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="absolute right-6 top-6 z-30 h-9 w-9 rounded-2xl border-slate-200 bg-white/95 shadow-sm backdrop-blur"
              title="그래프 접기"
              onClick={() => setIsGraphCollapsed(true)}
            >
              <PanelLeftClose className="h-4 w-4" />
            </Button>
            <DocumentWorkspaceGraphPanel
              graphData={graphData}
              mainBranch={graphMainBranch}
              isInitialLoading={isInitialLoading}
              hasError={Boolean(graphQuery.error)}
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
              }}
              onBranchDelete={(branchId) =>
                setDeleteDialog({ type: "branch", branchId })
              }
              onBranchRename={handleBranchRename}
              compareSelection={
                view.mode === "compare"
                  ? {
                      active: true,
                      baseKind: view.baseKind,
                      baseId: view.baseId,
                      targetKind: view.compareKind,
                      targetId: view.compareId,
                    }
                  : null
              }
              mergeSelection={
                view.mode === "merge"
                  ? {
                      active: true,
                      sourceKind: view.sourceKind,
                      sourceId: view.sourceId,
                      targetKind: view.targetKind,
                      targetId: view.targetId,
                    }
                  : null
              }
              onCompareTargetPick={handleCompareTargetPick}
              onMergeTargetPick={handleMergeTargetPick}
            />
          </div>

          <div className="h-full min-h-0 bg-slate-100 p-3">
            <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <DocumentSidebarQuickMenu currentDocumentId={documentId} />
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
                    {view.mode === "workspace" && toast ? (
                      <p className="truncate text-xs text-slate-500">{toast}</p>
                    ) : null}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {view.mode === "workspace" ? (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          currentWorkspace &&
                          handleCompareStart(
                            "workspace",
                            currentWorkspace.id,
                            view.branchId,
                          )
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
                          handleMergeStart(
                            "commit",
                            currentCommit.id,
                            currentCommit.branchId,
                          )
                        }
                      >
                        <GitMerge className="h-4 w-4" /> 병합하기
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          handleCompareStart(
                            "commit",
                            currentCommit.id,
                            currentCommit.branchId,
                          )
                        }
                      >
                        <GitCompareArrows className="h-4 w-4" /> 비교하기
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          handleContinueEditClick(currentCommit.id)
                        }
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
                          ? openCommit(
                              compareBaseItem.branchId,
                              compareBaseItem.id,
                            )
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
                          ? openCommit(
                              mergeSourceItem.branchId,
                              mergeSourceItem.id,
                            )
                          : openWorkspaceByBranch(mergeSourceItem.branchId)
                      }
                    >
                      <X className="h-4 w-4" /> 병합 종료
                    </Button>
                  ) : null}
                  {view.mode === "workspace" ? (
                    <WorkspaceAutosaveStatus status={syncStatus} />
                  ) : null}
                </div>
              </div>

              <div
                className={`flex-1 overflow-auto ${
                  view.mode === "compare"
                    ? "bg-slate-50 p-4"
                    : "bg-white px-5 py-4"
                }`}
              >
                {view.mode === "workspace" ? (
                  isCurrentWorkspaceContentReady ? (
                    <div className="h-full min-h-[760px]">
                      <DocumentEditor
                        key={`workspace-${currentWorkspace.id}`}
                        isEditable={true}
                        initialData={createOutputData(currentWorkspace.blocks)}
                        onDataChange={handleWorkspaceChange}
                        disableAutoUpdate={true}
                        minimalChrome={true}
                        contentLayout="document"
                      />
                    </div>
                  ) : directSelectedContent.error ? (
                    <div className="flex h-full min-h-[760px] items-center justify-center text-sm text-red-500">
                      선택한 워크스페이스를 불러오지 못했습니다.
                    </div>
                  ) : (
                    <DocumentPendingCanvas
                      label="워크스페이스 준비 중"
                      visible={showDirectContentPending}
                    />
                  )
                ) : view.mode === "commit" ? (
                  isCurrentCommitContentReady ? (
                    <div className="h-full min-h-[760px]">
                      <DocumentEditor
                        key={`commit-${currentCommit.id}`}
                        isEditable={false}
                        initialData={createOutputData(currentCommit.blocks)}
                        minimalChrome={true}
                        contentLayout="document"
                      />
                    </div>
                  ) : directSelectedContent.error ? (
                    <div className="flex h-full min-h-[760px] items-center justify-center text-sm text-red-500">
                      선택한 기록을 불러오지 못했습니다.
                    </div>
                  ) : (
                    <DocumentPendingCanvas
                      label="기록 내용을 준비하는 중"
                      visible={showDirectContentPending}
                    />
                  )
                ) : view.mode === "merge" ? (
                  mergeBaseReady &&
                  mergeTargetReady &&
                  (!isRealDocument ||
                    (!mergeSourceSnapshotQuery.isLoading &&
                      !mergeTargetSnapshotQuery.isLoading)) ? (
                    <div className="h-full min-h-[760px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                      <DocumentMergeView
                        baseData={mergeSourceData}
                        targetData={mergeTargetData}
                        baseLabel={mergeSourceItem?.title ?? "병합 원본"}
                        targetLabel={mergeTargetItem?.title ?? "병합 대상"}
                        title="기록 병합"
                        className="h-full"
                        onCancel={() =>
                          mergeSourceItem?.kind === "commit"
                            ? openCommit(
                                mergeSourceItem.branchId,
                                mergeSourceItem.id,
                              )
                            : openWorkspaceByBranch(mergeSourceItem.branchId)
                        }
                        onSave={handleDirectMerge}
                      />
                    </div>
                  ) : mergeBaseReady ? (
                    <div className="grid h-full min-h-[760px] grid-cols-[minmax(0,1fr)_360px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                      <div className="min-h-0 border-r border-slate-200 bg-white px-5 py-4">
                        <div className="mb-3">
                          <p className="text-sm font-semibold text-slate-900">
                            {mergeSourceItem?.title ?? "병합 원본"}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            그래프에서 병합 대상을 선택하세요.
                          </p>
                        </div>
                        <div className="h-full min-h-[680px]">
                          <DocumentEditor
                            key={`merge-source-${mergeSourceItem?.id ?? "empty"}`}
                            isEditable={false}
                            initialData={
                              mergeSourceData ?? createOutputData([])
                            }
                            minimalChrome={true}
                            contentLayout="document"
                          />
                        </div>
                      </div>
                      <div className="flex min-h-0 flex-col justify-center bg-slate-50 px-8 py-6">
                        <p className="text-sm font-semibold text-slate-900">
                          병합할 대상을 선택하세요
                        </p>
                        <p className="mt-2 text-sm leading-6 text-slate-500">
                          그래프에서 다른 기록이나 워크스페이스를 선택하세요.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="h-full min-h-[760px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                      <DocumentPendingCanvas
                        label={
                          view.targetId
                            ? "병합 대상 준비 중"
                            : "병합 기준 준비 중"
                        }
                        visible={showReviewContentPending}
                        compact
                      />
                    </div>
                  )
                ) : compareTargetItem &&
                  compareBaseReady &&
                  compareTargetReady &&
                  (!isRealDocument ||
                    (!compareBaseSnapshotQuery.isLoading &&
                      !compareTargetSnapshotQuery.isLoading)) ? (
                  <DocumentCompareView
                    leftData={compareBaseData}
                    rightData={compareTargetData}
                    leftLabel={compareBaseItem.title}
                    leftSubtitle={compareBaseItem.subtitle}
                    rightLabel={compareTargetItem.title}
                    rightSubtitle={compareTargetItem.subtitle}
                    className="h-full min-h-[760px]"
                  />
                ) : compareBaseReady ? (
                  <div className="grid h-full min-h-[760px] grid-cols-[minmax(0,1fr)_360px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <div className="min-h-0 border-r border-slate-200 bg-white px-5 py-4">
                      <div className="mb-3">
                        <p className="text-sm font-semibold text-slate-900">
                          {compareBaseItem?.title ?? "비교 기준"}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          그래프에서 비교 대상을 선택하세요.
                        </p>
                      </div>
                      <div className="h-full min-h-[680px]">
                        <DocumentEditor
                          key={`compare-base-${compareBaseItem?.id ?? "empty"}`}
                          isEditable={false}
                          initialData={compareBaseData ?? createOutputData([])}
                          minimalChrome={true}
                          contentLayout="document"
                        />
                      </div>
                    </div>
                    <div className="flex min-h-0 flex-col justify-center bg-slate-50 px-8 py-6">
                      <p className="text-sm font-semibold text-slate-900">
                        비교 대상을 선택하세요
                      </p>
                      <p className="mt-2 text-sm leading-6 text-slate-500">
                        그래프에서 다른 기록이나 워크스페이스를 선택하세요.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="h-full min-h-[760px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <DocumentPendingCanvas
                      label={
                        view.mode === "compare" && view.compareId
                          ? "비교 대상 준비 중"
                          : "비교 기준 준비 중"
                      }
                      visible={showReviewContentPending}
                      compact
                    />
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

      <BranchEditModal
        isOpen={!!mergeBranchState}
        onClose={() => setMergeBranchState(null)}
        onConfirm={handleMergeBranchConfirm}
        isLoading={isActionPending}
        defaultBranchName={mergeBranchState?.suggestedName || ""}
        title="병합 결과를 저장할 브랜치 이름"
        submitLabel="병합 워크스페이스 만들기"
      />

      <AlertDialog
        open={!!deleteDialog}
        onOpenChange={(open) => !open && setDeleteDialog(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleteDialog?.type === "commit"
                ? "기록을 삭제할까요?"
                : "브랜치를 삭제할까요?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteDialog?.type === "commit"
                ? "현재 보고 있는 기록만 삭제됩니다."
                : "브랜치와 그 아래 기록들이 함께 제거됩니다."}
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
