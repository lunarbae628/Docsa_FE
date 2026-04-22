import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { Label } from "./ui/label"

interface BranchEditModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (branchName: string) => void
  isLoading?: boolean
  isLastCommit?: boolean
  defaultBranchName?: string
  title?: string
  submitLabel?: string
  lockNameEdit?: boolean
}

export default function BranchEditModal({
  isOpen,
  onClose,
  onConfirm,
  isLoading = false,
  isLastCommit = false,
  defaultBranchName = "",
  title,
  submitLabel = "브랜치 만들기",
  lockNameEdit = false,
}: BranchEditModalProps) {
  const [branchName, setBranchName] = useState("")

  // 모달이 열릴 때 기본값 설정
  useEffect(() => {
    if (isOpen) {
      setBranchName(defaultBranchName)
    }
  }, [isOpen, defaultBranchName])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!branchName.trim()) return

    onConfirm(branchName.trim())
  }

  const handleClose = () => {
    setBranchName("")
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {title ??
              (isLastCommit
                ? "현재 브랜치 열기"
                : "새 브랜치 만들기")}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="branchName">브랜치 이름 *</Label>
            <Input
              id="branchName"
              value={branchName}
              onChange={(e) => setBranchName(e.target.value)}
              placeholder="브랜치 이름을 입력하세요"
              required
              disabled={isLoading || lockNameEdit}
              autoFocus
            />
            {lockNameEdit && (
              <p className="text-sm text-gray-500">
                현재 브랜치의 마지막 기록이라 기존 브랜치를 바로 엽니다.
              </p>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isLoading}
            >
              취소
            </Button>
            <Button type="submit" disabled={!branchName.trim() || isLoading}>
              {isLoading ? "생성 중..." : submitLabel}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
