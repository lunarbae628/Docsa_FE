import { cn } from "@/lib/utils"
import type { ReactNode } from "react"
import {
  buildDiffLines,
  lineText,
  parseDiffListLine,
  renderDiffSegments,
  renderDiffTokens,
} from "./diffRender"
import {
  getListItemChecked,
  getListItemChildren,
  getListItemText,
  normalizeListStyle,
} from "./list"
import { normalizeVisibleText, renderTextWithBreaks } from "./text"
import type { BlockRenderer, BlockRendererContext } from "./types"

type BlockData = Record<string, unknown>

function dataText(data: BlockData) {
  return normalizeVisibleText(data.text)
}

function diffInlineContent(data: BlockData, context: BlockRendererContext) {
  return context.segments?.length
    ? renderDiffSegments({
        segments: context.segments,
        side: context.side,
        isRegionSelected: context.isRegionSelected,
        onSelectRegion: context.onSelectRegion,
      })
    : renderTextWithBreaks(dataText(data))
}

function renderParagraphContent(content: ReactNode) {
  return (
    <div className="ce-paragraph cdx-block whitespace-pre-wrap break-words text-[15px] leading-8 tracking-[-0.01em] text-slate-700">
      {content}
    </div>
  )
}

const paragraphRenderer: BlockRenderer<BlockData> = {
  extractText: dataText,
  render(data) {
    return renderParagraphContent(renderTextWithBreaks(dataText(data)))
  },
  renderWithDiff(data, context) {
    return renderParagraphContent(diffInlineContent(data, context))
  },
}

const headerRenderer: BlockRenderer<BlockData> = {
  extractText: dataText,
  render(data) {
    return renderHeader(data, renderTextWithBreaks(dataText(data)))
  },
  renderWithDiff(data, context) {
    return renderHeader(data, diffInlineContent(data, context))
  },
}

function renderHeader(data: BlockData, content: ReactNode) {
  const level = Math.min(Math.max(Number(data.level ?? 2), 1), 6)
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
      {content}
    </HeaderTag>
  )
}

const quoteRenderer: BlockRenderer<BlockData> = {
  extractText: dataText,
  render(data) {
    return renderQuote(data, renderTextWithBreaks(dataText(data)))
  },
  renderWithDiff(data, context) {
    return renderQuote(data, diffInlineContent(data, context))
  },
}

function renderQuote(data: BlockData, content: ReactNode) {
  return (
    <blockquote className="cdx-block cdx-quote my-2 border-l-[3px] border-slate-300 py-1 pl-4 text-[16px] leading-[1.78] tracking-[-0.01em] text-slate-600">
      <div className="cdx-quote__text">{content}</div>
      {data.caption ? (
        <footer className="cdx-quote__caption mt-1 text-[0.9em] leading-6 text-slate-400">
          {normalizeVisibleText(data.caption)}
        </footer>
      ) : null}
    </blockquote>
  )
}

const codeRenderer: BlockRenderer<BlockData> = {
  extractText(data) {
    return String(data.code ?? "")
  },
  render(data) {
    return renderCode(renderTextWithBreaks(String(data.code ?? "")))
  },
  renderWithDiff(data, context) {
    const content = context.segments?.length
      ? renderDiffSegments({
          segments: context.segments,
          side: context.side,
          isRegionSelected: context.isRegionSelected,
          onSelectRegion: context.onSelectRegion,
        })
      : renderTextWithBreaks(String(data.code ?? ""))

    return renderCode(content)
  },
}

function renderCode(content: ReactNode) {
  return (
    <div className="ce-code cdx-block my-[0.65em]">
      <pre className="ce-code__textarea m-0 min-h-[120px] w-full overflow-auto rounded-[14px] border border-slate-200 bg-slate-50 px-[18px] py-4 font-mono text-[0.92rem] leading-[1.7] text-slate-700 shadow-[inset_0_1px_0_rgb(255_255_255_/_0.75)]">
        <code>{content}</code>
      </pre>
    </div>
  )
}

function getListItems(data: BlockData) {
  return Array.isArray(data.items) ? data.items : []
}

