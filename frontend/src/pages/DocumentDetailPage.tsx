import ResizableLayout from "@/layouts/ResizableLayout"
import DocumentGraph from "@/components/DocumentGraph"
import { useGraphData } from "@/hooks/useGraphData"
import { useParams, useNavigate, useSearchParams } from "react-router"
import { useState } from "react"
import { Menu } from "lucide-react"
import Loading from "@/components/Loading"
import DocumentListModal from "@/components/DocumentListModal"
import DocumentContent, {} from "@/components/DocumentContent"
import BranchEditModal from "@/components/BranchEditModal"

import { alert, confirm, alertDialog } from "@/lib/utils"
import type { CommitNodeMenuType } from "@/components/CommitNode"
import type { TempNodeMenuType } from "@/components/TempNode"
import type { DocumentMode, DocumentContentMode } from "@/types/document"
import { useMutation } from "@tanstack/react-query"
import { apiClient } from "@/api/apiClient"
import type { RecentActivityDtoRecentTypeEnum } from "@/api/__generated__/models/RecentActivityDto"

export default function DocumentDetailPage() {
  const { id: documentId } = useParams<{
    id: string
  }>()

  if (!documentId) {
    throw new Error("Document ID is required")
  }

  // API를 통해 그래프 데이터 가져오기
  const {
    data: graphData,
    isLoading: isGraphLoading,
    error: graphError,
  } = useGraphData({
    documentId: Number.parseInt(documentId),
  })

  const mainBranch = graphData?.branches.find((b) => b.name === "main")

  const [searchParams] = useSearchParams()

  // 특정 query parameter 값 가져오기
  const modeParam = searchParams.get("mode")
  const mode =
    (modeParam as DocumentMode) ??
    (mainBranch?.saveId ? "save" : mainBranch?.leafCommitId ? "commit" : null)
  console.log("#mode", mode)
  const commitId =
    mode === "save"
      ? null
      : (searchParams.get("commitId") ??
        mainBranch?.leafCommitId?.toString() ??
        null)
  console.log("#commitId", commitId)
  const compareCommitId = searchParams.get("compareCommitId")
  const saveId = searchParams.get("saveId") ?? mainBranch?.saveId?.toString()

  const navigate = useNavigate()
  const [isDocumentListOpen, setIsDocumentListOpen] = useState(false)
  const [isBranchEditModalOpen, setIsBranchEditModalOpen] = useState(false)
  const [branchEditData, setBranchEditData] = useState<{
    commitId: number
    isLastCommit: boolean
    currentBranchName?: string
  } | null>(null)

  // 현재 브랜치 ID 계산
  const getCurrentBranchId = () => {
    if (commitId) {
      const commit = graphData?.commits.find(
        (c) => c.id.toString() === commitId,
      )
      return commit?.branchId
    }
    if (saveId) {
      const saveBranch = graphData?.branches.find(
        (b) => b.saveId?.toString() === saveId,
      )
      return saveBranch?.id
    }
    return mainBranch?.id
  }

  const currentBranchId = getCurrentBranchId()
  const currentBranch = graphData?.branches.find(
    (b) => b.id === currentBranchId,
  )
  const currentBranchLastCommitId = currentBranch?.leafCommitId ?? null

  const handleDocumentListModalClick = (
    documentId: number,
    recent: {
      recentType: RecentActivityDtoRecentTypeEnum
      recentTypeId: number
    },
  ) => {
    setIsDocumentListOpen(false)

    const documentMode = recent.recentType === "SAVE" ? "save" : "commit"

    navigate(
      `/documents/${documentId}?mode=${documentMode}&${documentMode}Id=${recent.recentTypeId}`,
    )
  }

  const handleNodeMenuClick = async (
    type: CommitNodeMenuType | TempNodeMenuType,
    idByType: number, // commitId or saveId
    isLastCommit = false,
  ) => {
    console.log("node click", type, documentId, commitId)
    switch (type) {
      case "commit-view":
        navigate(`/documents/${documentId}?mode=commit&commitId=${idByType}`)
        break
      case "commit-compare": {
        if (!commitId || !idByType || commitId === idByType.toString()) {
          console.log("here", commitId, idByType)
          return
        }
        const comparedCommitId = idByType

        navigate(
          `/documents/${documentId}?mode=compare&commitId=${commitId}&compareCommitId=${comparedCommitId}`,
        )
        break
      }
      case "commit-continueEdit": {
        // 현재 브랜치 이름 찾기
        const currentCommit = graphData?.commits.find((c) => c.id === idByType)
        const currentBranch = graphData?.branches.find(
          (b) => b.id === currentCommit?.branchId,
        )

        setBranchEditData({
          commitId: idByType,
          isLastCommit,
          currentBranchName: currentBranch?.name || "",
        })
        setIsBranchEditModalOpen(true)
        break
      }
      case "commit-merge": {
        // 현재 커밋과 선택된 커밋을 병합
        if (!commitId || !idByType || commitId === idByType.toString()) {
          return
        }
        navigate(
          `/merge?documentId=${documentId}&baseCommitId=${commitId}&targetCommitId=${idByType}`,
        )
        break
      }
      case "commit-delete":
        // 삭제처리
        handleCommitDelete(idByType)
        break
      case "temp-edit":
        console.log("temp-edit", idByType)
        navigate(`/documents/${documentId}?mode=save&saveId=${idByType}`)
        break
    }
  }

  // 브랜치 생성/편집 확인 핸들러
  const handleBranchEditConfirm = async (branchName: string) => {
    if (!branchEditData) return

    try {
      const result = await apiClient.branch.createBranchOrSave({
        documentId: Number.parseInt(documentId),
        branchCreateRequest: {
          name: branchName,
          fromCommitId: branchEditData.commitId,
        },
      })

      if (!result.branchId || !result.saveId) {
        alertDialog("브랜치 생성에 실패했습니다.", "오류", "destructive")
        return
      }

      setIsBranchEditModalOpen(false)
      setBranchEditData(null)

      navigate(`/documents/${documentId}?mode=save&saveId=${result.saveId}`)

      window.location.reload()
    } catch (error: any) {
      console.error("버전 생성 중 오류:", error)

      // 서버에서 내려온 에러 메시지 추출
      const errorMessage = error.message || "버전 생성 중 오류가 발생했습니다."

      console.log("errorMessage", errorMessage)

      alertDialog(errorMessage, "오류", "destructive")
    }
  }

  // 브랜치 삭제 mutation
  const deleteBranchMutation = useMutation({
    mutationFn: async ({
      documentId,
      branchId,
    }: { documentId: number; branchId: number }) => {
      await apiClient.branch.deleteBranch({
        documentId,
        branchId,
      })
    },
    onSuccess: () => {
      // 삭제 성공 시 페이지 리로드
      window.location.reload()
    },
    onError:  (error: any) => {
      console.error("버전 삭제 중 오류:", error)

      // 서버에서 내려온 에러 메시지 추출
      const errorMessage = error.message || "버전 삭제 중 오류가 발생했습니다."

      alertDialog(errorMessage, "오류", "destructive")
    },
  })

  // 커밋 삭제 mutation
  const deleteCommitMutation = useMutation({
    mutationFn: async ({
      docId,
      commitId,
    }: { docId: number; commitId: number }) => {
      await apiClient.commit.deleteCommit({
        docId,
        commitId,
      })
    },
    onSuccess: () => {
      // 삭제 성공 시 페이지 리로드
      window.location.reload()
    },
    onError: async (error: any) => {
      console.error("커밋 삭제 중 오류:", error)

      // 서버에서 내려온 에러 메시지 추출
      const errorMessage = error.message || "커밋 삭제 중 오류가 발생했습니다."

      alertDialog(errorMessage, "오류", "destructive")
    },
  })

  const handleBranchDelete = async (branchId: number) => {
    if (!graphData) return

    console.log("Branch delete:", branchId)

    const branch = graphData.branches.find((b) => b.id === branchId)
    if (!branch) return

    // 안전성 검사
    if (branch.name === "main") {
      alert("메인 브랜치는 삭제할 수 없습니다.", "destructive")
      return
    }

    // 브랜치 삭제 API 호출
    deleteBranchMutation.mutate({
      documentId: Number.parseInt(documentId),
      branchId,
    })
  }

  const handleCommitDelete = async (commitId: number) => {
    if (!graphData) return

    console.log("Commit delete:", commitId)

    const commit = graphData.commits.find((c) => c.id === commitId)
    if (!commit) return

    // 확인 다이얼로그 표시
    const confirmed = await confirm(
      "이 기록을 정말 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.\n\n참고: 각 버전의 최신 기록만 삭제 가능합니다.",
      "기록 삭제",
    )

    if (!confirmed) {
      return
    }

    // 커밋 삭제 API 호출
    deleteCommitMutation.mutate({
      docId: Number.parseInt(documentId),
      commitId,
    })

    navigate(`/documents/${documentId}`)
  }

  if (graphError) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-red-600 mb-2">
            오류가 발생했습니다
          </h2>
          <p className="text-gray-600">문서를 불러올 수 없습니다.</p>
        </div>
      </div>
    )
  }

  // 그래프 데이터 로딩 중이거나 에러가 있으면 로딩/에러 표시
  if (isGraphLoading || !graphData || !mainBranch || !currentBranchId) {
    return <Loading text="문서를 불러오는 중..." />
  }

  return (
    <>
      <ResizableLayout initialWidth={450} minWidth={250} maxWidth={800}>
        {/* 사이드바 컨텐츠 */}
        <div className="p-4 h-[calc(100%-48px)] box-sizing: border-box;">
          <div className="flex justify-between items-center z-10 w-full bg-gray-300 rounded-t-md p-2">
            <button className="cursor-pointer">
              <h2 className="text-2xl font-bold">{graphData.title}</h2>
            </button>
            <button
              className="cursor-pointer hover:bg-gray-400 p-1 rounded"
              onClick={() => setIsDocumentListOpen(true)}
            >
              <Menu className="h-6 w-6" />
            </button>
          </div>

          <DocumentGraph
            data={graphData}
            mainBranch={mainBranch}
            currentBranchId={currentBranchId}
            currentCommitId={commitId}
            currentSaveId={mode === "save" ? saveId : null}
            onNodeMenuClick={handleNodeMenuClick}
            onBranchDelete={handleBranchDelete}
          />
        </div>

        {/* 메인 컨텐츠 - 에디터 */}
        <div className="p-4 h-[calc(100%)] box-sizing: border-box;">
          <DocumentContent
            documentId={Number.parseInt(documentId)}
            contentMode={getDocumentContentMode(mode)}
            documentMode={mode}
            branchId={currentBranchId}
            commitId={commitId}
            saveId={saveId}
            compareId={compareCommitId}
            currentBranchLastCommitId={currentBranchLastCommitId}
          />
        </div>
      </ResizableLayout>

      {/* 문서 리스트 모달 */}
      <DocumentListModal
        open={isDocumentListOpen}
        onOpenChange={setIsDocumentListOpen}
        onDocumentSelect={handleDocumentListModalClick}
        currentDocumentId={Number.parseInt(documentId)}
      />

      {/* 브랜치 편집 모달 */}
      <BranchEditModal
        isOpen={isBranchEditModalOpen}
        onClose={() => {
          setIsBranchEditModalOpen(false)
          setBranchEditData(null)
        }}
        onConfirm={handleBranchEditConfirm}
        isLastCommit={branchEditData?.isLastCommit || false}
        defaultBranchName={branchEditData?.currentBranchName || ""}
      />
    </>
  )
}

function getDocumentContentMode(mode: DocumentMode): DocumentContentMode {
  switch (mode) {
    case "commit":
      return "view"
    case "save":
      return "edit"
    case "compare":
      return "compare"
  }
}
