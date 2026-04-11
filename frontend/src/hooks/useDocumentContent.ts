import { useState, useEffect, useMemo, useRef } from "react"
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
  isCurrentDataReady: boolean
  error: string | null
}

function getContentRequestKey({
  documentMode,
  commitId,
  saveId,
  compareId,
  documentId,
}: Pick<
  UseDocumentContentParams,
  "documentMode" | "commitId" | "saveId" | "compareId" | "documentId"
>) {
  if (!documentId) return null

  if (documentMode === "save" && saveId) {
    return `save:${documentId}:${saveId}`
  }

  if (documentMode === "commit" && commitId) {
    return `commit:${documentId}:${commitId}`
  }

  if (documentMode === "compare" && commitId && compareId) {
    return `compare:${documentId}:${commitId}:${compareId}`
  }

  return null
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
  const [loadedRequestKey, setLoadedRequestKey] = useState<string | null>(null)
  const [errorRequestKey, setErrorRequestKey] = useState<string | null>(null)

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const latestRequestKeyRef = useRef<string | null>(null)
  const activeRequestKey = useMemo(
    () =>
      getContentRequestKey({
        documentMode,
        commitId,
        saveId,
        compareId,
        documentId,
      }),
    [compareId, commitId, documentId, documentMode, saveId],
  )

  useEffect(() => {
    const fetchData = async () => {
      const requestKey = activeRequestKey
      latestRequestKeyRef.current = requestKey

      if (!documentId) {
        setIsLoading(false)
        setError(null)
        return
      }

      if (documentMode === "save" && !saveId) {
        setIsLoading(false)
        setError(null)
        return
      }

      if (documentMode === "commit" && !commitId) {
        setIsLoading(false)
        setError(null)
        return
      }

      if (documentMode === "compare" && (!commitId || !compareId)) {
        setIsLoading(false)
        setError(null)
        return
      }

      setIsLoading(true)
      setError(null)
      setErrorRequestKey(null)

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

            if (latestRequestKeyRef.current !== requestKey) return
            setOriginalData(response.content || null)
            setModifiedData(null)

            if (currentBranchLastCommitId) {
              const lastCommitData = await apiClient.commit.getCommit({
                docId: documentId,
                commitId: Number(currentBranchLastCommitId),
              })

              if (latestRequestKeyRef.current !== requestKey) return
              setCurrentBranchLastCommitData(lastCommitData.content || [])
            }
            setLoadedRequestKey(requestKey)
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
            if (latestRequestKeyRef.current !== requestKey) return
            setOriginalData(response.content || null)
            setModifiedData(null)
            setCurrentBranchLastCommitData([])
            setLoadedRequestKey(requestKey)
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

            if (latestRequestKeyRef.current !== requestKey) return
            setOriginalData(originalResponse.content || null)
            setModifiedData(modifiedResponse.content || null)
            setCurrentBranchLastCommitData([])
            setLoadedRequestKey(requestKey)
            break
          }

          default:
            throw new Error(`지원하지 않는 documentMode: ${documentMode}`)
        }
      } catch (err: any) {
        if (latestRequestKeyRef.current !== requestKey) return
        const errorMessage = err.message || "데이터를 가져오는 중 오류가 발생했습니다"
        setError(errorMessage)
        setErrorRequestKey(requestKey)
        console.error("useDocumentContent 오류:", err)
      } finally {
        if (latestRequestKeyRef.current === requestKey) {
          setIsLoading(false)
        }
      }
    }

    fetchData()
  }, [
    activeRequestKey,
    documentMode,
    commitId,
    saveId,
    compareId,
    documentId,
    currentBranchLastCommitId,
  ])

  const isCurrentDataReady =
    Boolean(activeRequestKey) && loadedRequestKey === activeRequestKey
  const isCurrentRequestLoading =
    isLoading ||
    Boolean(
      activeRequestKey &&
        loadedRequestKey !== activeRequestKey &&
        errorRequestKey !== activeRequestKey,
    )

  return {
    originalData: isCurrentDataReady ? originalData : null,
    modifiedData: isCurrentDataReady ? modifiedData : null,
    commitDiffData: isCurrentDataReady ? currentBranchLastCommitData : null,
    isLoading: isCurrentRequestLoading,
    isCurrentDataReady,
    error: errorRequestKey === activeRequestKey ? error : null,
  }
}
