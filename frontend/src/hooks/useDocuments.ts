import type { DocListResponse } from "@/api/__generated__"
import type { PageDocListResponse } from "@/api/__generated__/models/PageDocListResponse"
import { apiClient } from "@/api/apiClient"
import { useQuery } from "@tanstack/react-query"
import { useMemo, useState } from "react"
import { useAuth } from "./useAuth"

const PAGE_SIZE = 12

type Sort = "title" | "updatedAt"
type Order = "asc" | "desc"

type DocListResponseWithThumbnail = DocListResponse & {
  thumbnailUrl?: string
  recentSaveId?: number
  thumbnail?: {
    thumbnailUrl?: string
  }
}

// API 응답을 프론트엔드 Document 타입으로 변환
function transformDocListResponse(apiDoc: DocListResponse) {
  const docWithThumbnail = apiDoc as DocListResponseWithThumbnail

  return {
    id: apiDoc.id || 0,
    title: apiDoc.title || "제목 없음",
    createdAt: apiDoc.createdAt || new Date().toISOString(),
    updatedAt: apiDoc.updatedAt || new Date().toISOString(),
    preview: apiDoc.preview || "미리보기가 없습니다.",
    thumbnailUrl:
      docWithThumbnail.thumbnail?.thumbnailUrl ?? docWithThumbnail.thumbnailUrl,
    recentSaveId: docWithThumbnail.recentSaveId,
    recent: apiDoc.recent
      ? {
          recentType: apiDoc.recent.recentType,
          recentTypeId: apiDoc.recent.recentTypeId,
        }
      : undefined,
  }
}

export function useDocuments() {
  const [searchQuery, setSearchQuery] = useState("")
  const [inputValue, setInputValue] = useState("") // input의 내부 값을 관리
  const [sort, setSort] = useState<Sort>("updatedAt")
  const [order, setOrder] = useState<Order>("desc")
  const [currentPage, setCurrentPage] = useState(0) // 페이지는 0부터 시작
  const { isAuthenticated } = useAuth()

  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")

  // 검색 실행 함수
  const handleSearch = () => {
    setSearchQuery(inputValue.trim())
    setCurrentPage(0) // 검색 시 첫 페이지로 이동
  }

  // 검색 초기화 함수
  const handleResetSearch = () => {
    setInputValue("")
    setSearchQuery("")
    setCurrentPage(0) // 검색 초기화 시 첫 페이지로 이동
  }

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["documents", sort, order, searchQuery, currentPage],
    queryFn: async () => {
      // 검색 쿼리가 있으면 search API 사용, 없으면 readList API 사용
      if (searchQuery.trim()) {
        const response = await apiClient.document.search({
          keyword: searchQuery.trim(),
          page: currentPage,
          sort: sort,
          order: order,
          size: PAGE_SIZE,
        })
        return response as unknown as PageDocListResponse
      } else {
        const response = await apiClient.document.readList({
          page: currentPage,
          sort: sort,
          order: order,
          size: PAGE_SIZE,
        })
        return response as unknown as PageDocListResponse
      }
    },
    enabled: isAuthenticated,
  })

  // 문서 목록
  const documents = useMemo(() => {
    return (data?.content ?? []).map(transformDocListResponse)
  }, [data])

  // 페이지네이션 정보
  const pagination = useMemo(() => {
    if (!data) {
      return {
        currentPage: 0,
        totalPages: 0,
        totalElements: 0,
        isFirst: true,
        isLast: true,
        hasNext: false,
        hasPrevious: false,
      }
    }

    return {
      currentPage: data.number ?? 0,
      totalPages: data.totalPages ?? 0,
      totalElements: data.totalElements ?? 0,
      isFirst: data.first ?? true,
      isLast: data.last ?? true,
      hasNext: !data.last,
      hasPrevious: !data.first,
    }
  }, [data])

  // 페이지 변경 함수
  const goToPage = (page: number) => {
    if (page >= 0 && page < pagination.totalPages) {
      setCurrentPage(page)
    }
  }

  const goToNextPage = () => {
    if (pagination.hasNext) {
      setCurrentPage(currentPage + 1)
    }
  }

  const goToPreviousPage = () => {
    if (pagination.hasPrevious) {
      setCurrentPage(currentPage - 1)
    }
  }

  const goToFirstPage = () => {
    setCurrentPage(0)
  }

  const goToLastPage = () => {
    if (pagination.totalPages > 0) {
      setCurrentPage(pagination.totalPages - 1)
    }
  }

  const toggleViewMode = () => {
    setViewMode(viewMode === "grid" ? "list" : "grid")
  }

  return {
    // Raw data
    documents,
    isLoading,
    error,
    refetch,
    // Pagination
    pagination,
    currentPage,
    goToPage,
    goToNextPage,
    goToPreviousPage,
    goToFirstPage,
    goToLastPage,
    // Search functionality
    searchQuery,
    inputValue,
    setInputValue,
    handleSearch,
    handleResetSearch,
    viewMode,
    toggleViewMode,
    // Sort functionality
    sort,
    setSort,
    order,
    setOrder,
  }
}
