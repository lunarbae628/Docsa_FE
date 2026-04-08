import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useGraphData } from "@/hooks/useGraphData"
import type { GraphDataType } from "@/types/graph"

function createEmptyGraphData(): GraphDataType {
  return {
    title: "문서 작업 흐름",
    commits: [],
    edges: [],
    branches: [],
  }
}

function hasRenderableGraphData(graphData: GraphDataType) {
  return (
    graphData.branches.length > 0 ||
    graphData.commits.length > 0 ||
    graphData.edges.length > 0
  )
}

export function useDocumentWorkspaceGraphState(documentId: number) {
  const graphQuery = useGraphData({ documentId })
  const stableGraphDataRef = useRef<GraphDataType | null>(null)
  const [graphData, setGraphData] = useState<GraphDataType>(createEmptyGraphData())

  useEffect(() => {
    stableGraphDataRef.current = null
    setGraphData(createEmptyGraphData())
  }, [documentId])

  useEffect(() => {
    if (
      graphQuery.data &&
      (hasRenderableGraphData(graphQuery.data) || !stableGraphDataRef.current)
    ) {
      stableGraphDataRef.current = graphQuery.data
      setGraphData(graphQuery.data)
    }
  }, [graphQuery.data])

  const resolvedGraphData = useMemo(
    () => graphData ?? stableGraphDataRef.current ?? graphQuery.data ?? createEmptyGraphData(),
    [graphData, graphQuery.data],
  )

  const updateGraphData = useCallback(
    (updater: (current: GraphDataType) => GraphDataType) => {
      setGraphData((current) => {
        const base =
          current ??
          stableGraphDataRef.current ??
          graphQuery.data ??
          createEmptyGraphData()
        const next = updater(base)
        stableGraphDataRef.current = next
        return next
      })
    },
    [graphQuery.data],
  )

  const mainBranch = useMemo(
    () =>
      resolvedGraphData.branches.find((branch) => branch.name === "main") ??
      resolvedGraphData.branches[0] ??
      ({
        id: 0,
        name: "main",
        createdAt: new Date().toISOString(),
        fromCommitId: null,
        mergeTargetCommitId: null,
        rootCommitId: null,
        leafCommitId: null,
        saveId: null,
      } satisfies GraphDataType["branches"][number]),
    [resolvedGraphData.branches],
  )

  const isInitialLoading =
    !stableGraphDataRef.current && (graphQuery.isLoading || !graphQuery.data)

  return {
    graphQuery,
    graphData: resolvedGraphData,
    updateGraphData,
    mainBranch,
    isInitialLoading,
  }
}
