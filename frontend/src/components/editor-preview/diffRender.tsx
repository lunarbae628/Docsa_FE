import { cn } from "@/lib/utils"
import type { ListStyle } from "./list"
import { sideTone } from "./styles"
import { renderTextWithBreaks } from "./text"
import type { PreviewDiffSegment, PreviewSide } from "./types"

export type DiffLineToken =
  | { key: string; type: "equal"; text: string }
  | { key: string; type: "changed"; text: string; regionIndex: number }

export function renderDiffSegments({
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

export function buildDiffLines({
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

export function lineText(tokens: DiffLineToken[]) {
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

export function parseDiffListLine(
  tokens: DiffLineToken[],
  style: ListStyle,
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

export function renderDiffTokens({
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
