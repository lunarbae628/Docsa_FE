import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { MoreVertical, Edit, Trash2 } from "lucide-react"
import { formatDate, formatDateForDocuments } from "@/lib/date"
import type { DocListResponse } from "@/api/__generated__/models/DocListResponse"
import { getBlankDocumentThumbnailDataUrl } from "@/lib/documentThumbnails"

type DocumentCardDocument = DocListResponse & {
  thumbnailUrl?: string
}

interface DocumentCardProps {
  document: DocumentCardDocument
  viewMode: "grid" | "list"
  onDocumentClick: (doc: DocumentCardDocument) => void
  onEditTitle: (id: number) => void
  onDeleteDocument: (doc: DocumentCardDocument) => void
}

function formatCardDate(dateInput?: string | Date) {
  if (!dateInput) return ""

  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput

  return date
    .toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
    .replace(/\. /g, ".")
    .replace(/\.$/, "")
}

export default function DocumentCard({
  document,
  viewMode,
  onDocumentClick,
  onEditTitle,
  onDeleteDocument,
}: DocumentCardProps) {
  const thumbnailUrl =
    document.thumbnailUrl ?? getBlankDocumentThumbnailDataUrl()

  return (
    <Card
      className="group relative w-full gap-0 overflow-hidden rounded-sm border border-slate-200 bg-white py-0 shadow-none transition-colors hover:border-blue-400"
      onClick={() => onDocumentClick(document)}
    >
      <CardContent className="p-0">
        {viewMode === "grid" ? (
          // 그리드 뷰
          <div>
            {/* 미리보기 영역 */}
            <div className="flex aspect-[208/263] min-h-0 items-center justify-center overflow-hidden border-slate-200 border-b bg-white">
              {thumbnailUrl ? (
                <img
                  src={thumbnailUrl}
                  alt={`${document.title || "문서"} 썸네일`}
                  className="h-full w-full bg-white object-cover [clip-path:inset(1px)]"
                  loading="lazy"
                />
              ) : (
                <div className="h-full w-full bg-white" />
              )}
            </div>

            {/* 문서 정보 */}
            <div className="flex items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-[18px] font-medium leading-6 text-slate-800 transition-colors group-hover:text-slate-950">
                  {document.title}
                </h3>
                <div className="mt-0.5 flex items-center">
                  <p className="min-w-0 truncate text-sm leading-5 text-slate-500">
                    {formatCardDate(document.updatedAt)}
                  </p>
                </div>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 flex-shrink-0 rounded-full p-0 text-slate-500 opacity-0 hover:bg-slate-100 group-hover:opacity-100"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40">
                  <DropdownMenuItem
                    onClick={(e) => {
                      if (!document.id) return

                      e.stopPropagation()
                      onEditTitle(document.id)
                    }}
                    className="cursor-pointer"
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    제목 수정
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation()
                      onDeleteDocument(document)
                    }}
                    className="cursor-pointer text-red-600 focus:text-red-600"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    삭제
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        ) : (
          // 리스트 뷰
          <div className="flex items-center space-x-4 p-4">
            <div className="flex-shrink-0">
              <div className="flex h-16 w-11 items-center justify-center overflow-hidden rounded-sm bg-slate-50">
                {thumbnailUrl ? (
                  <img
                    src={thumbnailUrl}
                    alt={`${document.title || "문서"} 썸네일`}
                    className="h-full w-auto border border-slate-200 bg-white object-contain"
                    loading="lazy"
                  />
                ) : (
                  <div className="h-full aspect-[210/297] border border-slate-200 bg-white shadow-sm" />
                )}
              </div>
            </div>

            <div className="flex-1 min-w-0">
              <h3 className="font-medium text-slate-800 truncate group-hover:text-slate-900 transition-colors">
                {document.title}
              </h3>
              <p className="text-sm text-slate-500 truncate">
                최종편집일: {formatDateForDocuments(document.updatedAt)}
              </p>
              <p className="text-sm text-slate-400 truncate">
                최초생성일: {formatDate(document.createdAt)}
              </p>
              <p className="text-sm text-slate-600 truncate mt-1">
                {document.preview}
              </p>
            </div>

            <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 hover:bg-slate-100"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40">
                  <DropdownMenuItem
                    onClick={(e) => {
                      if (!document.id) return
                      e.stopPropagation()
                      onEditTitle(document.id)
                    }}
                    className="cursor-pointer"
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    제목 수정
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation()
                      onDeleteDocument(document)
                    }}
                    className="cursor-pointer text-red-600 focus:text-red-600"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    삭제
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
