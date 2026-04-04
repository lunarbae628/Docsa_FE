import { useState } from "react"
import { useNavigate } from "react-router"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { apiClient } from "@/api/apiClient"
import { alertDialog } from "@/lib/utils"

export function useCreateDocument() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [newDocumentTitle, setNewDocumentTitle] = useState("")
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  // React Query Mutation을 사용한 문서 생성
  const createDocumentMutation = useMutation({
    mutationFn: async (title: string) => {
      return await apiClient.document.create({
        docTitleRequest: { title },
      })
    },
    onSuccess: (response) => {
      // 성공 시 문서 목록 캐시 무효화
      queryClient.invalidateQueries({ queryKey: ["documents"] })

      // 모달 닫기
      closeCreateModal()

      // 새 문서로 이동 (임시 저장 모드로)
      const newDocumentId = response.id

      navigate(
        `/documents/${newDocumentId}?mode=save&saveId=${response.saveId}`,
      )

      console.log("새 문서 생성됨:", response)
    },
    onError: async (error: any) => {
      console.error("문서 생성 실패:", error)

      // 서버에서 내려온 에러 메시지 추출
      const errorMessage = error.message || "문서 생성에 실패했습니다.";

      console.log("errorMessage", errorMessage)

      // 여기서 토스트 알림이나 에러 처리를 할 수 있습니다
      alertDialog(errorMessage, "문서 생성 오류", "destructive")
    },
  })

  const openCreateModal = () => {
    setIsCreateModalOpen(true)
    setNewDocumentTitle("")
  }

  const closeCreateModal = () => {
    setIsCreateModalOpen(false)
    setNewDocumentTitle("")
  }

  const createNewDocument = async () => {
    if (!newDocumentTitle.trim()) return
    createDocumentMutation.mutate(newDocumentTitle.trim())
  }

  return {
    isCreateModalOpen,
    setIsCreateModalOpen,
    newDocumentTitle,
    setNewDocumentTitle,
    isCreating: createDocumentMutation.isPending,
    openCreateModal,
    closeCreateModal,
    createNewDocument,
    error: createDocumentMutation.error,
  }
}
