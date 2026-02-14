import { useState, useEffect } from "react"
import { apiClient } from "@/api/apiClient"
import type { DocumentMode } from "@/types/document"
import type { SaveGetResponse, CommitResponse } from "@/api/__generated__"

interface UseDocumentContentParams {
  documentMode: DocumentMode
  commitId: string | null
  saveId: string | null
  compareId: string | null
  documentId: number
  currentBranchLastCommitId: number | null
}

interface DocumentContentData {
  originalData: Array<{ [key: string]: any }> | null
  modifiedData: Array<{ [key: string]: any }> | null
  commitDiffData: Array<{ [key: string]: any }> | null
  isLoading: boolean
  error: string | null
}

export function useDocumentContent({
  documentMode,
  commitId,
  saveId,
  compareId,
  documentId = 1, // 임시 기본값
  currentBranchLastCommitId,
}: UseDocumentContentParams): DocumentContentData {
  const [originalData, setOriginalData] = useState<Array<{
    [key: string]: any
  }> | null>(null)
  const [modifiedData, setModifiedData] = useState<Array<{
    [key: string]: any
  }> | null>(null)
  const [currentBranchLastCommitData, setCurrentBranchLastCommitData] =
    useState<
      Array<{
        [key: string]: any
      }>
    >([])

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true)
      setError(null)

      try {
        switch (documentMode) {
          case "save": {
            if (!saveId) {
              throw new Error("saveId가 필요합니다")
            }

            const response = await apiClient.save.getSave({
              saveId: Number(saveId),
              docId: documentId,
            })

            setOriginalData(response.content || null)

            if (currentBranchLastCommitId) {
              const lastCommitData = await apiClient.commit.getCommit({
                docId: documentId,
                commitId: Number(currentBranchLastCommitId),
              })

              setCurrentBranchLastCommitData(lastCommitData.content || [])
            }
            break
          }

          case "commit": {
            if (!commitId) {
              throw new Error("commitId가 필요합니다")
            }
            const response: CommitResponse = await apiClient.commit.getCommit({
              docId: documentId,
              commitId: Number(commitId),
            })
            setOriginalData(response.content || null)
            break
          }

          case "compare": {
            if (!commitId || !compareId) {
              throw new Error("commitId와 compareId가 모두 필요합니다")
            }

            const [originalResponse, modifiedResponse] = await Promise.all([
              apiClient.commit.getCommit({
                docId: documentId,
                commitId: Number(commitId),
              }),
              apiClient.commit.getCommit({
                docId: documentId,
                commitId: Number(compareId),
              }),
            ])

            setOriginalData(originalResponse.content || null)
            setModifiedData(modifiedResponse.content || null)
            break
          }

          default:
            throw new Error(`지원하지 않는 documentMode: ${documentMode}`)
        }
      } catch (err: any) {
        const errorMessage = err.message || "데이터를 가져오는 중 오류가 발생했습니다"
        setError(errorMessage)
        console.error("useDocumentContent 오류:", err)
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [
    documentMode,
    commitId,
    saveId,
    compareId,
    documentId,
    currentBranchLastCommitId,
  ])

  return {
    originalData,
    modifiedData,
    commitDiffData: currentBranchLastCommitData,
    isLoading,
    error,
  }
}
