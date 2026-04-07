import { useNavigate } from "react-router"
import Loading from "./Loading"

// Custom Hooks
import { useDocuments } from "@/hooks/useDocuments"
import { useCreateDocument } from "@/hooks/useCreateDocument"
import { useEditDocument } from "@/hooks/useEditDocument"
import { useDeleteDocument } from "@/hooks/useDeleteDocument"

// Components
import SearchAndCreateBar from "./documents/SearchAndCreateBar"
import DocumentsGrid from "./documents/DocumentsGrid"
import CreateDocumentModal from "./documents/CreateDocumentModal"
import EditDocumentModal from "./documents/EditDocumentModal"
import DeleteDocumentDialog from "./documents/DeleteDocumentDialog"
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import type { DocListResponse } from "@/api/__generated__/models/DocListResponse"

export default function DocumentsList() {
  const navigate = useNavigate()

  const {
    documents,
    searchQuery,
    inputValue,
    setInputValue,
    handleSearch,
    handleResetSearch,
    viewMode,
    toggleViewMode,
    isLoading,
    sort,
    setSort,
    order,
    setOrder,
    pagination,
    goToPage,
    goToNextPage,
    goToPreviousPage,
  } = useDocuments()

  const createDocument = useCreateDocument()

  const editDocument = useEditDocument({ documents })

  const deleteDocument = useDeleteDocument()

  // 문서 클릭 핸들러
  const handleDocumentClick = (doc: DocListResponse) => {
    console.log(`문서 ${doc.id} 열기`)
    const { recentType, recentTypeId } = doc.recent || {}
    if (recentType === "SAVE" && recentTypeId) {
      navigate(`/documents/${doc.id}?mode=save&saveId=${recentTypeId}`)
    } else if (recentType === "COMMIT" && recentTypeId) {
      navigate(`/documents/${doc.id}?mode=commit&commitId=${recentTypeId}`)
    } else {
      navigate(`/documents/${doc.id}`)
    }
  }

  // 페이지네이션 범위 계산
  const generatePageNumbers = () => {
    const { currentPage, totalPages } = pagination
    const pages: (number | "ellipsis")[] = []
    const maxVisible = 5 // 보여줄 최대 페이지 수

    if (totalPages <= maxVisible) {
      // 전체 페이지가 적으면 모두 표시
      for (let i = 0; i < totalPages; i++) {
        pages.push(i)
      }
    } else {
      // 첫 페이지와 마지막 페이지는 항상 표시
      pages.push(0)

      if (currentPage <= 2) {
        // 현재 페이지가 앞쪽에 있을 때
        for (let i = 1; i < 4; i++) {
          pages.push(i)
        }
        if (totalPages > 4) {
          pages.push("ellipsis")
        }
      } else if (currentPage >= totalPages - 3) {
        // 현재 페이지가 뒤쪽에 있을 때
        if (totalPages > 4) {
          pages.push("ellipsis")
        }
        for (let i = totalPages - 4; i < totalPages - 1; i++) {
          if (i > 0) pages.push(i)
        }
      } else {
        // 현재 페이지가 중간에 있을 때
        pages.push("ellipsis")
        for (let i = currentPage - 1; i <= currentPage + 1; i++) {
          pages.push(i)
        }
        pages.push("ellipsis")
      }

      if (totalPages > 1) {
        pages.push(totalPages - 1)
      }
    }

    return pages
  }

  if (isLoading) {
    return <Loading text="문서를 불러오는 중..." />
  }

  return (
    <div className="h-full bg-slate-50">
      {/* 메인 컨텐츠 */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 검색 및 새 문서 생성 */}
        <SearchAndCreateBar
          searchQuery={searchQuery}
          inputValue={inputValue}
          setInputValue={setInputValue}
          handleSearch={handleSearch}
          handleResetSearch={handleResetSearch}
          viewMode={viewMode}
          toggleViewMode={toggleViewMode}
          onCreateClick={createDocument.openCreateModal}
          sort={sort}
          setSort={setSort}
          order={order}
          setOrder={setOrder}
        />

        {/* 문서 리스트 */}
        <DocumentsGrid
          documents={documents}
          viewMode={viewMode}
          searchQuery={searchQuery}
          onDocumentClick={handleDocumentClick}
          onEditTitle={editDocument.handleEditTitle}
          onDeleteDocument={deleteDocument.deleteDocument}
        />

        {/* 페이지네이션 */}
        {pagination.totalPages > 1 && (
          <div className="mt-8">
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    onClick={goToPreviousPage}
                    className={
                      !pagination.hasPrevious
                        ? "pointer-events-none opacity-50"
                        : "cursor-pointer"
                    }
                  />
                </PaginationItem>

                {generatePageNumbers().map((page, index) => (
                  <PaginationItem key={index}>
                    {page === "ellipsis" ? (
                      <PaginationEllipsis />
                    ) : (
                      <PaginationLink
                        onClick={() => goToPage(page)}
                        isActive={page === pagination.currentPage}
                        className="cursor-pointer"
                      >
                        {page + 1}
                      </PaginationLink>
                    )}
                  </PaginationItem>
                ))}

                <PaginationItem>
                  <PaginationNext
                    onClick={goToNextPage}
                    className={
                      !pagination.hasNext
                        ? "pointer-events-none opacity-50"
                        : "cursor-pointer"
                    }
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>

            {/* 페이지 정보 표시 */}
            <div className="mt-4 text-center text-sm text-gray-600">
              총 {pagination.totalElements}개 문서 중{" "}
              {pagination.currentPage * 12 + 1}-
              {Math.min(
                (pagination.currentPage + 1) * 12,
                pagination.totalElements,
              )}
              개 표시
            </div>
          </div>
        )}
      </main>

      {/* 새 문서 생성 모달 */}
      <CreateDocumentModal
        isOpen={createDocument.isCreateModalOpen}
        onOpenChange={createDocument.setIsCreateModalOpen}
        title={createDocument.newDocumentTitle}
        setTitle={createDocument.setNewDocumentTitle}
        isCreating={createDocument.isCreating}
        onCreateDocument={createDocument.createNewDocument}
        onClose={createDocument.closeCreateModal}
      />

      {/* 문서 제목 수정 모달 */}
      <EditDocumentModal
        isOpen={editDocument.showEditDialog}
        onOpenChange={editDocument.setShowEditDialog}
        title={editDocument.editTitle}
        setTitle={editDocument.setEditTitle}
        isUpdating={editDocument.isUpdating}
        onUpdateTitle={editDocument.confirmEditTitle}
        onCancel={editDocument.cancelEditTitle}
      />

      {/* 문서 삭제 확인 다이얼로그 */}
      <DeleteDocumentDialog
        isOpen={deleteDocument.showDeleteDialog}
        onOpenChange={deleteDocument.setShowDeleteDialog}
        document={deleteDocument.documentToDelete}
        onConfirmDelete={deleteDocument.confirmDeleteDocument}
        onCancel={deleteDocument.cancelDeleteDocument}
      />
    </div>
  )
}
