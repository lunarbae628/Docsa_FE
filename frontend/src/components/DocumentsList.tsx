import type { DocListResponse } from "@/api/__generated__/models/DocListResponse"
import { Button } from "@/components/ui/button"
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useCreateDocument } from "@/hooks/useCreateDocument"
import { useDeleteDocument } from "@/hooks/useDeleteDocument"
import { useDocuments } from "@/hooks/useDocuments"
import { useEditDocument } from "@/hooks/useEditDocument"
import { getDocumentWorkspacePath } from "@/lib/documentRoute"
import { Grid3X3, List, Plus } from "lucide-react"
import { useNavigate } from "react-router"
import Loading from "./Loading"
import CreateDocumentModal from "./documents/CreateDocumentModal"
import DeleteDocumentDialog from "./documents/DeleteDocumentDialog"
import DocumentsGrid from "./documents/DocumentsGrid"
import EditDocumentModal from "./documents/EditDocumentModal"
import SearchAndCreateBar from "./documents/SearchAndCreateBar"

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
    navigate(getDocumentWorkspacePath(doc))
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
    <div className="min-h-full bg-slate-50">
      {/* 메인 컨텐츠 */}
      <main className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8">
        <SearchAndCreateBar
          searchQuery={searchQuery}
          inputValue={inputValue}
          setInputValue={setInputValue}
          handleSearch={handleSearch}
          handleResetSearch={handleResetSearch}
        />

        <section className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-base font-medium text-slate-900">최근 문서</h1>
            <p className="mt-1 text-sm text-slate-500">
              {searchQuery
                ? `'${searchQuery}' 검색 결과`
                : `총 ${pagination.totalElements}개 문서`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={sort} onValueChange={setSort}>
              <SelectTrigger className="h-9 w-28 rounded-full border-slate-200 bg-white text-slate-600 shadow-sm">
                <SelectValue placeholder="정렬" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="updatedAt">수정일</SelectItem>
                <SelectItem value="title">제목</SelectItem>
              </SelectContent>
            </Select>
            <Select value={order} onValueChange={setOrder}>
              <SelectTrigger className="h-9 w-28 rounded-full border-slate-200 bg-white text-slate-600 shadow-sm">
                <SelectValue placeholder="순서" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="desc">내림차순</SelectItem>
                <SelectItem value="asc">오름차순</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={toggleViewMode}
              className="h-9 w-9 rounded-full border-slate-200 bg-white p-0 text-slate-600 shadow-sm hover:bg-slate-50"
              type="button"
            >
              {viewMode === "grid" ? (
                <List className="h-4 w-4" />
              ) : (
                <Grid3X3 className="h-4 w-4" />
              )}
            </Button>
            <Button
              onClick={createDocument.openCreateModal}
              className="h-9 rounded-full bg-slate-900 px-4 text-sm font-medium text-white shadow-sm hover:bg-slate-800"
              type="button"
            >
              <Plus className="mr-1.5 h-4 w-4" />새 문서
            </Button>
          </div>
        </section>
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
