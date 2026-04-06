import { useEffect, useMemo, useRef, useState } from "react"
import type { OutputData } from "@editorjs/editorjs"
import {
  GitCommitHorizontal,
  GitCompareArrows,
  GitMerge,
  Play,
  Trash2,
  X,
} from "lucide-react"
import ResizableLayout from "@/layouts/ResizableLayout"
import DocumentGraph from "@/components/DocumentGraph"
import DocumentEditor from "@/components/DocumentEditor"
import DocumentMergeView from "@/components/DocumentMergeView"
import BranchEditModal from "@/components/BranchEditModal"
import SaveCommitModal from "@/components/SaveCommitModal"
import { Button } from "@/components/ui/button"
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
import type { GraphDataType } from "@/types/graph"
import type { CommitNodeMenuType } from "@/components/CommitNode"
import type { TempNodeMenuType } from "@/components/TempNode"
import {
  editorDataToMarkdown,
  markdownToEditorData,
} from "@/lib/editorMarkdown"

type BranchRecord = {
  id: number
  name: string
  fromCommitId: number | null
  rootCommitId: number
  headCommitId: number | null
  saveId: number
}

type CommitRecord = {
  id: number
  branchId: number
  title: string
  description: string
  content: string
  createdAt: string
  kind: "commit" | "merge"
}

type WorkspaceRecord = {
  id: number
  branchId: number
  content: string
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

type DiffRow = {
  leftLineNumber: number | null
  rightLineNumber: number | null
  leftText: string
  rightText: string
  leftType: "same" | "removed" | "changed" | "empty"
  rightType: "same" | "added" | "changed" | "empty"
}

type CompareLineRow = {
  lineNumber: number
  text: string
}

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
    content:
      "프로젝트 소개\n이 문서는 팀이 문서 편집 흐름을 점검하기 위한 초기 초안이며, 실험적인 아이디어보다 기본 구조를 차분하게 정리하는 데 목적이 있습니다.\n\n현재 범위\n- 문서 저장 흐름을 먼저 확인하고, 기록 생성 시점은 나중에 세밀하게 조정합니다.\n- 협업 기능은 제외하고, 단일 사용자가 문서를 안정적으로 다루는 경험에 집중합니다.",
    createdAt: "2026-04-05T09:00:00+09:00",
    kind: "commit",
  },
  {
    id: 2,
    branchId: 1,
    title: "Main head",
    description: "Outbox 적용 반영",
    content:
      "프로젝트 소개\n이 문서는 팀이 문서 편집 흐름을 점검하기 위한 메인 초안이며, 실험적인 아이디어보다 기본 구조를 안정적으로 정리하는 데 목적이 있습니다.\n\n현재 범위\n- 문서 저장 흐름에 Outbox 패턴을 우선 적용하고, 기록 생성 시점은 나중에 세밀하게 조정합니다.\n- 협업 기능은 제외하고, 단일 사용자가 문서를 안정적으로 다루는 경험에 집중합니다.",
    createdAt: "2026-04-05T09:30:00+09:00",
    kind: "commit",
  },
  {
    id: 3,
    branchId: 2,
    title: "Fork point work",
    description: "실험 브랜치 시작점",
    content:
      "프로젝트 소개\n이 문서는 팀이 문서 편집 흐름을 점검하기 위한 브랜치 초안이며, 실험적인 아이디어를 더 빠르게 정리하는 데 목적이 있습니다.\n\n현재 범위\n- 문서 저장 흐름을 먼저 확인하고, 기록 생성 시점은 조금 더 빠르게 드러나도록 구성합니다.\n- 협업 기능은 제외하고, 단일 사용자가 문서를 유연하게 다루는 경험에 집중합니다.",
    createdAt: "2026-04-05T10:00:00+09:00",
    kind: "commit",
  },
  {
    id: 4,
    branchId: 2,
    title: "Release copy head",
    description: "리뷰 전 working snapshot",
    content:
      "프로젝트 소개\n이 문서는 팀이 문서 편집 흐름을 점검하기 위한 브랜치 초안이며, 실험적인 아이디어를 더 선명하게 정리하는 데 목적이 있습니다.\n\n현재 범위\n- 문서 저장 흐름을 먼저 확인하고, 기록 생성 시점은 조금 더 빠르게 드러나도록 구성합니다.\n- 협업 기능은 제외하고, 단일 사용자가 문서를 유연하게 다루는 경험에 집중합니다.",
    createdAt: "2026-04-05T10:30:00+09:00",
    kind: "commit",
  },
]

