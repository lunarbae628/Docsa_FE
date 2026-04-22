import type { ReactNode } from "react"

export type PreviewSide = "left" | "right"

export type PreviewDiffSegment =
  | { type: "equal"; text: string }
  | {
      type: "changed"
      leftText: string
      rightText: string
      regionIndex: number
    }

export type PreviewBlockStatus = "same" | "modified" | "deleted" | "added"

export interface BlockRendererContext {
  side: PreviewSide
  segments?: PreviewDiffSegment[]
  compareData?: Record<string, unknown>
  buildSegments?: (leftText: string, rightText: string) => PreviewDiffSegment[]
  isRegionSelected?: (regionIndex: number) => boolean
  onSelectRegion?: (regionIndex: number) => void
}

export interface BlockRenderer<TData = Record<string, unknown>> {
  extractText: (data: TData) => string
  extractDiffText?: (data: TData) => string
  render: (data: TData) => ReactNode
  renderWithDiff?: (data: TData, context: BlockRendererContext) => ReactNode
}
