import { useQueryClient, useMutation } from "@tanstack/react-query"
import { useState } from "react"
import { useAuth } from "@/hooks/useAuth"
import { alertDialog } from "@/lib/utils"
import type { Document } from "@/mock/DocumentList"
import { apiClient } from "@/api/apiClient"

export function useDeleteDocument() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  // 삭제 다이얼로그 관련 상태
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [documentToDelete, setDocumentToDelete] = useState<Document | null>(
    null,
  )

  // React Query Mutation을 사용한 문서 삭제
  const deleteDocumentMutation = useMutation({
    mutationFn: async (docId: number) => {
      return await apiClient.document._delete({
        docId,
      })
    },
    onSuccess: () => {
      // 성공 시 문서 목록 캐시 무효화
      queryClient.invalidateQueries({ queryKey: ["documents"] })
      console.log("문서 삭제 완료")
      // 다이얼로그 닫기
      setShowDeleteDialog(false)
      setDocumentToDelete(null)
    },
    onError: async (error: any) => {
      console.error("문서 삭제 실패:", error)

      // 서버에서 내려온 에러 메시지 추출
      const errorMessage = error.message || "문서 삭제에 실패했습니다.";
      
      console.log("errorMessage", errorMessage)

      // 여기서 토스트 알림이나 에러 처리를 할 수 있습니다
      alertDialog(errorMessage, "문서 삭제 오류", "destructive")
    },
  })

  // 삭제 요청 함수 (다이얼로그 열기)
  const deleteDocument = (document: Document) => {
    setDocumentToDelete(document)
    setShowDeleteDialog(true)
  }

  // 삭제 확인 함수
  const confirmDeleteDocument = () => {
    if (documentToDelete) {
      deleteDocumentMutation.mutate(documentToDelete.id)
    }
  }

  // 삭제 취소 함수
  const cancelDeleteDocument = () => {
    setShowDeleteDialog(false)
    setDocumentToDelete(null)
  }

  return {
    deleteDocument,
    isDeleting: deleteDocumentMutation.isPending,
    error: deleteDocumentMutation.error,
    showDeleteDialog,
    setShowDeleteDialog,
    documentToDelete,
    confirmDeleteDocument,
    cancelDeleteDocument,
  }
}
