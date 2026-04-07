import ResizableLayout from "@/layouts/ResizableLayout"
import DocumentMergeView from "@/components/DocumentMergeView"
import { useQuery, useMutation } from "@tanstack/react-query"
import { useSearchParams, useNavigate } from "react-router"
import { apiClient } from "@/api/apiClient"
import type { OutputData } from "@editorjs/editorjs"
import Loading from "@/components/Loading"
import { alertDialog } from "@/lib/utils"

export default function MergePage() {
  const [searchParams] = useSearchParams()
  const documentId = searchParams.get("documentId")
  const baseCommitId = searchParams.get("baseCommitId")
  const targetCommitId = searchParams.get("targetCommitId")

  const navigate = useNavigate()

  if (!documentId || !baseCommitId || !targetCommitId) {
    throw new Error("Invalid search params")
  }

  const {
    data: mergeData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["compareMergeCommit", documentId, baseCommitId, targetCommitId],
    queryFn: async () => {
      const response = await apiClient.merge.compare({
        docId: Number(documentId),
        base: Number(baseCommitId),
        target: Number(targetCommitId),
      })
      return response
    },
  })

  const mergeMutation = useMutation({
    mutationFn: async (mergedData: OutputData) => {
      const content = mergedData.blocks

      const response = await apiClient.merge.merge({
        docId: Number(documentId),
        mergeRequest: {
          branchName: `merge-${baseCommitId}-${targetCommitId}`,
          baseCommitId: Number(baseCommitId),
          targetCommitId: Number(targetCommitId),
          content,
        },
      })

      return response
    },
    onSuccess: () => {
      // 성공 후 문서 상세 페이지로 이동
      navigate(`/documents/${documentId}`)
      window.location.reload()
    },
    onError:  (error: any) => {
      console.error("Merge failed:", error)

      // 서버에서 내려온 에러 메시지 추출
      const errorMessage = error.message || "병합 중 오류가 발생했습니다.";

      // 에러 처리 (추후 toast 등으로 개선 가능)
      alertDialog(errorMessage, "병합 오류", "destructive")
    },
  })

  const handleSave = async (mergedData: OutputData) => {
    mergeMutation.mutate(mergedData)
  }

  const handleCancel = () => {
    navigate(-1)
  }

  if (isLoading) {
    return <Loading text="병합 데이터를 불러오는 중..." />
  }

  if (mergeMutation.isPending) {
    return <Loading text="병합을 저장하는 중..." />
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-red-500">
          데이터를 불러오는 중 오류가 발생했습니다: {error.message}
        </div>
      </div>
    )
  }

  if (!mergeData?.base || !mergeData?.target) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500">병합할 데이터가 없습니다.</div>
      </div>
    )
  }

  // API 응답을 OutputData 형태로 변환
  const baseData: OutputData = {
    time: Date.now(),
    blocks: mergeData.base as any,
    version: "2.28.2",
  }

  const targetData: OutputData = {
    time: Date.now(),
    blocks: mergeData.target as any,
    version: "2.28.2",
  }

  return (
    <DocumentMergeView
      baseData={baseData}
      targetData={targetData}
      onSave={handleSave}
      onCancel={handleCancel}
    />
  )
}
