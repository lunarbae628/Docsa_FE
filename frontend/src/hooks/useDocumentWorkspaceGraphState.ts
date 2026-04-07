import { useEffect, useMemo, useRef } from "react"
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

  useEffect(() => {
    stableGraphDataRef.current = null
  }, [documentId])

  useEffect(() => {
    if (
      graphQuery.data &&
      (hasRenderableGraphData(graphQuery.data) || !stableGraphDataRef.current)
    ) {
      stableGraphDataRef.current = graphQuery.data
    }
  }, [graphQuery.data])

  const graphData = useMemo(
    () => stableGraphDataRef.current ?? graphQuery.data ?? createEmptyGraphData(),
    [graphQuery.data],
  )

  const mainBranch = useMemo(
    () =>
      graphData.branches.find((branch) => branch.name === "main") ??
      graphData.branches[0] ??
      ({
        id: 0,
        name: "main",
        createdAt: new Date().toISOString(),
        fromCommitId: null,
        rootCommitId: null,
        leafCommitId: null,
        saveId: null,
      } satisfies GraphDataType["branches"][number]),
    [graphData.branches],
  )

  const isInitialLoading =
    !stableGraphDataRef.current && (graphQuery.isLoading || !graphQuery.data)

  return {
    graphQuery,
    graphData,
    mainBranch,
    isInitialLoading,
  }
}