const listRenderer: BlockRenderer<BlockData> = {
  extractText(data) {
    const items = getListItems(data)
    const style = normalizeListStyle(data.style)

    return items
      .map((item, index) => {
        const text = getListItemText(item)
        if (style === "checklist") {
          const checked = getListItemChecked(item) ? "[x]" : "[ ]"
          return `${checked} ${text}`
        }
        return style === "ordered" ? `${index + 1}. ${text}` : `• ${text}`
      })
      .filter(Boolean)
      .join("\n")
  },
  render(data) {
    const items = getListItems(data)
    const style = normalizeListStyle(data.style)

    if (style === "checklist") {
      return renderChecklist(items)
    }

    return renderList(items, style === "ordered")
  },
  renderWithDiff(data, context) {
    if (!context.segments?.length) {
      return listRenderer.render(data)
    }

    const style = normalizeListStyle(data.style)
    const lines = buildDiffLines({
      segments: context.segments,
      side: context.side,
    })

    if (style === "checklist") {
      return (
        <div className="cdx-block space-y-1.5 text-[16px] leading-[1.78] tracking-[-0.01em] text-slate-700">
          {lines.map((line, index) => {
            const parsedLine = parseDiffListLine(line, style, index)

            return (
              <div
                key={`${lineText(line)}-${index}`}
                className="flex items-start gap-2.5"
              >
                <ChecklistMarker checked={parsedLine.checked} />
                <span className="min-w-0 break-words pt-px">
                  {renderDiffTokens({
                    tokens: parsedLine.tokens,
                    side: context.side,
                    isRegionSelected: context.isRegionSelected,
                    onSelectRegion: context.onSelectRegion,
                  })}
                </span>
              </div>
            )
          })}
        </div>
      )
    }

    return renderListShell(
      lines.map((line, index) => {
        const parsedLine = parseDiffListLine(line, style, index)

        return (
          <li
            key={`${lineText(line)}-${index}`}
            className="cdx-list__item py-[0.08em] pl-[0.1em]"
          >
            {renderDiffTokens({
              tokens: parsedLine.tokens,
              side: context.side,
              isRegionSelected: context.isRegionSelected,
              onSelectRegion: context.onSelectRegion,
            })}
          </li>
        )
      }),
      style === "ordered",
    )
  },
}

function ChecklistMarker({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "mt-[0.42em] flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border text-[10px] font-semibold leading-none",
        checked
          ? "border-slate-500 bg-slate-600 text-white"
          : "border-slate-300 bg-white text-transparent",
      )}
    >
      ✓
    </span>
  )
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

function renderList(items: unknown[], ordered: boolean): ReactNode {
  return renderListShell(
    items.map((item, index) => {
      const children = getListItemChildren(item)

      return (
        <li
          key={`${getListItemText(item)}-${index}`}
          className="cdx-list__item py-[0.08em] pl-[0.1em]"
        >
          <span>{getListItemText(item)}</span>
          {children.length ? (
            <div className="mt-1">{renderList(children, ordered)}</div>
          ) : null}
        </li>
      )
    }),
    ordered,
  )
}

function renderListShell(items: ReactNode, ordered: boolean): ReactNode {
  const ListTag = ordered ? "ol" : "ul"

  return (
    <div className="cdx-block">
      <ListTag
        className={cn(
          "cdx-list m-0 pl-[1.35em] text-[16px] leading-[1.78] tracking-[-0.01em] text-slate-700",
          ordered
            ? "cdx-list--ordered list-decimal"
            : "cdx-list--unordered list-disc",
        )}
      >
        {items}
      </ListTag>
    </div>
  )
}

const delimiterRenderer: BlockRenderer<BlockData> = {
  extractText() {
    return "---"
  },
  render() {
    return (
      <div className="ce-delimiter cdx-block flex w-full items-center justify-center py-[1.35em] leading-none">
        <div className="h-px w-full rounded-full bg-slate-200" />
      </div>
    )
  },
}

const fallbackRenderer: BlockRenderer<BlockData> = {
  extractText(data) {
    return String(data.text ?? JSON.stringify(data))
  },
  render(data) {
    return renderParagraphContent(
      renderTextWithBreaks(String(data.text ?? JSON.stringify(data))),
    )
  },
}

const rendererRegistry: Record<string, BlockRenderer<BlockData>> = {
  paragraph: paragraphRenderer,
  header: headerRenderer,
  quote: quoteRenderer,
  code: codeRenderer,
  list: listRenderer,
  delimiter: delimiterRenderer,
}

export function getBlockRenderer(type: string): BlockRenderer<BlockData> {
  return rendererRegistry[type] ?? fallbackRenderer
}

export function canRenderInlineDiff(type: string) {
  return Boolean(getBlockRenderer(type).renderWithDiff)
}
