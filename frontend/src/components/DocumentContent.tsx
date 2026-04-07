import DocumentEditor, { type DocumentEditorRef } from "./DocumentEditor"
import DocumentCompareView from "./DocumentCompareView"
import SaveCommitModal from "./SaveCommitModal"
import { EditData } from "@/mock/EditData"
import type { DocumentContentMode, DocumentMode } from "@/types/document"
import { useDocumentContent } from "@/hooks/useDocumentContent"
import type { OutputData } from "@editorjs/editorjs"
import { Button } from "./ui/button"
import { apiClient } from "@/api/apiClient"
import { useRef, useState, useMemo, useCallback } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { calculateBlockDiffById } from "@/lib/diffUtils"
import { editorDataToMarkdown, markdownToEditorData } from "@/lib/editorMarkdown"

import { useDialog, alertDialog } from "./ui/alert-dialog"
import { useNavigate } from "react-router"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog"

export default function DocumentContent({
  documentMode,
  contentMode,
  documentId,
  branchId,
  branchName,
  commitId,
  saveId,
  compareId,
  currentBranchLastCommitId,
}: {
  documentMode: DocumentMode
  contentMode: DocumentContentMode
  documentId: number
  branchId: number
  branchName: string
  commitId: string | null
  saveId: string | null
  compareId: string | null
  currentBranchLastCommitId: number | null
}) {
  const { originalData, modifiedData, commitDiffData, isLoading, error } =
    useDocumentContent({
      documentMode,
      commitId,
      saveId,
      compareId,
      documentId,
      currentBranchLastCommitId,
    })

  const editorRef = useRef<DocumentEditorRef>(null)
  const queryClient = useQueryClient()
  const { showDialog } = useDialog()
  const [modalState, setModalState] = useState<{
    isOpen: boolean
    mode: "save" | "commit"
  }>({ isOpen: false, mode: "save" })
  const [markdownModal, setMarkdownModal] = useState<{
    open: boolean
    mode: "import" | "export"
    value: string
  }>({
    open: false,
    mode: "export",
    value: "",
  })

  const navigate = useNavigate()

  // API 데이터를 OutputData로 변환하는 함수
  const convertToEditorData = useCallback((data: any): OutputData => {
    if (!data) return EditData

    // 이미 OutputData 형태라면 그대로 반환
    if (data.blocks && data.time && data.version) {
      return data as OutputData
    }

    // API 데이터 배열을 OutputData로 변환
    if (Array.isArray(data)) {
      return {
        time: EditData.time, // 고정된 time을 사용하여 불필요한 재생성 방지
        blocks: data,
        version: "2.30.8",
      } as OutputData
    }

    return EditData
  }, [])

  // 에디터 데이터를 메모이제이션하여 불필요한 재렌더링 방지
  const originalEditorData = useMemo(
    () => convertToEditorData(originalData),
    [originalData, convertToEditorData],
  )

  const modifiedEditorData = useMemo(
    () => convertToEditorData(modifiedData),
    [modifiedData, convertToEditorData],
  )

  // 데이터 변경 핸들러 (편집 모드에서 사용)
  const onDataChange = (newData: OutputData) => {
    // TODO: 데이터 변경 로직 구현
    console.log("데이터 변경:", newData)
  }

  // 저장 API 호출
  const saveMutation = useMutation({
    mutationFn: async ({
      content,
    }: {
      content: any[]
    }) => {
      if (!saveId) throw new Error("저장 ID가 없습니다")

      return await apiClient.save.updateSave({
        docId: documentId,
        saveId: Number(saveId),
        saveUpdateRequest: {
          content,
        },
      })
    },
    onSuccess: async () => {
      // 그래프 데이터만 refetch (문서 내용은 현재 편집 중인 상태 유지)
      queryClient.invalidateQueries({ queryKey: ["graphData", documentId] })
      setModalState({ isOpen: false, mode: "save" })

      // 저장 완료 메시지 표시
      await alertDialog("저장이 완료되었습니다.", "완료", "default")
    },
    onError: async (error: any) => {
      console.error("저장 실패:", error)

      // 서버에서 내려온 에러 메시지 추출
      const errorMessage = error.message || "저장에 실패했습니다."

      console.log("errorMessage", errorMessage)

      await alertDialog(errorMessage, "오류", "destructive")
    },
  })

  // 기록 API 호출
  const commitMutation = useMutation({
    mutationFn: async ({
      title,
      description,
      blocks,
      blockOrders,
    }: {
      title: string
      description?: string
      blocks: any[]
      blockOrders: string[]
    }) => {
      return await apiClient.commit.createCommit({
        docId: documentId,
        createCommitRequest: {
          title,
          description,
          blocks,
          blockOrders: blockOrders,
          branchId,
        },
      })
    },
    onSuccess: () => {
      // 그래프 데이터만 refetch (문서 내용은 현재 편집 중인 상태 유지)
      queryClient.invalidateQueries({ queryKey: ["graphData", documentId] })
      setModalState({ isOpen: false, mode: "commit" })
    },
    onError: async (error: any) => {
      console.error("기록 실패:", error)

      // 서버에서 내려온 에러 메시지 추출
      const  errorMessage =  error.message || "기록에 실패했습니다."

      console.log("errorMessage", errorMessage)

      await alertDialog(errorMessage, "오류", "destructive")
    },
  })

  // 저장하기 버튼 클릭 핸들러
  const handleSave = async () => {
    if (!editorRef.current) {
      await alertDialog("에디터가 준비되지 않았습니다.", "오류", "destructive")
      return
    }

    const currentData = await editorRef.current.saveData()
    if (!currentData) {
      await alertDialog(
        "현재 문서 데이터를 가져올 수 없습니다.",
        "오류",
        "destructive",
      )
      return
    }

    const content = currentData.blocks || []
    saveMutation.mutate({ content })
  }

  // 기록하기 버튼 클릭 핸들러
  const handleCommit = () => {
    setModalState({ isOpen: true, mode: "commit" })
  }

  const handleOpenMarkdownExport = async () => {
    const currentData =
      (await editorRef.current?.saveData()) ?? originalEditorData ?? EditData

    setMarkdownModal({
      open: true,
      mode: "export",
      value: editorDataToMarkdown(currentData),
    })
  }

  const handleOpenMarkdownImport = () => {
    setMarkdownModal({
      open: true,
      mode: "import",
      value: "",
    })
  }

  const handleApplyMarkdownImport = async () => {
    if (!editorRef.current) {
      await alertDialog("에디터가 준비되지 않았습니다.", "오류", "destructive")
      return
    }

    const nextData = markdownToEditorData(markdownModal.value)
    await editorRef.current.updateData(nextData)
    setMarkdownModal({ open: false, mode: "import", value: "" })
  }

  // Modal 확인 핸들러
  const handleModalConfirm = async ({
    title,
    description,
  }: {
    title: string
    description?: string
  }) => {
    if (!editorRef.current) {
      await alertDialog("에디터가 준비되지 않았습니다.", "오류", "destructive")
      return
    }

    const currentData = await editorRef.current.saveData()
    if (!currentData) {
      await alertDialog(
        "현재 문서 데이터를 가져올 수 없습니다.",
        "오류",
        "destructive",
      )
      return
    }

    const content = currentData.blocks || []

    if (modalState.mode === "save") {
      saveMutation.mutate({ content })
    } else {
      // 원본 데이터와 현재 데이터를 비교하여 변경된 블록만 추출
      const prevCommitDiffEditorData = convertToEditorData(commitDiffData)
      const blockDiffs = calculateBlockDiffById(
        prevCommitDiffEditorData,
        currentData,
      )

      // 추가되거나 수정된 블록만 필터링
      const changedBlocks: any[] = []
      for (const diff of blockDiffs) {
        if (diff.type === "added" || diff.type === "modified") {
          const block = diff.newBlock || diff.block
          if (block) {
            changedBlocks.push(block)
          }
        }
      }

      const res = await commitMutation.mutateAsync({
        title,
        description,
        blocks: changedBlocks,
        blockOrders: content.map(
          (block, index) => block.id ?? index.toString(),
        ),
      })

      if (!res.id) {
        throw new Error("기록 ID가 없습니다")
      }

      if (!saveId) {
        navigate(`/documents/${documentId}?mode=commit&commitId=${res.id}`)
        return
      }

      navigate(`/documents/${documentId}?mode=save&saveId=${saveId}`)
    }
  }

  // 로딩 상태
  if (isLoading) {
    return <div>데이터를 로딩 중입니다...</div>
  }

  // 에러 상태
  if (error) {
    return <div>오류: {error}</div>
  }

  return (
    <>
      {renderContent()}
      <SaveCommitModal
        isOpen={modalState.isOpen}
        mode={modalState.mode}
        onClose={() => setModalState({ isOpen: false, mode: "save" })}
        onConfirm={handleModalConfirm}
        isLoading={
          saveMutation.isPending || commitMutation.isPending
        }
      />
      <Dialog
        open={markdownModal.open}
        onOpenChange={(open) =>
          setMarkdownModal((prev) => ({ ...prev, open }))
        }
      >
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {markdownModal.mode === "import"
                ? "Markdown 가져오기"
                : "Markdown 내보내기"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <textarea
              value={markdownModal.value}
              onChange={(event) =>
                setMarkdownModal((prev) => ({
                  ...prev,
                  value: event.target.value,
                }))
              }
              readOnly={markdownModal.mode === "export"}
              className="min-h-[420px] w-full rounded-xl border border-slate-200 bg-white px-4 py-4 font-mono text-sm leading-6 text-slate-800 outline-none"
            />
            <div className="flex justify-end gap-2">
              {markdownModal.mode === "export" ? (
                <Button
                  variant="outline"
                  onClick={async () => {
                    await navigator.clipboard.writeText(markdownModal.value)
                  }}
                >
                  복사하기
                </Button>
              ) : (
                <Button onClick={handleApplyMarkdownImport}>적용하기</Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )

  function renderContent() {
    switch (contentMode) {
      case "edit":
        return (
          <div className="h-full flex flex-col">
            <DocumentEditor
              ref={editorRef}
              isEditable={true}
              initialData={originalEditorData}
              onDataChange={onDataChange}
              disableAutoUpdate={true}
            />
            <div className="flex justify-end gap-10 mt-4 p-4 border-t">
              <Button onClick={handleOpenMarkdownImport} variant="outline" size="2xl">
                Markdown 가져오기
              </Button>
              <Button onClick={handleOpenMarkdownExport} variant="outline" size="2xl">
                Markdown 내보내기
              </Button>
              <Button
                onClick={handleSave}
                variant="outline"
                size="2xl"
                disabled={saveMutation.isPending}
              >
                저장하기
              </Button>
              <Button
                onClick={handleCommit}
                variant="default"
                size="2xl"
                disabled={commitMutation.isPending}
              >
                기록하기
              </Button>
            </div>
          </div>
        )
      case "view":
        return (
          <DocumentEditor
            isEditable={false}
            initialData={originalEditorData}
            onDataChange={onDataChange}
            disableAutoUpdate={true}
          />
        )
      case "compare":
        return (
          <DocumentCompareView
            originalData={originalEditorData || EditData}
            modifiedData={modifiedEditorData || EditData}
          />
        )
      default:
        return <div>Unknown mode: {contentMode}</div>
    }
  }
}
