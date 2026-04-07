import { useMemo } from "react"
import { type Edge, Position } from "reactflow"
import type { GraphDataType, Commit, GraphNode } from "@/types/graph"
import { getBranchColor, GRAPH_LAYOUT } from "@/lib/graphUtils"
import { useQuery } from "@tanstack/react-query"
import { apiClient } from "@/api/apiClient"
import type { CommitGraphResponse } from "@/api/__generated__"
import type { CommitDto } from "@/api/__generated__/models/CommitDto"
import type { BranchDto } from "@/api/__generated__/models/BranchDto"
import type { EdgeDto } from "@/api/__generated__/models/EdgeDto"

interface UseGraphRenderProps {
  data: GraphDataType
  activeCommitId?: string | null
  activeSaveId?: string | null
  isMainBranchLeafCommit: boolean
}

interface UseGraphDataProps {
  documentId: number
}

// API 호출과 데이터 변환을 담당하는 새로운 useGraphData 훅
export function useGraphData({ documentId }: UseGraphDataProps) {
  return useQuery({
    queryKey: ["graphData", documentId],
    queryFn: async (): Promise<GraphDataType> => {
      const response = await apiClient.document.getGraph({
        docId: documentId,
      })

      return transformApiResponseToGraphData(response)
    },
    enabled: !!documentId,
    refetchOnMount: "always",
  })
}

// API 응답을 로컬 타입으로 변환하는 함수
function transformApiResponseToGraphData(
  response: CommitGraphResponse,
): GraphDataType {
  return {
    title: response.title || "",
    commits: (response.commits || []).map(transformCommitDto),
    edges: (response.edges || []).map(transformEdgeDto),
    branches: (response.branches || []).map(transformBranchDto),
  }
}

function transformCommitDto(dto: CommitDto): Commit {
  return {
    id: dto.id || 0,
    branchId: dto.branchId || 0,
    title: dto.title || "",
    description: dto.description || "",
    createdAt: dto.createdAt?.toISOString() || new Date().toISOString(),
  }
}

function transformBranchDto(dto: BranchDto) {
  return {
    id: dto.id || 0,
    name: dto.name || "",
    createdAt: dto.createdAt?.toISOString() || new Date().toISOString(),
    fromCommitId: dto.fromCommitId || null,
    rootCommitId: dto.rootCommitId || 0,
    leafCommitId: dto.leafCommitId || 0,
    saveId: dto.saveId || null,
  }
}

function transformEdgeDto(dto: EdgeDto) {
  return {
    from: dto.from || 0,
    to: dto.to || 0,
  }
}