const initialWorkspaces: WorkspaceRecord[] = [
  {
    id: 1,
    branchId: 1,
    content:
      "프로젝트 소개\n이 문서는 팀이 문서 편집 흐름을 점검하기 위한 메인 초안이며, 실험적인 아이디어보다 기본 구조를 안정적으로 정리하는 데 목적이 있습니다.\n\n현재 범위\n- 문서 저장 흐름에 Outbox 패턴을 우선 적용하고, 기록 생성 시점은 나중에 세밀하게 조정합니다.\n- 협업 기능은 제외하고, 단일 사용자가 문서를 안정적으로 다루는 경험에 집중합니다.\n- 현재 main branch에서 설명 문장을 조금 더 자연스럽게 다듬는 중입니다.",
  },
  {
    id: 2,
    branchId: 2,
    content:
      "프로젝트 소개\n이 문서는 팀이 문서 편집 흐름을 점검하기 위한 브랜치 초안이며, 실험적인 아이디어를 더 선명하게 정리하는 데 목적이 있습니다.\n\n현재 범위\n- 문서 저장 흐름을 먼저 확인하고, 기록 생성 시점은 조금 더 빠르게 드러나도록 구성합니다.\n- 협업 기능은 제외하고, 단일 사용자가 문서를 유연하게 다루는 경험에 집중합니다.\n- 현재 release-copy branch에서 리뷰용 표현을 조금 더 또렷하게 다듬는 중입니다.",
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
    title: "문서 작업장 데모",
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
      saveId: branch.saveId,
    })),
  }
}

function buildDiffRows(left: string, right: string): DiffRow[] {
  const leftLines = left.split("\n")
  const rightLines = right.split("\n")
  const maxLength = Math.max(leftLines.length, rightLines.length)

  return Array.from({ length: maxLength }, (_, index) => {
    const leftText = leftLines[index] ?? ""
    const rightText = rightLines[index] ?? ""
    const hasLeft = index < leftLines.length
    const hasRight = index < rightLines.length

    if (hasLeft && hasRight && leftText === rightText) {
      return {
        leftLineNumber: index + 1,
        rightLineNumber: index + 1,
        leftText,
        rightText,
        leftType: "same",
        rightType: "same",
      }
    }

    if (hasLeft && hasRight) {
      return {
        leftLineNumber: index + 1,
        rightLineNumber: index + 1,
        leftText,
        rightText,
        leftType: "changed",
        rightType: "changed",
      }
    }

    if (hasLeft) {
      return {
        leftLineNumber: index + 1,
        rightLineNumber: null,
        leftText,
        rightText: "",
        leftType: "removed",
        rightType: "empty",
      }
    }

    return {
      leftLineNumber: null,
      rightLineNumber: index + 1,
      leftText: "",
      rightText,
      leftType: "empty",
      rightType: "added",
    }
  })
}

function diffRowClass(type: DiffRow["leftType"] | DiffRow["rightType"]) {
  switch (type) {
    case "added":
      return "bg-emerald-50"
    case "removed":
      return "bg-rose-50"
    case "changed":
      return "bg-sky-50"
    default:
      return "bg-white"
  }
}

function diffTextClass(type: DiffRow["leftType"] | DiffRow["rightType"]) {
  switch (type) {
    case "added":
      return "text-emerald-700"
    case "removed":
      return "text-rose-700"
    case "changed":
      return "text-sky-700"
    default:
      return "text-slate-700"
  }
}

