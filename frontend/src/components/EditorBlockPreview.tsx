import type { EditorBlock } from "@/lib/diffUtils"
import { cn } from "@/lib/utils"
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

type PreviewBlockStatus = "same" | "modified" | "deleted" | "added"

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

  switch (block.type) {
    case "paragraph":
    case "header":
    case "quote":
      return String(block.data.text ?? "").replace(/<br\s*\/?>/gi, "\n")
    case "code":
      return String(block.data.code ?? "")
    case "list": {
      const items = Array.isArray(block.data.items) ? block.data.items : []
      const ordered = block.data.style === "ordered"

      return items
        .map((item, index) => {
          const text = getListItemText(item)
          if (block.data.style === "checklist") {
            const checked = getListItemChecked(item) ? "[x]" : "[ ]"
            return `${checked} ${text}`
          }
          return ordered ? `${index + 1}. ${text}` : `• ${text}`
        })
        .join("\n")
    }
    case "delimiter":
      return "---"
    default:
      return String(block?.data?.text ?? JSON.stringify(block.data))
  }
}

function getListItemText(item: unknown): string {
  if (typeof item === "string") {
    return item
  }

  if (item && typeof item === "object") {
    const record = item as Record<string, unknown>
    return String(record.content ?? record.text ?? record.value ?? "")
  }

  return String(item ?? "")
}

function getListItemChildren(item: unknown): unknown[] {
  if (!item || typeof item !== "object") {
    return []
  }

  const children = (item as Record<string, unknown>).items
  return Array.isArray(children) ? children : []
}

function getListItemChecked(item: unknown): boolean {
  if (!item || typeof item !== "object") {
    return false
  }

  const meta = (item as Record<string, unknown>).meta
  return Boolean(
    meta &&
      typeof meta === "object" &&
      (meta as Record<string, unknown>).checked,
  )
}

function isInlineDiffBlock(block?: EditorBlock) {
  return Boolean(
    block && ["paragraph", "header", "quote", "code"].includes(block.type),
  )
}

function sideTone(side: PreviewSide, selected?: boolean) {
  if (side === "left") {
    return selected
      ? "text-rose-900 decoration-rose-300"
      : "text-rose-700 decoration-rose-200 hover:decoration-rose-300"
  }

  return selected
    ? "text-emerald-900 decoration-emerald-300"
    : "text-emerald-700 decoration-emerald-200 hover:decoration-emerald-300"
}

function blockTone(side: PreviewSide, selected?: boolean) {
  if (side === "left") {
    return selected
      ? "border-rose-200 bg-rose-50/80"
      : "border-rose-100 bg-rose-50/45"
  }

  return selected
    ? "border-emerald-200 bg-emerald-50/80"
    : "border-emerald-100 bg-emerald-50/45"
}

function renderTextWithBreaks(text: string) {
  return text.split("\n").map((line, index) => (
    <span key={`${line}-${index}`}>
      {index > 0 ? <br /> : null}
      {line}
    </span>
  ))
}

function renderDiffSegments({
  segments,
  side,
  isRegionSelected,
  onSelectRegion,
}: {
  segments: PreviewDiffSegment[]
  side: PreviewSide
  isRegionSelected?: (regionIndex: number) => boolean
  onSelectRegion?: (regionIndex: number) => void
}) {
  return segments.map((segment, index) => {
    if (segment.type === "equal") {
      return (
        <span key={`equal-${index}`}>{renderTextWithBreaks(segment.text)}</span>
      )
    }

    const visibleText = side === "left" ? segment.leftText : segment.rightText
    if (!visibleText) {
      return null
    }

    const selected = isRegionSelected?.(segment.regionIndex) ?? false
    const className = cn(
      "underline decoration-[0.18em] underline-offset-[0.16em] transition-colors",
      onSelectRegion ? "cursor-pointer" : "",
      sideTone(side, selected),
    )

    if (!onSelectRegion) {
      return (
        <span key={`changed-${segment.regionIndex}`} className={className}>
          {renderTextWithBreaks(visibleText)}
        </span>
      )
    }

    return (
      <span
        key={`changed-${segment.regionIndex}`}
        // biome-ignore lint/a11y/useSemanticElements: Inline diff must wrap exactly with adjacent text.
        role="button"
        tabIndex={0}
        onClick={() => onSelectRegion(segment.regionIndex)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault()
            onSelectRegion(segment.regionIndex)
          }
        }}
        className={className}
      >
        {renderTextWithBreaks(visibleText)}
      </span>
    )
  })
}

