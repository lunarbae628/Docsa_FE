import { FileText } from "lucide-react"
import DocumentCard from "./DocumentCard"
import type { DocListResponse } from "@/api/__generated__"

interface DocumentsGridProps {
  documents: DocListResponse[]
  viewMode: "grid" | "list"
  searchQuery: string
  onDocumentClick: (doc: DocListResponse) => void
  onEditTitle: (id: number) => void
  onDeleteDocument: (doc: DocListResponse) => void
}

export default function DocumentsGrid({
  documents,
  viewMode,
  searchQuery,
  onDocumentClick,
  onEditTitle,
  onDeleteDocument,
}: DocumentsGridProps) {
  if (documents.length === 0) {
    return (
      <div className="text-center py-12">
        <FileText className="h-12 w-12 text-slate-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-slate-600 mb-2">
          {searchQuery ? "검색 결과가 없습니다" : "문서가 없습니다"}
        </h3>
        <p className="text-slate-500">
          {searchQuery
            ? "다른 검색어를 시도해보세요"
            : "새 문서를 만들어 시작해보세요"}
        </p>
      </div>
    )
  }

  return (
    <div
      className={
        viewMode === "grid"
          ? "grid grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-x-5 gap-y-7"
          : "space-y-4"
      }
    >
      {documents.map((doc) => (
        <DocumentCard
          key={doc.id}
          document={doc}
          viewMode={viewMode}
          onDocumentClick={onDocumentClick}
          onEditTitle={onEditTitle}
          onDeleteDocument={onDeleteDocument}
        />
      ))}
    </div>
  )
}
