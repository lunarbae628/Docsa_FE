import { useMemo } from "react"
import type { OutputData } from "@editorjs/editorjs"
import { useSnapshotContent } from "@/hooks/useSnapshotContent"
import type {
  BranchRecord,
  CommitRecord,
  WorkspaceRecord,
  ViewState,
} from "@/hooks/useDocumentWorkspaceBodyState"

type SnapshotBlock = { [key: string]: any }

function createOutputData(blocks: SnapshotBlock[] | null | undefined): OutputData {
  return {
    time: Date.now(),
    version: "2.30.8",
    blocks: Array.isArray(blocks) ? blocks : [],
  }
}

export function useDocumentWorkspaceReviewState({
  documentId,
  isRealDocument,
  view,
  branches,
  commits,
  workspaces,
}: {
  documentId: number
  isRealDocument: boolean
  view: ViewState
  branches: BranchRecord[]
  commits: CommitRecord[]
  workspaces: WorkspaceRecord[]
}) {
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
        subtitle: branch ? `${branch.name} 브랜치 기록` : "브랜치 기록",
        blocks: commit.blocks,
      }
    }

    const workspace = workspaces.find((item) => item.id === view.baseId)
    if (!workspace) return null
    const branch = branches.find((item) => item.id === workspace.branchId)
    return {
      kind: "workspace" as const,
      id: workspace.id,
      branchId: workspace.branchId,
      title: branch ? `${branch.name} 워크스페이스` : "워크스페이스",
      subtitle: "브랜치 작업 중",
      blocks: workspace.blocks,
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
        subtitle: branch ? `${branch.name} 브랜치 기록` : "브랜치 기록",
        blocks: commit.blocks,
      }
    }

    const workspace = workspaces.find((item) => item.id === view.compareId)
    if (!workspace) return null
    const branch = branches.find((item) => item.id === workspace.branchId)
    return {
      kind: "workspace" as const,
      id: workspace.id,
      branchId: workspace.branchId,
      title: branch ? `${branch.name} 워크스페이스` : "워크스페이스",
      subtitle: "브랜치 작업 중",
      blocks: workspace.blocks,
    }
  }, [branches, commits, view, workspaces])

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
        subtitle: branch ? `${branch.name} 브랜치 기록` : "브랜치 기록",
        blocks: commit.blocks,
      }
    }

    const workspace = workspaces.find((item) => item.id === view.sourceId)
    if (!workspace) return null
    const branch = branches.find((item) => item.id === workspace.branchId)
    return {
      kind: "workspace" as const,
      id: workspace.id,
      branchId: workspace.branchId,
      title: branch ? `${branch.name} 워크스페이스` : "워크스페이스",
      subtitle: "브랜치 작업 중",
      blocks: workspace.blocks,
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
        subtitle: branch ? `${branch.name} 브랜치 기록` : "브랜치 기록",
        blocks: commit.blocks,
      }
    }

    const workspace = workspaces.find((item) => item.id === view.targetId)
    if (!workspace) return null
    const branch = branches.find((item) => item.id === workspace.branchId)
    return {
      kind: "workspace" as const,
      id: workspace.id,
      branchId: workspace.branchId,
      title: branch ? `${branch.name} 워크스페이스` : "워크스페이스",
      subtitle: "브랜치 작업 중",
      blocks: workspace.blocks,
    }
  }, [branches, commits, view, workspaces])

  const compareBaseSnapshotQuery = useSnapshotContent({
    documentId,
    kind: view.mode === "compare" ? view.baseKind : null,
    id: view.mode === "compare" ? view.baseId : null,
    enabled: isRealDocument && view.mode === "compare",
  })

  const compareTargetSnapshotQuery = useSnapshotContent({
    documentId,
    kind: view.mode === "compare" && view.compareKind ? view.compareKind : null,
    id: view.mode === "compare" ? view.compareId : null,
    enabled:
      isRealDocument &&
      view.mode === "compare" &&
      !!view.compareKind &&
      !!view.compareId,
  })

  const mergeSourceSnapshotQuery = useSnapshotContent({
    documentId,
    kind: view.mode === "merge" ? view.sourceKind : null,
    id: view.mode === "merge" ? view.sourceId : null,
    enabled: isRealDocument && view.mode === "merge",
  })

  const mergeTargetSnapshotQuery = useSnapshotContent({
    documentId,
    kind: view.mode === "merge" && view.targetKind ? view.targetKind : null,
    id: view.mode === "merge" ? view.targetId : null,
    enabled:
      isRealDocument &&
      view.mode === "merge" &&
      !!view.targetKind &&
      !!view.targetId,
  })

  const compareBaseData = useMemo(() => {
    if (!compareBaseItem) return null
    if (isRealDocument && compareBaseSnapshotQuery.data === undefined) return null
    return createOutputData(
      isRealDocument ? compareBaseSnapshotQuery.data ?? [] : compareBaseItem.blocks,
    )
  }, [compareBaseItem, compareBaseSnapshotQuery.data, isRealDocument])

  const compareTargetData = useMemo(() => {
    if (!compareTargetItem) return null
    if (isRealDocument && compareTargetSnapshotQuery.data === undefined) return null
    return createOutputData(
      isRealDocument ? compareTargetSnapshotQuery.data ?? [] : compareTargetItem.blocks,
    )
  }, [compareTargetItem, compareTargetSnapshotQuery.data, isRealDocument])

  const mergeSourceData = useMemo(() => {
    if (!mergeSourceItem) return null
    if (isRealDocument && mergeSourceSnapshotQuery.data === undefined) return null
    return createOutputData(
      isRealDocument ? mergeSourceSnapshotQuery.data ?? [] : mergeSourceItem.blocks,
    )
  }, [isRealDocument, mergeSourceItem, mergeSourceSnapshotQuery.data])

  const mergeTargetData = useMemo(() => {
    if (!mergeTargetItem) return null
    if (isRealDocument && mergeTargetSnapshotQuery.data === undefined) return null
    return createOutputData(
      isRealDocument ? mergeTargetSnapshotQuery.data ?? [] : mergeTargetItem.blocks,
    )
  }, [isRealDocument, mergeTargetItem, mergeTargetSnapshotQuery.data])

  return {
    compareBaseItem,
    compareTargetItem,
    compareBaseData,
    compareTargetData,
    compareTargetSnapshotQuery,
    compareBaseSnapshotQuery,
    compareBaseReady: Boolean(compareBaseItem && compareBaseData),
    compareTargetReady: Boolean(compareTargetItem && compareTargetData),
    mergeSourceItem,
    mergeTargetItem,
    mergeSourceData,
    mergeTargetData,
    mergeSourceSnapshotQuery,
    mergeTargetSnapshotQuery,
    mergeBaseReady: Boolean(mergeSourceItem && mergeSourceData),
    mergeTargetReady: Boolean(mergeTargetItem && mergeTargetData),
  }
}
