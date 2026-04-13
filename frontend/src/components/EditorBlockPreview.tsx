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
      return normalizeVisibleText(block.data.text)
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
        .filter(Boolean)
        .join("\n")
    }
    case "delimiter":
      return "---"
    default:
      return String(block?.data?.text ?? JSON.stringify(block.data))
  }
}

function normalizeVisibleText(value: unknown): string {
  return String(value ?? "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/\u00a0/g, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
}

function normalizeListItemText(value: unknown): string {
  return normalizeVisibleText(value).trim()
}

function getListItemText(item: unknown): string {
  if (typeof item === "string") {
    return normalizeListItemText(item)
  }

  if (item && typeof item === "object") {
    const record = item as Record<string, unknown>
    return normalizeListItemText(record.content ?? record.text ?? record.value)
  }

  return normalizeListItemText(item)
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

  const record = item as Record<string, unknown>
  if (typeof record.checked === "boolean") {
    return record.checked
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
    block &&
      ["paragraph", "header", "quote", "code", "list"].includes(block.type),
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

type DiffLineToken =
  | { key: string; type: "equal"; text: string }
  | { key: string; type: "changed"; text: string; regionIndex: number }

function appendDiffTextToLines({
  lines,
  text,
  createToken,
}: {
  lines: DiffLineToken[][]
  text: string
  createToken: (text: string, index: number) => DiffLineToken
}) {
  const parts = text.split("\n")

  parts.forEach((part, index) => {
    if (index > 0) {
      lines.push([])
    }

    if (part) {
      lines[lines.length - 1].push(createToken(part, index))
    }
  })
}

function buildDiffLines({
  segments,
  side,
}: {
  segments: PreviewDiffSegment[]
  side: PreviewSide
}) {
  const lines: DiffLineToken[][] = [[]]

  segments.forEach((segment, segmentIndex) => {
    if (segment.type === "equal") {
      appendDiffTextToLines({
        lines,
        text: segment.text,
        createToken: (text, partIndex) => ({
          key: `equal-${segmentIndex}-${partIndex}`,
          type: "equal",
          text,
        }),
      })
      return
    }

    const text = side === "left" ? segment.leftText : segment.rightText
    if (!text) return

    appendDiffTextToLines({
      lines,
      text,
      createToken: (partText, partIndex) => ({
        key: `changed-${segment.regionIndex}-${partIndex}`,
        type: "changed",
        text: partText,
        regionIndex: segment.regionIndex,
      }),
    })
  })

  return lines.filter((line) => line.some((token) => token.text.trim()))
}

function lineText(tokens: DiffLineToken[]) {
  return tokens.map((token) => token.text).join("")
}

function trimTokenPrefix(tokens: DiffLineToken[], prefixLength: number) {
  let remaining = prefixLength

  return tokens.flatMap((token) => {
    if (remaining <= 0) return [token]

    if (token.text.length <= remaining) {
      remaining -= token.text.length
      return []
    }

    const nextToken = { ...token, text: token.text.slice(remaining) }
    remaining = 0
    return [nextToken]
  })
}

function parseDiffListLine(
  tokens: DiffLineToken[],
  style: "ordered" | "unordered" | "checklist",
  index: number,
) {
  const text = lineText(tokens)

  if (style === "checklist") {
    const match = text.match(/^\s*(?:[-*•]|\d+\.)?\s*\[(x|X|\s)?]\s*/)
    return {
      marker: "checkbox" as const,
      checked: match ? (match[1] ?? "").toLowerCase() === "x" : false,
      tokens: trimTokenPrefix(tokens, match?.[0].length ?? 0),
    }
  }

  if (style === "ordered") {
    const match = text.match(/^\s*(\d+\.)\s*/)
    return {
      marker: match?.[1] ?? `${index + 1}.`,
      checked: false,
      tokens: trimTokenPrefix(tokens, match?.[0].length ?? 0),
    }
  }

  const match = text.match(/^\s*([•*-])\s*/)
  return {
    marker: match?.[1] ?? "•",
    checked: false,
    tokens: trimTokenPrefix(tokens, match?.[0].length ?? 0),
  }
}

function renderDiffTokens({
  tokens,
  side,
  isRegionSelected,
  onSelectRegion,
}: {
  tokens: DiffLineToken[]
  side: PreviewSide
  isRegionSelected?: (regionIndex: number) => boolean
  onSelectRegion?: (regionIndex: number) => void
}) {
  return tokens.map((token) => {
    if (token.type === "equal") {
      return <span key={token.key}>{token.text}</span>
    }

    const selected = isRegionSelected?.(token.regionIndex) ?? false
    const className = cn(
      "rounded-[5px] px-0.5 underline decoration-[0.18em] underline-offset-[0.16em] transition-colors",
      onSelectRegion ? "cursor-pointer" : "",
      sideTone(side, selected),
    )

    if (!onSelectRegion) {
      return (
        <span key={token.key} className={className}>
          {token.text}
        </span>
      )
    }

    return (
      <span
        key={token.key}
        // biome-ignore lint/a11y/useSemanticElements: Inline diff must wrap exactly with adjacent text.
        role="button"
        tabIndex={0}
        onClick={() => onSelectRegion(token.regionIndex)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault()
            onSelectRegion(token.regionIndex)
          }
        }}
        className={className}
      >
        {token.text}
      </span>
    )
  })
}

function renderChecklist(items: unknown[]): ReactNode {
  return (
    <div className="cdx-block space-y-1.5 text-[16px] leading-[1.78] tracking-[-0.01em] text-slate-700">
      {items.map((item, index) => {
        const children = getListItemChildren(item)
        const checked = getListItemChecked(item)

        return (
          <div key={`${getListItemText(item)}-${index}`} className="space-y-1">
            <div className="flex items-start gap-2.5">
              <span
                aria-hidden="true"
                className={cn(
                  "mt-[0.45em] flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border text-[10px] font-semibold leading-none transition-colors",
                  checked
                    ? "border-slate-500 bg-slate-600 text-white"
                    : "border-slate-300 bg-white text-transparent",
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

function renderListDiff({
  block,
  segments,
  side,
  isRegionSelected,
  onSelectRegion,
}: {
  block: EditorBlock
  segments: PreviewDiffSegment[]
  side: PreviewSide
  isRegionSelected?: (regionIndex: number) => boolean
  onSelectRegion?: (regionIndex: number) => void
}) {
  const style =
    block.data.style === "ordered" ||
    block.data.style === "unordered" ||
    block.data.style === "checklist"
      ? block.data.style
      : "unordered"
  const lines = buildDiffLines({ segments, side })

  return (
    <div className="cdx-block space-y-1.5 text-[16px] leading-[1.78] tracking-[-0.01em] text-slate-700">
      {lines.map((line, index) => {
        const parsedLine = parseDiffListLine(line, style, index)

        return (
          <div
            key={`${lineText(line)}-${index}`}
            className="grid grid-cols-[1.2rem_minmax(0,1fr)] items-start gap-1.5"
          >
            <span className="mt-[0.08em] flex min-h-5 items-start justify-end pr-1 text-[0.95em] font-normal text-slate-500">
              {parsedLine.marker === "checkbox" ? (
                <span
                  aria-hidden="true"
                  className={cn(
                    "mt-[0.35em] flex h-4 w-4 items-center justify-center rounded-[4px] border text-[10px] font-semibold leading-none",
                    parsedLine.checked
                      ? "border-slate-500 bg-slate-600 text-white"
                      : "border-slate-300 bg-white text-transparent",
                  )}
                >
                  ✓
                </span>
              ) : (
                parsedLine.marker
              )}
            </span>
            <span className="min-w-0 break-words">
              {renderDiffTokens({
                tokens: parsedLine.tokens,
                side,
                isRegionSelected,
                onSelectRegion,
              })}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function renderList(items: unknown[], ordered: boolean): ReactNode {
  return (
    <div className="cdx-block space-y-1.5 text-[16px] leading-[1.78] tracking-[-0.01em] text-slate-700">
      {items.map((item, index) => {
        const children = getListItemChildren(item)
        const marker = ordered ? `${index + 1}.` : "•"

        return (
          <div
            key={`${getListItemText(item)}-${index}`}
            className="grid grid-cols-[1.2rem_minmax(0,1fr)] items-start gap-1.5"
          >
            <span className="mt-[0.08em] flex min-h-5 items-start justify-end pr-1 text-[0.95em] font-normal text-slate-500">
              {marker}
            </span>
            <div className="min-w-0 break-words">
              <span>{getListItemText(item)}</span>
              {children.length ? (
                <div className="mt-1">{renderList(children, ordered)}</div>
              ) : null}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function renderBlockContent(
  block: EditorBlock,
  inlineContent: ReactNode,
  diffContext?: {
    segments: PreviewDiffSegment[]
    side: PreviewSide
    isRegionSelected?: (regionIndex: number) => boolean
    onSelectRegion?: (regionIndex: number) => void
  },
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
        <blockquote className="cdx-block cdx-quote my-1 border-l-[3px] border-slate-300 py-1 pl-4 text-[16px] leading-[1.78] tracking-[-0.01em] text-slate-600">
          <div className="cdx-quote__text">{inlineContent}</div>
          {block.data.caption ? (
            <footer className="cdx-quote__caption mt-1 text-[0.9em] leading-6 text-slate-400">
              {String(block.data.caption)}
            </footer>
          ) : null}
        </blockquote>
      )
    case "code":
      return (
        <pre className="ce-code cdx-block my-2 overflow-auto rounded-[14px] border border-slate-200 bg-slate-50 px-[18px] py-4 font-mono text-[0.92rem] leading-7 text-slate-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]">
          <code>{inlineContent}</code>
        </pre>
      )
    case "list": {
      if (diffContext) {
        return renderListDiff({
          block,
          segments: diffContext.segments,
          side: diffContext.side,
          isRegionSelected: diffContext.isRegionSelected,
          onSelectRegion: diffContext.onSelectRegion,
        })
      }

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
  const blockContent = renderBlockContent(
    block,
    inlineContent,
    isInlineDiff && segments && block.type === "list"
      ? {
          segments,
          side,
          isRegionSelected,
          onSelectRegion,
        }
      : undefined,
  )
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
