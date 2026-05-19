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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { getBranchColor } from "@/lib/graphUtils"
import type { Branch, Commit } from "@/types/graph"
import { ChevronDown, GitBranch, PencilLine, Trash2 } from "lucide-react"
import { type MouseEvent, useEffect, useMemo, useState } from "react"

interface BranchTabsProps {
  branches: Branch[]
  commits: Commit[]
  currentBranchId?: number
  onBranchSelect?: (branchId: number) => void
  onBranchDelete?: (branchId: number) => void
  onBranchRename?: (branchId: number, newName: string) => void | Promise<void>
  onBranchCreate?: () => void
}

interface DeleteConfirmDialog {
  isOpen: boolean
  branch: Branch | null
  commitCount: number
  isMerged: boolean
}

export default function BranchTabs({
  branches,
  commits,
  currentBranchId,
  onBranchSelect,
  onBranchDelete,
  onBranchRename,
}: BranchTabsProps) {
  const [deleteDialog, setDeleteDialog] = useState<DeleteConfirmDialog>({
    isOpen: false,
    branch: null,
    commitCount: 0,
    isMerged: false,
  })
  const [renameOpen, setRenameOpen] = useState(false)
  const [renameValue, setRenameValue] = useState("")
  const [isRenaming, setIsRenaming] = useState(false)
  const [renameTargetBranch, setRenameTargetBranch] = useState<Branch | null>(
    null,
  )

  const currentBranch = useMemo(
    () =>
      branches.find((branch) => branch.id === currentBranchId) ??
      branches[0] ??
      null,
    [branches, currentBranchId],
  )

  useEffect(() => {
    if (renameOpen && renameTargetBranch) {
      setRenameValue(renameTargetBranch.name)
    }
  }, [renameOpen, renameTargetBranch])

  const getBranchCommitCount = (branchId: number) => {
    return commits.filter((commit) => commit.branchId === branchId).length
  }

  const isBranchMerged = (branch: Branch) => {
    // 실제로는 서버에서 머지 상태를 확인해야 하지만,
    // 여기서는 간단히 main 브랜치가 아닌 브랜치의 커밋이 main에 있는지 확인
    if (branch.name === "main") return true

    // 임시로 fromCommitId가 있으면 머지되지 않은 것으로 간주
    return !branch.fromCommitId
  }

  const handleDeleteClick = (
    e: MouseEvent<HTMLButtonElement>,
    branch: Branch,
  ) => {
    e.stopPropagation()
    openDeleteDialog(branch)
  }

  const openDeleteDialog = (branch: Branch) => {
    // 메인 브랜치는 삭제 불가
    if (branch.name === "main") {
      return
    }

    // 현재 활성 브랜치는 삭제 불가
    if (branch.id === currentBranchId) {
      return
    }

    const commitCount = getBranchCommitCount(branch.id)
    const isMerged = isBranchMerged(branch)

    setDeleteDialog({
      isOpen: true,
      branch,
      commitCount,
      isMerged,
    })
  }

  const handleDeleteConfirm = () => {
    if (deleteDialog.branch) {
      onBranchDelete?.(deleteDialog.branch.id)
    }
    setDeleteDialog({
      isOpen: false,
      branch: null,
      commitCount: 0,
      isMerged: false,
    })
  }

  const handleRenameConfirm = async () => {
    if (
      !renameTargetBranch ||
      !renameValue.trim() ||
      renameTargetBranch.name === "main"
    ) {
      return
    }

    setIsRenaming(true)
    try {
      await Promise.resolve(
        onBranchRename?.(renameTargetBranch.id, renameValue.trim()),
      )
      setRenameOpen(false)
      setRenameTargetBranch(null)
    } finally {
      setIsRenaming(false)
    }
  }

  return (
    <>
      <div className="border-b border-slate-200/90 bg-white/80 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-2">
          <GitBranch className="h-4 w-4 text-slate-500" />
          <span className="text-sm font-medium text-slate-700">브랜치</span>
          <div className="ml-auto flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex h-11 min-w-[220px] items-center gap-2 rounded-2xl border border-slate-200 bg-[linear-gradient(180deg,#fdfefe_0%,#f8fafc_100%)] px-3.5 text-sm text-slate-700 shadow-[0_8px_18px_rgba(15,23,42,0.06)] transition hover:border-slate-300"
                >
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{
                      backgroundColor: currentBranch
                        ? getBranchColor(currentBranch.id)
                        : "#94a3b8",
                    }}
                  />
                  <span className="min-w-0 flex-1 truncate text-left font-medium">
                    {currentBranch?.name ?? "브랜치 선택"}
                  </span>
                  {currentBranch ? (
                    <span className="text-xs text-slate-400">
                      ({getBranchCommitCount(currentBranch.id)})
                    </span>
                  ) : null}
                  <ChevronDown className="h-4 w-4 text-slate-400" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-[260px] rounded-2xl border-slate-200 p-2 shadow-[0_16px_40px_rgba(15,23,42,0.12)]"
              >
                {branches.map((branch) => {
                  const isActive = branch.id === currentBranchId
                  const commitCount = getBranchCommitCount(branch.id)
                  const canRename = branch.name !== "main"
                  const canDelete =
                    branch.name !== "main" && branch.id !== currentBranchId

                  return (
                    <DropdownMenuItem
                      key={branch.id}
                      onClick={() => onBranchSelect?.(branch.id)}
                      className="flex items-center gap-3 rounded-xl px-3 py-2.5 focus:bg-slate-50"
                    >
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: getBranchColor(branch.id) }}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-slate-800">
                          {branch.name}
                        </span>
                        <span className="block text-xs text-slate-500">
                          기록 {commitCount}개
                        </span>
                      </span>
                      {isActive ? (
                        <span className="rounded-full bg-slate-900 px-2 py-1 text-[10px] font-semibold text-white">
                          현재
                        </span>
                      ) : null}
                      <div className="ml-1 flex items-center gap-1">
                        <button
                          type="button"
                          className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30"
                          disabled={!canRename}
                          onClick={(event) => {
                            event.preventDefault()
                            event.stopPropagation()
                            setRenameTargetBranch(branch)
                            setRenameOpen(true)
                          }}
                          title={`${branch.name} 이름 변경`}
                        >
                          <PencilLine className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          className="rounded-md p-1 text-red-500 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-30"
                          disabled={!canDelete}
                          onClick={(event) => {
                            event.preventDefault()
                            event.stopPropagation()
                            openDeleteDialog(branch)
                          }}
                          title={`${branch.name} 삭제`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </DropdownMenuItem>
                  )
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>브랜치 이름 변경</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="branchRename">브랜치 이름</Label>
              <Input
                id="branchRename"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                placeholder="브랜치 이름을 입력하세요"
                disabled={isRenaming || renameTargetBranch?.name === "main"}
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setRenameOpen(false)}
                disabled={isRenaming}
              >
                취소
              </Button>
              <Button
                type="button"
                onClick={handleRenameConfirm}
                disabled={
                  isRenaming ||
                  !renameValue.trim() ||
                  !renameTargetBranch ||
                  renameTargetBranch.name === "main"
                }
              >
                {isRenaming ? "변경 중..." : "변경하기"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 삭제 확인 다이얼로그 */}
      <AlertDialog
        open={deleteDialog.isOpen}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteDialog({
              isOpen: false,
              branch: null,
              commitCount: 0,
              isMerged: false,
            })
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <GitBranch className="h-5 w-5 text-red-600" />
              브랜치 삭제 확인
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <div>
                <strong>'{deleteDialog.branch?.name}'</strong> 브랜치를
                삭제하시겠습니까?
              </div>

              <div className="text-sm bg-gray-50 p-3 rounded-lg">
                <div className="flex justify-between items-center mb-1">
                  <span>기록 개수:</span>
                  <span className="font-medium">
                    {deleteDialog.commitCount}개
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span>병합 상태:</span>
                  <span
                    className={`font-medium ${deleteDialog.isMerged ? "text-green-600" : "text-orange-600"}`}
                  >
                    {deleteDialog.isMerged ? "병합됨" : "병합되지 않음"}
                  </span>
                </div>
              </div>

              {!deleteDialog.isMerged && (
                <div className="bg-orange-50 border border-orange-200 p-3 rounded-lg">
                  <div className="flex items-center gap-2 text-orange-800">
                    <span className="text-lg">⚠️</span>
                    <div>
                      <div className="font-medium">주의!</div>
                      <div className="text-sm">
                        이 브랜치는 아직 병합되지 않았습니다. 삭제하면 작업
                        내용이 영구적으로 손실될 수 있습니다.
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
              onClick={handleDeleteConfirm}
            >
              삭제하기
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
