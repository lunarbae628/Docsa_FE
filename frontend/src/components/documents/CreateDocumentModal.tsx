import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface CreateDocumentModalProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  title: string
  setTitle: (title: string) => void
  isCreating: boolean
  onCreateDocument: () => void
  onClose: () => void
}

export default function CreateDocumentModal({
  isOpen,
  onOpenChange,
  title,
  setTitle,
  isCreating,
  onCreateDocument,
  onClose,
}: CreateDocumentModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-slate-800">
            새 문서 만들기
          </DialogTitle>
          <DialogDescription className="text-base text-slate-600">
            새로운 문서의 제목을 입력해주세요.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label
              htmlFor="document-title"
              className="text-base font-medium text-slate-700"
            >
              문서 제목
            </Label>
            <Input
              id="document-title"
              type="text"
              placeholder="문서 제목을 입력하세요"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="h-12 text-base border-slate-200 focus:border-slate-800 focus:ring-slate-800"
              onKeyDown={(e) => {
                if (
                  e.key === "Enter" &&
                  !e.nativeEvent.isComposing &&
                  !e.repeat &&
                  !isCreating &&
                  title.trim()
                ) {
                  e.preventDefault()
                  onCreateDocument()
                }
              }}
              disabled={isCreating}
              autoFocus
            />
          </div>
        </div>

        <DialogFooter className="flex gap-3">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isCreating}
            className="text-base border-slate-200 hover:bg-slate-50 bg-transparent"
          >
            취소
          </Button>
          <Button
            onClick={onCreateDocument}
            disabled={!title.trim() || isCreating}
            className="bg-slate-800 hover:bg-slate-900 text-white text-base"
          >
            {isCreating ? "생성 중..." : "문서 생성"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
