import { useState } from "react"
import { useNavigate } from "react-router"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { apiClient } from "@/api/apiClient"
import { alertDialog } from "@/lib/utils"
import { getApiErrorMessage } from "@/lib/apiError"

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
    retry: false,
    onSuccess: (response) => {
      // 목록 화면에 다시 진입할 때 최신 projection을 가져오도록 stale 처리만 한다.
      queryClient.invalidateQueries({
        queryKey: ["documents"],
        refetchType: "none",
      })

      // 모달 닫기
      closeCreateModal()

      // 새 문서로 이동 (임시 저장 모드로)
      const newDocumentId = response.id
      const nextUrl =
        response.saveId != null
          ? `/documents/${newDocumentId}?mode=save&saveId=${response.saveId}`
          : `/documents/${newDocumentId}`

      navigate(nextUrl)

      console.log("새 문서 생성됨:", response)
    },
    onError: async (error: any) => {
      console.error("문서 생성 실패:", error)

      // 서버에서 내려온 에러 메시지 추출
      const errorMessage = await getApiErrorMessage(
        error,
        "문서 생성에 실패했습니다.",
      )

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
    const title = newDocumentTitle.trim()
    if (!title || createDocumentMutation.isPending) return
    createDocumentMutation.mutate(title)
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
