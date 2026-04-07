import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { apiClient } from "@/api/apiClient"
import { useAuth } from "./useAuth"
import type { DocListSimpleResponse } from "@/api/__generated__"
import type { PageDocListSimpleResponse } from "@/api/__generated__/models/PageDocListSimpleResponse"

type Sort = "title" | "updatedAt"
type Order = "asc" | "desc"

// API 응답을 프론트엔드 Document 타입으로 변환
function transformDocListSimpleResponse(apiDoc: DocListSimpleResponse) {
  return {
    id: apiDoc.id || 0,
    title: apiDoc.title || "제목 없음",
    createdAt: apiDoc.createdAt || new Date().toISOString(),
    updatedAt: apiDoc.updatedAt || new Date().toISOString(),
    recent: apiDoc.recent
      ? {
          recentType: apiDoc.recent.recentType,
          recentTypeId: apiDoc.recent.recentTypeId,
        }
      : undefined,
  }
}

interface UseDocumentsBySidebarParams {
  sort?: Sort
  order?: Order
  page?: number
  size?: number
}

export function useDocumentsBySidebar(
  params: UseDocumentsBySidebarParams = {},
) {
  const { isAuthenticated } = useAuth()
  const { sort = "updatedAt", order = "desc", page = 0, size = 10 } = params

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["documents-sidebar", { sort, order, page, size }],
    queryFn: async () => {
      const response = await apiClient.document.readListSidebar({
        sort,
        order,
        page,
        size,
      })
      // 실제로는 PageDocListSimpleResponse를 반환하므로 타입 단언 사용
      return response as unknown as PageDocListSimpleResponse
    },
    enabled: isAuthenticated,
  })

  // 문서 목록 변환
  const documents = useMemo(() => {
    if (!data?.content) return []
    return data.content.map(transformDocListSimpleResponse)
  }, [data])

  return {
    documents,
    isLoading,
    error,
    refetch,
    // 페이징 정보
    totalElements: data?.totalElements || 0,
    totalPages: data?.totalPages || 0,
    currentPage: data?.number || 0,
    hasNext: !data?.last,
    hasPrevious: !data?.first,
    size,
  }
}
