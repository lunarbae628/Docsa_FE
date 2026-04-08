import type { CommitNodeMenuType } from "@/components/CommitNode"
import type { TempNodeMenuType } from "@/components/TempNode"
import type { Node } from "reactflow"

export interface GraphNode extends Node {
  data: {
    nodeType: "commit" | "temp"
    [key: string]: any
  }
}

export interface Commit {
  id: number
  branchId: number
  title: string
  description: string
  createdAt: string
}

export interface GraphEdge {
  from: number
  to: number
}

export interface Branch {
  id: number
  name: string
  createdAt: string
  fromCommitId: number | null
  mergeTargetCommitId: number | null
  rootCommitId: number | null
  leafCommitId: number | null
  saveId: number | null
}

export type GraphDataType = {
  title: string
  commits: Commit[]
  edges: GraphEdge[]
  branches: Branch[]
}

export interface HoveredCommit {
  commit: Commit
  position: { x: number; y: number }
}
