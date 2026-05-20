import type { DocListSimpleResponse } from "@/api/__generated__/models/DocListSimpleResponse"
import type { PageDocListSimpleResponse } from "@/api/__generated__/models/PageDocListSimpleResponse"
import { apiClient } from "@/api/apiClient"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { formatDateForDocuments } from "@/lib/date"
import { getDocumentWorkspacePath } from "@/lib/documentRoute"
import { useQuery } from "@tanstack/react-query"
import {
  ChevronRight,
  Clock3,
  FileText,
  Loader2,
  Menu,
  RotateCw,
} from "lucide-react"
import { useState } from "react"
import { useNavigate } from "react-router"

const SIDEBAR_DOCUMENT_PAGE_SIZE = 10

type DocumentSidebarQuickMenuProps = {
  currentDocumentId: number
  triggerLabel?: string
  align?: "start" | "center" | "end"
}

export default function DocumentSidebarQuickMenu({
  currentDocumentId,
  triggerLabel,
  align = "start",
}: DocumentSidebarQuickMenuProps) {
  const navigate = useNavigate()
  const [isOpen, setIsOpen] = useState(false)

  const sidebarQuery = useQuery({
    queryKey: ["documents", "sidebar", SIDEBAR_DOCUMENT_PAGE_SIZE],
    queryFn: async () => {
      const response = await apiClient.document.readListSidebar({
        sort: "updatedAt",
        order: "desc",
        page: 0,
        size: SIDEBAR_DOCUMENT_PAGE_SIZE,
      })

      return response as PageDocListSimpleResponse
    },
    enabled: isOpen,
    staleTime: 30_000,
  })

  const documents = sidebarQuery.data?.content ?? []

  const openDocument = (document: DocListSimpleResponse) => {
    navigate(getDocumentWorkspacePath(document))
  }

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size={triggerLabel ? "sm" : "icon"}
          className={`h-9 rounded-xl border-slate-200 bg-white text-slate-700 shadow-sm hover:border-slate-300 hover:bg-slate-50 ${
            triggerLabel ? "gap-2 px-3" : "w-9"
          }`}
          aria-label="문서 목록 열기"
        >
          <Menu className="h-4 w-4" />
          {triggerLabel ? (
            <span className="text-sm font-semibold">{triggerLabel}</span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align={align}
        sideOffset={10}
        className="w-[360px] overflow-hidden rounded-2xl border-slate-200 bg-white p-0 shadow-[0_24px_60px_rgba(15,23,42,0.18)]"
      >
        <div className="border-b border-slate-200 bg-slate-950 px-4 py-3 text-white">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">문서 빠른 이동</p>
              <p className="mt-1 text-xs text-slate-300">
                최근 수정한 문서 {sidebarQuery.data?.totalElements ?? 0}개
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 rounded-full px-3 text-xs text-slate-200 hover:bg-white/10 hover:text-white"
              onClick={(event) => {
                event.preventDefault()
                void sidebarQuery.refetch()
              }}
              disabled={sidebarQuery.isFetching}
            >
              {sidebarQuery.isFetching ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RotateCw className="h-3.5 w-3.5" />
              )}
              새로고침
            </Button>
          </div>
        </div>

        <div className="scrollbar-none max-h-[420px] overflow-y-auto p-2">
          {sidebarQuery.isLoading ? (
            <div className="flex items-center justify-center gap-2 px-4 py-8 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              문서를 불러오는 중
            </div>
          ) : sidebarQuery.error ? (
            <div className="px-4 py-8 text-center">
              <p className="text-sm font-semibold text-red-600">
                문서 목록을 불러오지 못했습니다.
              </p>
              <button
                type="button"
                className="mt-3 text-xs font-semibold text-slate-600 underline underline-offset-4 hover:text-slate-900"
                onClick={() => void sidebarQuery.refetch()}
              >
                다시 시도
              </button>
            </div>
          ) : documents.length ? (
            documents.map((document) => {
              const isCurrent = document.id === currentDocumentId
              const recentTypeLabel =
                document.recent?.recentType === "COMMIT"
                  ? "최근 기록"
                  : "워크스페이스"

              return (
                <DropdownMenuItem
                  key={document.id}
                  className={`group mb-1 cursor-pointer rounded-xl p-0 focus:bg-transparent ${
                    isCurrent ? "bg-blue-50" : ""
                  }`}
                  onSelect={() => openDocument(document)}
                >
                  <div
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 transition-colors ${
                      isCurrent
                        ? "bg-blue-50 group-hover:bg-blue-50 group-focus:bg-blue-50"
                        : "group-hover:bg-slate-50 group-focus:bg-slate-50"
                    }`}
                  >
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                        isCurrent
                          ? "bg-blue-100 text-blue-700"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      <FileText className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-semibold text-slate-900">
                          {document.title || "제목 없음"}
                        </p>
                        {isCurrent ? (
                          <span className="shrink-0 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                            현재
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-600">
                          {recentTypeLabel}
                        </span>
                        <span className="flex min-w-0 items-center gap-1 truncate">
                          <Clock3 className="h-3 w-3 shrink-0" />
                          {formatDateForDocuments(document.updatedAt)}
                        </span>
                      </div>
                    </div>
                    <ChevronRight
                      className={`h-4 w-4 shrink-0 transition-colors ${
                        isCurrent
                          ? "text-blue-300 group-hover:text-blue-500"
                          : "text-slate-300 group-hover:text-slate-500"
                      }`}
                    />
                  </div>
                </DropdownMenuItem>
              )
            })
          ) : (
            <div className="px-4 py-8 text-center text-sm text-slate-500">
              아직 문서가 없습니다.
            </div>
          )}
        </div>

        <div className="border-t border-slate-200 bg-slate-50 p-2">
          <DropdownMenuItem
            className="cursor-pointer rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 focus:bg-white"
            onSelect={() => navigate("/documents")}
          >
            전체 문서 화면으로 이동
            <ChevronRight className="ml-auto h-4 w-4 text-slate-400" />
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