function renderChecklist(items: unknown[]): ReactNode {
  return (
    <div className="cdx-block space-y-2 text-[15px] leading-8 tracking-[-0.01em] text-slate-700">
      {items.map((item, index) => {
        const children = getListItemChildren(item)
        const checked = getListItemChecked(item)

        return (
          <div
            key={`${getListItemText(item)}-${index}`}
            className="cdx-list__item space-y-1"
          >
            <div className="flex items-start gap-2">
              <span
                aria-hidden="true"
                className={cn(
                  "mt-[0.55em] flex h-[1.05em] w-[1.05em] shrink-0 items-center justify-center rounded-[4px] border text-[10px] font-semibold leading-none transition-colors",
                  checked
                    ? "border-slate-700 bg-slate-700 text-white"
                    : "border-slate-300 bg-white text-transparent shadow-[inset_0_0_0_1px_rgba(255,255,255,0.7)]",
                )}
              >
                ✓
              </span>
              <span
                className={cn(checked ? "text-slate-500" : "text-slate-700")}
              >
                {getListItemText(item)}
              </span>
            </div>
            {children.length ? (
              <div className="ml-6">{renderChecklist(children)}</div>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}

function renderList(items: unknown[], ordered: boolean): ReactNode {
  const ListTag = ordered ? "ol" : "ul"

  return (
    <ListTag
      className={cn(
        "cdx-block cdx-list space-y-1.5 pl-6 text-[15px] leading-8 tracking-[-0.01em] text-slate-700",
        ordered ? "list-decimal" : "list-disc",
      )}
    >
      {items.map((item, index) => {
        const children = getListItemChildren(item)

        return (
          <li
            key={`${getListItemText(item)}-${index}`}
            className="cdx-list__item"
          >
            <span>{getListItemText(item)}</span>
            {children.length ? (
              <div className="mt-1">{renderList(children, ordered)}</div>
            ) : null}
          </li>
        )
      })}
    </ListTag>
  )
}

function renderBlockContent(
  block: EditorBlock,
  inlineContent: ReactNode,
): ReactNode {
  switch (block.type) {
    case "header": {
      const level = Math.min(Math.max(Number(block.data.level ?? 2), 1), 6)
      const HeaderTag = `h${level}` as keyof JSX.IntrinsicElements

      return (
        <HeaderTag
          className={cn(
            "ce-header cdx-block font-semibold leading-tight tracking-[-0.035em] text-slate-950",
            level === 1
              ? "text-4xl"
              : level === 2
                ? "text-3xl"
                : level === 3
                  ? "text-2xl"
                  : "text-xl",
          )}
        >
          {inlineContent}
        </HeaderTag>
      )
    }
    case "quote":
      return (
        <blockquote className="cdx-block cdx-quote border-l-[3px] border-slate-300 py-1 pl-4 text-[15px] leading-8 tracking-[-0.01em] text-slate-600">
          <div className="cdx-quote__text">{inlineContent}</div>
          {block.data.caption ? (
            <footer className="cdx-quote__caption mt-1 text-sm text-slate-400">
              {String(block.data.caption)}
            </footer>
          ) : null}
        </blockquote>
      )
    case "code":
      return (
        <pre className="ce-code cdx-block overflow-auto rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-mono text-[13px] leading-7 text-slate-700">
          <code>{inlineContent}</code>
        </pre>
      )
    case "list": {
      const items = Array.isArray(block.data.items) ? block.data.items : []
      if (block.data.style === "checklist") {
        return renderChecklist(items)
      }
      return renderList(items, block.data.style === "ordered")
    }
    case "delimiter":
      return (
        <div className="cdx-block flex w-full items-center py-5">
          <div className="h-px w-full rounded-full bg-slate-200" />
        </div>
      )
    default:
      return (
        <div className="ce-paragraph cdx-block whitespace-pre-wrap break-words text-[15px] leading-8 tracking-[-0.01em] text-slate-700">
          {inlineContent}
        </div>
      )
  }
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

  const isInlineDiff = Boolean(segments?.length && isInlineDiffBlock(block))
  const inlineContent = isInlineDiff
    ? renderDiffSegments({
        segments: segments ?? [],
        side,
        isRegionSelected,
        onSelectRegion,
      })
    : renderTextWithBreaks(getVisibleBlockText(block))
  const blockContent = renderBlockContent(block, inlineContent)
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
