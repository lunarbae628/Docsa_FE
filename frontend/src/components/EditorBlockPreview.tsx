import type { EditorBlock } from "@/lib/diffUtils"
import { cn } from "@/lib/utils"
import type { KeyboardEvent } from "react"
import {
  canRenderInlineDiff,
  getBlockRenderer,
} from "./editor-preview/renderers"
import { blockTone } from "./editor-preview/styles"
import type {
  PreviewBlockStatus,
  PreviewDiffSegment,
  PreviewSide,
} from "./editor-preview/types"

export type { PreviewDiffSegment, PreviewSide }

interface EditorBlockPreviewProps {
  block?: EditorBlock
  compareBlock?: EditorBlock
  side: PreviewSide
  status?: PreviewBlockStatus
  segments?: PreviewDiffSegment[]
  buildSegments?: (leftText: string, rightText: string) => PreviewDiffSegment[]
  isWholeSelected?: boolean
  isRegionSelected?: (regionIndex: number) => boolean
  onSelectWhole?: () => void
  onSelectRegion?: (regionIndex: number) => void
}

function getRendererData(block: EditorBlock): Record<string, unknown> {
  if (!block.tunes) {
    return block.data
  }

  return {
    ...block.data,
    __tunes: block.tunes,
  }
}

export function getVisibleBlockText(block: EditorBlock | undefined): string {
  if (!block?.data) return ""
  return getBlockRenderer(block.type).extractText(getRendererData(block))
}

function handleKeyboardSelect(
  event: KeyboardEvent<HTMLDivElement>,
  onSelect: () => void,
) {
  if (event.key !== "Enter" && event.key !== " ") {
    return
  }

  event.preventDefault()
  onSelect()
}

export default function EditorBlockPreview({
  block,
  compareBlock,
  side,
  status = "same",
  segments,
  buildSegments,
  isWholeSelected,
  isRegionSelected,
  onSelectWhole,
  onSelectRegion,
}: EditorBlockPreviewProps) {
  if (!block) {
    return <div className="h-6" />
  }

  const renderer = getBlockRenderer(block.type)
  const rendererData = getRendererData(block)
  const isInlineDiff = Boolean(
    segments?.length && canRenderInlineDiff(block.type),
  )
  const blockContent =
    isInlineDiff && renderer.renderWithDiff
      ? renderer.renderWithDiff(rendererData, {
          side,
          segments,
          compareData: compareBlock ? getRendererData(compareBlock) : undefined,
          buildSegments,
          isRegionSelected,
          onSelectRegion,
        })
      : renderer.render(rendererData)

  const shouldMarkWholeBlock = status !== "same" && !isInlineDiff
  const wholeBlockClass = shouldMarkWholeBlock
    ? cn("rounded-2xl border px-3 py-2", blockTone(side, isWholeSelected))
    : ""

  const previewClassName = "document-editor-shell"

  if (onSelectWhole && shouldMarkWholeBlock) {
    return (
      // biome-ignore lint/a11y/useSemanticElements: Preview content can contain nested editor controls, so button would create invalid nested interactive markup.
      <div
        role="button"
        tabIndex={0}
        onClick={onSelectWhole}
        onKeyDown={(event) => handleKeyboardSelect(event, onSelectWhole)}
        className={cn(
          "block w-full text-left transition-colors hover:bg-slate-50",
          previewClassName,
          wholeBlockClass,
        )}
      >
        {blockContent}
      </div>
    )
  }

  return (
    <div className={cn(previewClassName, wholeBlockClass)}>{blockContent}</div>
  )
}
