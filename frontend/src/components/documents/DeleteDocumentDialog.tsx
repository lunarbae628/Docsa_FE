import { AlertTriangle } from "lucide-react"
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
import type { DocListResponse } from "@/api/__generated__"

interface DeleteDocumentDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  document: DocListResponse | null
  onConfirmDelete: () => void
  onCancel: () => void
}

export default function DeleteDocumentDialog({
  isOpen,
  onOpenChange,
  document,
  onConfirmDelete,
  onCancel,
}: DeleteDocumentDialogProps) {
  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="text-lg font-medium text-red-600">
            <AlertTriangle className="h-5 w-5 mr-2 text-red-600" />'
            {document?.title}'를 정말 삭제하시겠습니까?
          </AlertDialogTitle>
          <AlertDialogDescription className="text-base text-slate-600">
            이 문서에 속한 모든 브랜치와 기록이 영구 삭제됩니다. 한 번 삭제한
            <br />
            문서는 복구할 수 없습니다.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel
            onClick={onCancel}
            className="text-base border-slate-200 hover:bg-slate-50 bg-transparent"
          >
            취소
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirmDelete}
            className="bg-red-600 hover:bg-red-700 text-white text-base"
          >
            영구 삭제
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