// React Flow 렌더링을 위한 데이터 변환 훅 (기존 useGraphData에서 이름 변경)
export function useGraphRender({
  data,
  activeCommitId,
  activeSaveId,
  isMainBranchLeafCommit,
}: UseGraphRenderProps) {
  // 커밋을 React Flow 노드로 변환
  const { commitNodes, infoByBranch, commitDepths } = useMemo(() => {
    // 브랜치별 정보 수집용
    const infoByBranch: Record<
      number,
      { xPosition: number; lastYPosition: number }
    > = {}

    // 각 커밋의 depth 계산 (연결 순서 기반)
    const commitDepths = new Map<number, number>()

    // 각 브랜치의 루트 커밋들을 찾아서 depth 0으로 설정
    const rootCommits = data.branches.map((branch) => branch.rootCommitId)
    for (const commitId of rootCommits) {
      commitDepths.set(commitId, 0)
    }

    // edges를 이용해서 각 커밋의 depth 계산
    const calculateDepths = () => {
      let changed = true
      while (changed) {
        changed = false
        for (const edge of data.edges) {
          const sourceDepth = commitDepths.get(edge.from)
          const targetDepth = commitDepths.get(edge.to)

          if (
            sourceDepth !== undefined &&
            (targetDepth === undefined || targetDepth <= sourceDepth)
          ) {
            commitDepths.set(edge.to, sourceDepth + 1)
            changed = true
          }
        }
      }
    }

    calculateDepths()

    // 노드 생성
    const nodes = data.commits.map((commit) => {
      const branch = data.branches.find((b) => b.id === commit.branchId)
      const branchName = branch?.name || "unknown"
      const color = getBranchColor(branchName)

      // 브랜치별로 x 위치 조정
      const branchIndex = data.branches.findIndex(
        (b) => b.id === commit.branchId,
      )
      const xPosition =
        branchIndex * GRAPH_LAYOUT.BRANCH_SPACING + GRAPH_LAYOUT.BASE_X_OFFSET

      // 연결 순서(depth)에 따른 y 위치 조정
      const depth = commitDepths.get(commit.id) || 0
      const yPosition = depth * GRAPH_LAYOUT.ROW_SPACING + GRAPH_LAYOUT.BASE_Y_OFFSET

      // 브랜치별 정보 업데이트
      if (!infoByBranch[commit.branchId]) {
        infoByBranch[commit.branchId] = { xPosition, lastYPosition: yPosition }
      } else {
        infoByBranch[commit.branchId].lastYPosition = Math.max(
          infoByBranch[commit.branchId].lastYPosition,
          yPosition,
        )
      }

      // 브랜치의 마지막 커밋인지 확인
      const isLastCommit = branch?.leafCommitId === commit.id && !branch.saveId

      // 현재 커밋인지 확인
      const isCurrentCommit = activeCommitId === commit.id.toString()

      // 머지 버튼을 보여줄지 확인 (현재 커밋이고, 다른 브랜치의 leafNode인 경우)
      const showMergeButton =
        !isCurrentCommit && isLastCommit && !isMainBranchLeafCommit

      return {
        id: `commit-${commit.id.toString()}`,
        type: "commitNode",
        position: { x: xPosition, y: yPosition },
        data: {
          nodeType: "commit",
          commit,
          branchName,
          color,
          isCurrentCommit,
          isLastCommit,
          showMergeButton,
        },
        style: {
          background: "transparent",
          border: "none",
          padding: 0,
          width: GRAPH_LAYOUT.NODE_WIDTH,
          height: GRAPH_LAYOUT.NODE_HEIGHT,
        },
        sourcePosition: Position.Bottom,
        targetPosition: Position.Top,
      } as GraphNode
    })

    return { commitNodes: nodes, infoByBranch, commitDepths }
  }, [data, activeCommitId, isMainBranchLeafCommit])

  // 엣지를 React Flow 엣지로 변환
  const commitEdges = useMemo<Edge[]>(() => {
    return data.edges.map((edge) => {
      // 소스와 타겟이 같은 브랜치인지 확인
      const sourceCommit = data.commits.find((c) => c.id === edge.from)
      const targetCommit = data.commits.find((c) => c.id === edge.to)
      const isSameBranch = sourceCommit?.branchId === targetCommit?.branchId
      const edgeColor = getBranchColor(
        targetCommit
          ? (data.branches.find((b) => b.id === targetCommit.branchId)?.name ?? "branch")
          : "branch",
      )

      return {
        id: `edge-${edge.from}-${edge.to}`,
        source: `commit-${edge.from.toString()}`,
        target: `commit-${edge.to.toString()}`,
        type: "timeline",
        style: {
          stroke: edgeColor,
          strokeWidth: isSameBranch ? 3 : 2.5,
        },
      }
    })
  }, [data, commitDepths])

  const { tempNodes, tempEdges } = useMemo<{
    tempNodes: GraphNode[]
    tempEdges: Edge[]
  }>(() => {
    const tempNodesArray: GraphNode[] = []
    const tempEdgesArray: Edge[] = []

    // saveId가 있는 브랜치들을 찾아서 tempNode 생성
    for (const branch of data.branches) {
      if (branch.saveId) {
        const branchName = branch.name
        const color = getBranchColor(branchName)

        // infoByBranch에서 해당 브랜치의 가장 아래 위치 가져오기
        const branchInfo = infoByBranch[branch.id]

        // 브랜치에 커밋이 없는 경우를 위한 기본 위치 설정
        let xPosition: number
        let yPosition: number

        if (branchInfo) {
          // 브랜치의 가장 아래 위치에서 아래로 배치
          xPosition = branchInfo.xPosition
          yPosition = branchInfo.lastYPosition + GRAPH_LAYOUT.WORKSPACE_OFFSET
        } else {
          const branchIndex = data.branches.findIndex((b) => b.id === branch.id)
          xPosition =
            branchIndex * GRAPH_LAYOUT.BRANCH_SPACING +
            GRAPH_LAYOUT.BASE_X_OFFSET

          if (branch.fromCommitId) {
            const depth = commitDepths.get(branch.fromCommitId) + 1
            if (depth) {
              yPosition =
                depth * GRAPH_LAYOUT.ROW_SPACING + GRAPH_LAYOUT.BASE_Y_OFFSET
            }
          } else {
            // 커밋이 없는 브랜치의 경우 기본 위치 설정
            yPosition = GRAPH_LAYOUT.BASE_Y_OFFSET
          }
        }

        const saveNodeId = `save-${branch.saveId}`

        // 현재 커밋인지 확인
        const isCurrentTemp = activeSaveId === branch.saveId.toString()

        tempNodesArray.push({
          id: saveNodeId,
          type: "tempNode",
          position: { x: xPosition, y: yPosition },
          data: {
            nodeType: "temp",
            saveId: branch.saveId,
            branchName,
            color,
            isCurrentTemp,
            isTemp: true,
            title: "저장",
            description: "저장된 변경사항",
          },
          style: {
            background: "transparent",
            border: "none",
            padding: 0,
            width: GRAPH_LAYOUT.NODE_WIDTH,
            height: GRAPH_LAYOUT.NODE_HEIGHT,
            opacity: 1,
          },
          sourcePosition: Position.Bottom,
          targetPosition: Position.Top,
        } as GraphNode)

        // leafCommitId가 있는 경우에만 엣지 생성
        if (branch.leafCommitId) {
          tempEdgesArray.push({
            id: `temp-edge-${branch.id}`,
            source: `commit-${branch.leafCommitId.toString()}`,
            target: saveNodeId,
            type: "timeline",
            style: {
              stroke: color,
              strokeWidth: 2.5,
            },
            data: { dashed: true },
          })
        }

        if (!branch.leafCommitId && branch.fromCommitId) {
          tempEdgesArray.push({
            id: `temp-edge-${branch.id}`,
            source: `commit-${branch.fromCommitId.toString()}`,
            target: saveNodeId,
            type: "timeline",
            style: {
              stroke: color,
              strokeWidth: 2.5,
            },
            data: { dashed: true },
          })
        }
      }
    }

    return { tempNodes: tempNodesArray, tempEdges: tempEdgesArray }
  }, [data, infoByBranch, activeSaveId, commitDepths])

  return {
    nodes: [...commitNodes, ...tempNodes],
    edges: [...commitEdges, ...tempEdges],
  }
}
