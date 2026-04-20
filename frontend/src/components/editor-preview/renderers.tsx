import { cn } from "@/lib/utils"
import type { CSSProperties, ReactNode } from "react"
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

    return (
      <div className="cdx-block space-y-1 text-[16px] leading-[1.78] tracking-[-0.01em] text-slate-700">
        {lines.map((line, index) => {
          const parsedLine = parseDiffListLine(line, style, index)
          const marker =
            parsedLine.marker === "checkbox"
              ? parsedLine.marker
              : style === "ordered"
                ? parsedLine.marker
                : "•"

          return (
            <div
              key={`${lineText(line)}-${index}`}
              className="grid grid-cols-[1.65rem_minmax(0,1fr)] items-start gap-2 py-[0.08em]"
            >
              <ListMarker
                marker={marker}
                checked={parsedLine.checked}
                ordered={style === "ordered"}
              />
              <span className="min-w-0 break-words">
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
  },
}

function ListMarker({
  marker,
  checked,
  ordered,
}: {
  marker: string | "checkbox"
  checked: boolean
  ordered: boolean
}) {
  if (marker === "checkbox") {
    return <ChecklistMarker checked={checked} />
  }

  return (
    <span
      aria-hidden="true"
      className={cn(
        "mt-[0.02em] flex min-h-7 items-start justify-end pr-1 text-slate-500",
        ordered
          ? "text-[0.95em] font-medium tabular-nums"
          : "text-[1.1em] font-normal",
      )}
    >
      {marker}
    </span>
  )
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
    <div className="cdx-block space-y-1 text-[16px] leading-[1.78] tracking-[-0.01em] text-slate-700">
      {items.map((item, index) => {
        const children = getListItemChildren(item)
        const checked = getListItemChecked(item)

        return (
          <div key={`${getListItemText(item)}-${index}`} className="space-y-1">
            <div className="grid grid-cols-[1.65rem_minmax(0,1fr)] items-start gap-2 py-[0.08em]">
              <ChecklistMarker checked={checked} />
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
  return (
    <div className="cdx-block space-y-1 text-[16px] leading-[1.78] tracking-[-0.01em] text-slate-700">
      {items.map((item, index) => {
        const children = getListItemChildren(item)
        const marker = ordered ? `${index + 1}.` : "•"

        return (
          <div key={`${getListItemText(item)}-${index}`} className="space-y-1">
            <div className="grid grid-cols-[1.65rem_minmax(0,1fr)] items-start gap-2 py-[0.08em]">
              <ListMarker marker={marker} checked={false} ordered={ordered} />
              <span className="min-w-0 break-words">
                {getListItemText(item)}
              </span>
            </div>
            {children.length ? (
              <div className="ml-[1.65rem]">
                {renderList(children, ordered)}
              </div>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}

const delimiterRenderer: BlockRenderer<BlockData> = {
  extractText() {
    return "---"
  },
  render() {
    return renderDelimiter()
  },
}

function renderDelimiter() {
  return (
    <div className="cdx-block flex w-full items-center justify-center py-[1.35em] leading-none">
      <div className="h-px w-full rounded-full bg-slate-200" />
    </div>
  )
}

function getImageUrl(data: BlockData) {
  const file = data.file

  if (file && typeof file === "object" && "url" in file) {
    const url = (file as { url?: unknown }).url
    return typeof url === "string" ? url : ""
  }

  return ""
}

function getImageCaption(data: BlockData) {
  return normalizeVisibleText(data.caption)
}

function getImageFlag(data: BlockData, key: string) {
  const value = data[key]
  return value === true || value === "true"
}

function getImageResizeTune(data: BlockData) {
  const tunes = data.__tunes
  const explicitTunes = data.tunes

  const candidates: unknown[] = [
    data.imageResize,
    data.imageTune,
    tunes && typeof tunes === "object"
      ? (tunes as { imageResize?: unknown }).imageResize
      : null,
    tunes && typeof tunes === "object"
      ? (tunes as { imageTune?: unknown }).imageTune
      : null,
    explicitTunes && typeof explicitTunes === "object"
      ? (explicitTunes as { imageResize?: unknown }).imageResize
      : null,
    explicitTunes && typeof explicitTunes === "object"
      ? (explicitTunes as { imageTune?: unknown }).imageTune
      : null,
  ]

  for (const candidate of candidates) {
    if (candidate && typeof candidate === "object") {
      return candidate as Record<string, unknown>
    }
  }

  return null
}

function getResizeWidth(data: BlockData) {
  const tune = getImageResizeTune(data)
  if (!tune || tune.resize !== true) {
    return null
  }

  return getNumberFromTune(tune, "resizeSize")
}

function getNumberFromTune(tune: Record<string, unknown> | null, key: string) {
  const rawValue = tune?.[key]
  const value =
    typeof rawValue === "string"
      ? Number.parseFloat(rawValue)
      : Number(rawValue)
  return Number.isFinite(value) && value > 0 ? value : null
}

function getCropStyles(data: BlockData) {
  const tune = getImageResizeTune(data)
  if (!tune || tune.crop !== true) {
    return null
  }

  const frameWidth = getNumberFromTune(tune, "cropperFrameWidth")
  const frameHeight = getNumberFromTune(tune, "cropperFrameHeight")
  const imageWidth = getNumberFromTune(tune, "cropperImageWidth")
  const imageHeight = getNumberFromTune(tune, "cropperImageHeight")

  if (!frameWidth || !frameHeight || !imageWidth || !imageHeight) {
    return null
  }

  return {
    frameWidth,
    figure: {
      width: `${frameWidth}px`,
      maxWidth: "100%",
    } satisfies CSSProperties,
    imageWrap: {
      position: "relative",
      width: `${frameWidth}px`,
      maxWidth: "100%",
      height: `${frameHeight}px`,
    } satisfies CSSProperties,
    image: {
      position: "absolute",
      width: `${imageWidth}px`,
      maxWidth: "none",
      height: `${imageHeight}px`,
      left: `${getNumberFromTune(tune, "cropperFrameLeft") ?? 0}px`,
      top: `${getNumberFromTune(tune, "cropperFrameTop") ?? 0}px`,
    } satisfies CSSProperties,
  }
}

const imageRenderer: BlockRenderer<BlockData> = {
  extractText(data) {
    const caption = getImageCaption(data)
    const url = getImageUrl(data)
    return [caption, url].filter(Boolean).join(" ")
  },
  render(data) {
    const url = getImageUrl(data)
    const caption = getImageCaption(data)
    const withBorder = getImageFlag(data, "withBorder")
    const withBackground = getImageFlag(data, "withBackground")
    const stretched = getImageFlag(data, "stretched")
    const resizeWidth = getResizeWidth(data)
    const cropStyles = getCropStyles(data)

    return (
      <figure
        className={cn(
          "image-tool cdx-block my-[0.9em]",
          withBorder && "image-tool--withBorder",
          withBackground && "image-tool--withBackground",
          stretched && "image-tool--stretched",
          cropStyles && "cdx-image-tool-tune--crop",
          caption && "image-tool--caption",
        )}
        style={
          cropStyles?.figure ??
          (resizeWidth
            ? { width: `${resizeWidth}px`, maxWidth: "100%" }
            : undefined)
        }
      >
        {url ? (
          <div
            className={cn(
              "image-tool__image overflow-hidden rounded-2xl bg-slate-50",
              withBorder && "border border-slate-300 bg-white p-2",
              withBackground && "border border-slate-200 bg-slate-50 p-6",
            )}
            style={cropStyles?.imageWrap}
          >
            <img
              src={url}
              alt={caption || "첨부 이미지"}
              className={cn(
                "image-tool__image-picture mx-auto block rounded-2xl object-contain",
                stretched ? "w-full max-w-full" : "max-w-full",
                withBackground && !stretched && !resizeWidth && "max-w-[62%]",
                cropStyles && "isCropped",
              )}
              style={
                cropStyles?.image ??
                (resizeWidth || stretched
                  ? { width: "100%", height: "auto" }
                  : undefined)
              }
              loading="lazy"
            />
          </div>
        ) : (
          <div className="flex min-h-44 items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-400">
            이미지를 불러올 수 없습니다.
          </div>
        )}
        {caption ? (
          <figcaption className="image-tool__caption mt-2 text-center text-[0.9rem] leading-6 text-slate-500">
            {caption}
          </figcaption>
        ) : null}
      </figure>
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
  image: imageRenderer,
}

export function getBlockRenderer(type: string): BlockRenderer<BlockData> {
  return rendererRegistry[type] ?? fallbackRenderer
}

export function canRenderInlineDiff(type: string) {
  return Boolean(getBlockRenderer(type).renderWithDiff)
}