export default function WorkingSaveDemoPage() {
  const [branches, setBranches] = useState(initialBranches)
  const [commits, setCommits] = useState(initialCommits)
  const [workspaces, setWorkspaces] = useState(initialWorkspaces)
  const [view, setView] = useState<ViewState>({
    mode: "workspace",
    branchId: 1,
    workspaceId: 1,
  })
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("synced")
  const [toast, setToast] = useState("main 작업장에서 문서를 편집 중입니다.")
  const [branchEditState, setBranchEditState] = useState<BranchEditState>(null)
  const [deleteDialog, setDeleteDialog] = useState<DeleteDialogState>(null)
  const [isCommitModalOpen, setIsCommitModalOpen] = useState(false)
  const syncTimerRef = useRef<number | null>(null)

  const graphData = useMemo(
    () => buildGraphData(branches, commits),
    [branches, commits],
  )

  const mainBranch = useMemo(() => {
    return (
      graphData.branches.find((branch) => branch.name === "main") ??
      graphData.branches[0]
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
    }
  }, [branches, commits, view, workspaces])

  const mainWorkspace = useMemo(() => {
    return workspaces.find((workspace) => workspace.branchId === mainBranch.id) ?? null
  }, [workspaces, mainBranch.id])

  const diffRows = useMemo(() => {
    if (!compareBaseItem || !compareTargetItem) return []
    return buildDiffRows(compareBaseItem.content, compareTargetItem.content)
  }, [compareBaseItem, compareTargetItem])

  const baseRows = useMemo<CompareLineRow[]>(() => {
    if (!compareBaseItem) return []
    return compareBaseItem.content.split("\n").map((text, index) => ({
      lineNumber: index + 1,
      text,
    }))
  }, [compareBaseItem])

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
    }
  }, [branches, commits, view, workspaces])

  const mergeSourceData = useMemo(() => {
    return mergeSourceItem ? markdownToEditorData(mergeSourceItem.content) : null
  }, [mergeSourceItem])

  const mergeTargetData = useMemo(() => {
    return mergeTargetItem ? markdownToEditorData(mergeTargetItem.content) : null
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

  useEffect(() => {
    return () => {
      if (syncTimerRef.current) {
        window.clearTimeout(syncTimerRef.current)
      }
    }
  }, [])

  const openWorkspaceByBranch = (branchId: number) => {
    const branch = branches.find((item) => item.id === branchId)
    if (!branch) return
    setView({ mode: "workspace", branchId, workspaceId: branch.saveId })
  }

  const openCommit = (branchId: number, commitId: number) => {
    const targetCommit = commits.find((item) => item.id === commitId)
    setView({ mode: "commit", branchId, commitId })
    setToast(`기록 '${targetCommit?.title ?? commitId}' 화면을 열었습니다.`)
  }

  const handleWorkspaceChange = (value: string) => {
    if (!currentWorkspace) return

    setWorkspaces((prev) =>
      prev.map((workspace) =>
        workspace.id === currentWorkspace.id
          ? { ...workspace, content: value }
          : workspace,
      ),
    )
    setSyncStatus("syncing")

    if (syncTimerRef.current) {
      window.clearTimeout(syncTimerRef.current)
    }

    syncTimerRef.current = window.setTimeout(() => {
      setSyncStatus("synced")
      setToast("작업 내용이 자동 반영되었습니다.")
    }, 700)
  }

  const handleCommitConfirm = ({
    title,
    description,
  }: {
    title: string
    description?: string
  }) => {
    if (!currentBranch || !currentWorkspace) return

    const nextCommitId = getNextId(commits)
    const nextCommit: CommitRecord = {
      id: nextCommitId,
      branchId: currentBranch.id,
      title,
      description: description || "현재 작업장에서 남긴 기록",
      content: currentWorkspace.content,
      createdAt: new Date().toISOString(),
      kind: "commit",
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
  }

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

  const handleBranchEditConfirm = (branchName: string) => {
    if (!branchEditState) return

    const targetCommit = commits.find(
      (commit) => commit.id === branchEditState.commitId,
    )
    const targetBranch = branches.find(
      (branch) => branch.id === targetCommit?.branchId,
    )
    if (!targetCommit || !targetBranch) return

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
      },
    ])

    setView({
      mode: "workspace",
      branchId: nextBranchId,
      workspaceId: nextWorkspaceId,
    })
    setSyncStatus("synced")
    setToast(`${branchName} 작업장이 열렸습니다.`)
    setBranchEditState(null)
  }

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
    setToast(`두 버전을 나란히 비교 중입니다.`)
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

  const handleDeleteCurrentCommit = () => {
    if (!canDeleteCurrentCommit || !currentCommit || !currentBranch) return

    const previousCommit = currentBranchCommits[currentBranchCommits.length - 2]
    if (!previousCommit) return

    setCommits((prev) => prev.filter((commit) => commit.id !== currentCommit.id))
    setBranches((prev) =>
      prev.map((branch) =>
        branch.id === currentBranch.id
          ? { ...branch, headCommitId: previousCommit.id }
          : branch,
      ),
    )
    setView({ mode: "commit", branchId: currentBranch.id, commitId: previousCommit.id })
    setToast(`기록 "${currentCommit.title}"을 삭제했습니다.`)
    setDeleteDialog(null)
  }

  const handleDeleteCommit = (commitId: number) => {
    const targetCommit = commits.find((commit) => commit.id === commitId)
    const targetBranch = branches.find((branch) => branch.id === targetCommit?.branchId)
    if (!targetCommit || !targetBranch) return
    if (
      targetBranch.headCommitId !== targetCommit.id ||
      targetBranch.rootCommitId === targetCommit.id
    ) {
      return
    }

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
    setView({ mode: "commit", branchId: targetBranch.id, commitId: previousCommit.id })
    setToast(`기록 "${targetCommit.title}"을 삭제했습니다.`)
    setDeleteDialog(null)
  }

  const handleDeleteBranch = (branchId: number) => {
    if (!mainWorkspace) return

    const targetBranch = branches.find((branch) => branch.id === branchId)
    if (!targetBranch || targetBranch.id === mainBranch.id) return

    const commitIds = new Set(
      commits.filter((commit) => commit.branchId === targetBranch.id).map((commit) => commit.id),
    )

    setCommits((prev) => prev.filter((commit) => !commitIds.has(commit.id)))
    setBranches((prev) => prev.filter((branch) => branch.id !== targetBranch.id))
    setWorkspaces((prev) => prev.filter((workspace) => workspace.id !== targetBranch.saveId))
    setView({ mode: "workspace", branchId: mainBranch.id, workspaceId: mainWorkspace.id })
    setToast(`${targetBranch.name} 브랜치를 삭제하고 main 작업장으로 돌아왔습니다.`)
    setDeleteDialog(null)
  }

  const handleDirectMerge = (mergedData: OutputData) => {
    const sourceItem =
      view.mode === "merge" ? mergeSourceItem : null

    if (!sourceItem || !mergeTargetItem) return

    const targetBranch = branches.find((branch) => branch.id === mergeTargetItem.branchId)
    const targetWorkspace = workspaces.find(
      (workspace) => workspace.branchId === mergeTargetItem.branchId,
    )
    if (!targetBranch || !targetWorkspace) return

    const nextCommitId = getNextId(commits)
    const mergedContent = editorDataToMarkdown(mergedData)

    setCommits((prev) => [
      ...prev,
      {
        id: nextCommitId,
        branchId: targetBranch.id,
        title: `${sourceItem.title} 병합`,
        description: `${targetBranch.name}에 ${sourceItem.title} 반영`,
        content: mergedContent,
        createdAt: new Date().toISOString(),
        kind: "merge",
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
          ? { ...workspace, content: mergedContent }
          : workspace,
      ),
    )

    setView({
      mode: "commit",
      branchId: targetBranch.id,
      commitId: nextCommitId,
    })
    setSyncStatus("synced")
    setToast(`${targetBranch.name}에 ${sourceItem.title} 내용을 병합했습니다.`)
  }

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
      case "commit-merge":
      {
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

  const handleBranchRename = (branchId: number, newName: string) => {
    setBranches((prev) =>
      prev.map((branch) =>
        branch.id === branchId ? { ...branch, name: newName } : branch,
      ),
    )

    if (view.branchId === branchId) {
      setToast(`${newName} 브랜치 이름으로 변경했습니다.`)
    }
  }

  const rightTitle =
    view.mode === "workspace"
      ? `${currentBranch?.name ?? "branch"} 작업장`
      : view.mode === "compare"
        ? "기록 비교"
        : view.mode === "merge"
          ? "기록 병합"
        : `${currentBranch?.name ?? "branch"} 기록`

  return (
    <>
      <div className="h-screen w-screen overflow-hidden bg-slate-100">
        <ResizableLayout
          initialWidth={450}
          minWidth={340}
          maxWidth={860}
          className="h-screen"
          sidebarClassName="h-full"
          mainClassName="h-full bg-slate-100"
        >
          <div className="h-full bg-slate-100 p-3">
            <DocumentGraph
              data={graphData}
              mainBranch={mainBranch}
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

          <div className="h-full bg-slate-100 p-3">
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
                      <Button size="sm" onClick={() => setIsCommitModalOpen(true)}>
                        <GitCommitHorizontal className="h-4 w-4" /> 기록하기
                      </Button>
                    </>
                  ) : null}
                  {view.mode === "commit" && currentCommit ? (
                    <>
                      <Button
                        size="sm"
                        onClick={() =>
                          currentCommit &&
                          handleMergeStart("commit", currentCommit.id, currentCommit.branchId)
                        }
                      >
                        <GitMerge className="h-4 w-4" /> 병합하기
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCompareStart("commit", currentCommit.id, currentCommit.branchId)}
                      >
                        <GitCompareArrows className="h-4 w-4" /> 비교하기
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleContinueEditClick(currentCommit.id)}>
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
                          ? setView({
                              mode: "commit",
                              branchId: compareBaseItem.branchId,
                              commitId: compareBaseItem.id,
                            })
                          : setView({
                              mode: "workspace",
                              branchId: compareBaseItem.branchId,
                              workspaceId: compareBaseItem.id,
                            })
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
                        setView({
                          mode: "commit",
                          branchId: mergeSourceItem.branchId,
                          commitId: mergeSourceItem.id,
                        })
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
                  <div className="h-full min-h-[760px]">
                    <DocumentEditor
                      key={`workspace-${currentWorkspace?.id ?? "empty"}`}
                      isEditable={true}
                      initialData={markdownToEditorData(currentWorkspace?.content ?? "")}
                      onDataChange={(data) =>
                        handleWorkspaceChange(editorDataToMarkdown(data))
                      }
                      disableAutoUpdate={true}
                      minimalChrome={true}
                      contentLayout="document"
                    />
                  </div>
                ) : view.mode === "commit" ? (
                  <div className="h-full min-h-[760px]">
                    <DocumentEditor
                      key={`commit-${currentCommit?.id ?? "empty"}`}
                      isEditable={false}
                      initialData={markdownToEditorData(currentCommit?.content ?? "")}
                      minimalChrome={true}
                      contentLayout="document"
                    />
                  </div>
                ) : view.mode === "merge" ? (
                  mergeSourceData && mergeTargetData ? (
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
                          mergeSourceItem &&
                          setView({
                            mode: "commit",
                            branchId: mergeSourceItem.branchId,
                            commitId: mergeSourceItem.id,
                          })
                        }
                        onSave={handleDirectMerge}
                      />
                    </div>
                  ) : (
                    <div className="flex h-full min-h-[760px] items-center justify-center rounded-2xl border border-slate-200 bg-white text-sm text-slate-500 shadow-sm">
                      병합할 대상 기록 또는 작업장을 먼저 선택하세요.
                    </div>
                  )
                ) : (
                  <div className="grid h-full min-h-[760px] grid-cols-[1fr_84px_1fr] gap-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <div className="min-w-0 border-r border-slate-200 bg-white">
                      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{compareBaseItem?.title}</p>
                          <p className="mt-1 text-xs text-slate-500">{compareBaseItem?.subtitle ?? "기준 버전"}</p>
                        </div>
                      </div>
                      <div className="divide-y divide-slate-100 font-mono text-[13px]">
                        {(compareTargetItem ? diffRows : baseRows).map((row, index) => {
                          const leftLineNumber = compareTargetItem ? row.leftLineNumber : row.lineNumber
                          const leftText = compareTargetItem ? row.leftText : row.text
                          const leftType = compareTargetItem ? row.leftType : "same"

                          return (
                            <div key={`left-${index}`} className={`grid grid-cols-[56px_1fr] ${diffRowClass(leftType)}`}>
                              <div className="border-r border-slate-200 px-3 py-2 text-right text-slate-400">
                                {leftLineNumber ?? ""}
                              </div>
                              <pre className={`overflow-x-auto whitespace-pre-wrap border-l-4 px-4 py-2 ${leftType === "removed" ? "border-l-rose-400" : leftType === "changed" ? "border-l-sky-400" : "border-l-transparent"} ${diffTextClass(leftType)}`}>
                                {leftText || " "}
                              </pre>
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    <div className="border-r border-slate-200 bg-slate-50 font-mono text-[12px] text-slate-500">
                      <div className="sticky top-0 z-10 border-b border-slate-200 bg-slate-100 px-3 py-3 text-center text-[11px] font-semibold text-slate-500">
                        위치
                      </div>
                      <div className="divide-y divide-slate-100">
                        {compareTargetItem ? (
                          diffRows.map((row, index) => {
                            const status = row.rightType === "added" ? "+" : row.leftType === "removed" ? "-" : row.leftType === "changed" || row.rightType === "changed" ? "~" : ""
                            const statusClass = row.rightType === "added"
                              ? "bg-emerald-100 text-emerald-700"
                              : row.leftType === "removed"
                                ? "bg-rose-100 text-rose-700"
                                : row.leftType === "changed" || row.rightType === "changed"
                                  ? "bg-sky-100 text-sky-700"
                                  : "bg-transparent text-slate-400"
                            return (
                              <div key={`mid-${index}`} className="grid grid-cols-[1fr_28px_1fr] items-center gap-1 px-2 py-2 text-center">
                                <span>{row.leftLineNumber ?? ""}</span>
                                <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold ${statusClass}`}>{status}</span>
                                <span>{row.rightLineNumber ?? ""}</span>
                              </div>
                            )
                          })
                        ) : (
                          baseRows.map((row) => (
                            <div key={`mid-base-${row.lineNumber}`} className="grid grid-cols-[1fr_28px_1fr] items-center gap-1 px-2 py-2 text-center">
                              <span>{row.lineNumber}</span>
                              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold text-slate-300">•</span>
                              <span></span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    <div className="min-w-0 bg-white">
                      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">
                            {compareTargetItem?.title ?? "비교할 버전 선택"}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {compareTargetItem
                              ? compareTargetItem.subtitle
                              : "왼쪽 그래프에서 다른 기록 또는 작업장의 비교 버튼을 누르세요."}
                          </p>
                        </div>
                      </div>
                      {compareTargetItem ? (
                        <div className="divide-y divide-slate-100 font-mono text-[13px]">
                          {diffRows.map((row, index) => (
                            <div key={`right-${index}`} className={`grid grid-cols-[56px_1fr] ${diffRowClass(row.rightType)}`}>
                              <div className="border-r border-slate-200 px-3 py-2 text-right text-slate-400">
                                {row.rightLineNumber ?? ""}
                              </div>
                              <pre className={`overflow-x-auto whitespace-pre-wrap border-l-4 px-4 py-2 ${row.rightType === "added" ? "border-l-emerald-500" : row.rightType === "changed" ? "border-l-sky-400" : "border-l-transparent"} ${diffTextClass(row.rightType)}`}>
                                {row.rightText || " "}
                              </pre>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="flex h-[720px] items-center justify-center text-sm text-slate-500">
                          비교할 기록 또는 작업장을 아직 선택하지 않았습니다.
                        </div>
                      )}
                    </div>
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
                : "브랜치와 그 아래 기록들이 함께 제거됩니다. 이 데모에서는 작업장 삭제를 따로 만들지 않고 브랜치 정리의 일부로 처리합니다."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={() => {
                if (deleteDialog?.type === "commit") {
                  handleDeleteCommit(deleteDialog.commitId)
                  return
                }
                handleDeleteBranch(deleteDialog.branchId)
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
