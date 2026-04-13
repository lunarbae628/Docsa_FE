import type { EditorBlock } from "@/lib/diffUtils"
import { cn } from "@/lib/utils"
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
  side: PreviewSide
  status?: PreviewBlockStatus
  segments?: PreviewDiffSegment[]
  isWholeSelected?: boolean
  isRegionSelected?: (regionIndex: number) => boolean
  onSelectWhole?: () => void
  onSelectRegion?: (regionIndex: number) => void
}

export function getVisibleBlockText(block: EditorBlock | undefined): string {
  if (!block?.data) return ""
  return getBlockRenderer(block.type).extractText(block.data)
}

export default function EditorBlockPreview({
  block,
  side,
  status = "same",
  segments,
  isWholeSelected,
  isRegionSelected,
  onSelectWhole,
  onSelectRegion,
}: EditorBlockPreviewProps) {
  if (!block) {
    return <div className="h-6" />
  }

  const renderer = getBlockRenderer(block.type)
  const isInlineDiff = Boolean(
    segments?.length && canRenderInlineDiff(block.type),
  )
  const blockContent =
    isInlineDiff && renderer.renderWithDiff
      ? renderer.renderWithDiff(block.data, {
          side,
          segments,
          isRegionSelected,
          onSelectRegion,
        })
      : renderer.render(block.data)

  const shouldMarkWholeBlock = status !== "same" && !isInlineDiff
  const wholeBlockClass = shouldMarkWholeBlock
    ? cn("rounded-2xl border px-3 py-2", blockTone(side, isWholeSelected))
    : ""

  const previewClassName = "document-editor-shell"

  if (onSelectWhole && shouldMarkWholeBlock) {
    return (
      <button
        type="button"
        onClick={onSelectWhole}
        className={cn(
          "block w-full text-left transition-colors hover:bg-slate-50",
          previewClassName,
          wholeBlockClass,
        )}
      >
        {blockContent}
      </button>
    )
  }

  return (
    <div className={cn(previewClassName, wholeBlockClass)}>{blockContent}</div>
  )
}
