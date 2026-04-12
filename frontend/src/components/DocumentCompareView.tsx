import { useMemo } from "react"
import type { OutputData } from "@editorjs/editorjs"
import { diff_match_patch } from "diff-match-patch"
import { cn } from "@/lib/utils"
import type { EditorBlock } from "@/lib/diffUtils"

interface DocumentCompareViewProps {
  leftData: OutputData
  rightData: OutputData
  leftLabel: string
  leftSubtitle?: string
  rightLabel: string
  rightSubtitle?: string
  className?: string
}

type CompareRowStatus = "same" | "modified" | "deleted" | "added"

type CompareRow = {
  key: string
  leftBlock?: EditorBlock
  rightBlock?: EditorBlock
  status: CompareRowStatus
}

type DiffSegment =
  | { type: "equal"; text: string }
  | { type: "changed"; leftText: string; rightText: string }

function getVisibleBlockText(block: EditorBlock | undefined): string {
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
          const text =
            typeof item === "string"
              ? item
              : String(item?.content ?? item?.text ?? item?.value ?? "")
          return ordered ? `${index + 1}. ${text}` : `• ${text}`
        })
        .join("\n")
    }
    default:
      return String(block?.data?.text ?? JSON.stringify(block.data))
  }
}

function normalizeText(text: string) {
  return text.replace(/\s+/g, " ").trim().toLowerCase()
}

function tokenize(text: string) {
  return normalizeText(text)
    .split(/[\s,.;:!?()[\]{}"'`~<>/\\|+-]+/)
    .filter(Boolean)
}

function scoreTextSimilarity(a: string, b: string) {
  const left = normalizeText(a)
  const right = normalizeText(b)

  if (!left && !right) return 1
  if (!left || !right) return 0
  if (left === right) return 1

  const leftTokens = new Set(tokenize(left))
  const rightTokens = new Set(tokenize(right))
  const union = new Set([...leftTokens, ...rightTokens])
  let intersection = 0

  leftTokens.forEach((token) => {
    if (rightTokens.has(token)) intersection += 1
  })

  const tokenScore = union.size > 0 ? intersection / union.size : 0
  const prefixScore = left.startsWith(right) || right.startsWith(left) ? 0.15 : 0
  const lengthScore =
    1 - Math.min(Math.abs(left.length - right.length), Math.max(left.length, right.length)) /
      Math.max(left.length, right.length)

  return Math.max(tokenScore + prefixScore, lengthScore * 0.35)
}

function pairScore(leftBlock: EditorBlock, rightBlock: EditorBlock) {
  const leftText = getVisibleBlockText(leftBlock)
  const rightText = getVisibleBlockText(rightBlock)
  const similarity = scoreTextSimilarity(leftText, rightText)

  if (leftBlock.type === rightBlock.type && similarity === 1) {
    return 4
  }

  if (leftBlock.type === rightBlock.type && similarity >= 0.18) {
    return 1.5 + similarity
  }

  if (similarity >= 0.65) {
    return 0.8 + similarity * 0.5
  }

  return Number.NEGATIVE_INFINITY
}

function buildRows(leftData: OutputData, rightData: OutputData): CompareRow[] {
  const leftBlocks = (leftData.blocks as EditorBlock[]) ?? []
  const rightBlocks = (rightData.blocks as EditorBlock[]) ?? []
  const gapPenalty = -0.8
  const dp = Array.from({ length: leftBlocks.length + 1 }, () =>
    Array(rightBlocks.length + 1).fill(0),
  )

  for (let i = leftBlocks.length - 1; i >= 0; i -= 1) {
    dp[i][rightBlocks.length] = dp[i + 1][rightBlocks.length] + gapPenalty
  }

  for (let j = rightBlocks.length - 1; j >= 0; j -= 1) {
    dp[leftBlocks.length][j] = dp[leftBlocks.length][j + 1] + gapPenalty
  }

  for (let i = leftBlocks.length - 1; i >= 0; i -= 1) {
    for (let j = rightBlocks.length - 1; j >= 0; j -= 1) {
      const match = pairScore(leftBlocks[i], rightBlocks[j]) + dp[i + 1][j + 1]
      const deleteLeft = gapPenalty + dp[i + 1][j]
      const insertRight = gapPenalty + dp[i][j + 1]
      dp[i][j] = Math.max(match, deleteLeft, insertRight)
    }
  }

  const rows: CompareRow[] = []
  let i = 0
  let j = 0

  while (i < leftBlocks.length || j < rightBlocks.length) {
    const leftBlock = leftBlocks[i]
    const rightBlock = rightBlocks[j]
    const match =
      leftBlock && rightBlock
        ? pairScore(leftBlock, rightBlock) + dp[i + 1][j + 1]
        : Number.NEGATIVE_INFINITY
    const deleteLeft = leftBlock ? gapPenalty + dp[i + 1][j] : Number.NEGATIVE_INFINITY
    const insertRight = rightBlock ? gapPenalty + dp[i][j + 1] : Number.NEGATIVE_INFINITY

    if (
      leftBlock &&
      rightBlock &&
      Number.isFinite(match) &&
      match >= deleteLeft &&
      match >= insertRight
    ) {
      const leftText = getVisibleBlockText(leftBlock)
      const rightText = getVisibleBlockText(rightBlock)

      rows.push({
        key: `pair-${i}-${j}`,
        leftBlock,
        rightBlock,
        status:
          leftBlock.type === rightBlock.type && leftText === rightText
            ? "same"
            : "modified",
      })
      i += 1
      j += 1
      continue
    }

    if (leftBlock && (!rightBlock || deleteLeft >= insertRight)) {
      rows.push({ key: `left-${i}`, leftBlock, status: "deleted" })
      i += 1
      continue
    }

    if (rightBlock) {
      rows.push({ key: `right-${j}`, rightBlock, status: "added" })
      j += 1
    }
  }

  return rows
}

function buildDiffSegments(leftText: string, rightText: string): DiffSegment[] {
  const dmp = new diff_match_patch()
  const diffs = dmp.diff_main(leftText, rightText)
  dmp.diff_cleanupSemantic(diffs)

  const segments: DiffSegment[] = []
  let pendingLeft = ""
  let pendingRight = ""

  const flushChanged = () => {
    if (!pendingLeft && !pendingRight) return
    segments.push({ type: "changed", leftText: pendingLeft, rightText: pendingRight })
    pendingLeft = ""
    pendingRight = ""
  }

  diffs.forEach(([op, text]: [number, string]) => {
    if (op === 0) {
      flushChanged()
      segments.push({ type: "equal", text })
    } else if (op === -1) {
      pendingLeft += text
    } else {
      pendingRight += text
    }
  })

  flushChanged()
  return segments
}

function blockBodyClass(block: EditorBlock | undefined) {
  switch (block?.type) {
    case "header":
      return "text-[1.55rem] font-semibold leading-10 text-slate-900"
    case "quote":
      return "border-l-4 border-slate-200 pl-4 text-[15px] italic leading-7 text-slate-600"
    case "code":
      return "rounded-lg bg-slate-900/95 px-4 py-3 font-mono text-[13px] leading-6 text-slate-100"
    default:
      return "text-[15px] leading-8 text-slate-700"
  }
}

function ComparePane({
  label,
  subtitle,
  side,
  rows,
}: {
  label: string
  subtitle?: string
  side: "left" | "right"
  rows: CompareRow[]
}) {
  return (
    <div className="flex min-h-0 flex-col bg-white">
      <div className="border-b border-slate-200 px-5 py-4">
        <div className="text-sm font-semibold text-slate-900">{label}</div>
        {subtitle ? <div className="mt-1 text-xs text-slate-500">{subtitle}</div> : null}
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-6 py-6">
        <div className="mx-auto max-w-[860px]">
          {rows.map((row) => {
            const block = side === "left" ? row.leftBlock : row.rightBlock
            const compareBlock = side === "left" ? row.rightBlock : row.leftBlock

            if (!block) {
              return <div key={`${side}-${row.key}`} className="h-6" />
            }

            const text = getVisibleBlockText(block)
            const compareText = getVisibleBlockText(compareBlock)

            return (
              <div key={`${side}-${row.key}`} className="border-b border-slate-100 py-4 last:border-b-0">
                <div className={cn("whitespace-pre-wrap break-words font-sans", blockBodyClass(block))}>
                  {row.status === "same" ? (
                    text
                  ) : !compareBlock ? (
                    <span className={side === "left" ? "bg-rose-100/90 text-rose-700" : "bg-emerald-100/90 text-emerald-700"}>
                      {text}
                    </span>
                  ) : (
                    buildDiffSegments(
                      side === "left" ? text : compareText,
                      side === "left" ? compareText : text,
                    ).map((segment, index) => {
                      if (segment.type === "equal") {
                        return <span key={`${side}-${row.key}-eq-${index}`}>{segment.text}</span>
                      }

                      const visibleText = side === "left" ? segment.leftText : segment.rightText
                      if (!visibleText) return null

                      return (
                        <span
                          key={`${side}-${row.key}-chg-${index}`}
                          className={cn(
                            "rounded px-0.5",
                            side === "left"
                              ? "bg-rose-100/90 text-rose-700"
                              : "bg-emerald-100/90 text-emerald-700",
                          )}
                        >
                          {visibleText}
                        </span>
                      )
                    })
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default function DocumentCompareView({
  leftData,
  rightData,
  leftLabel,
  leftSubtitle,
  rightLabel,
  rightSubtitle,
  className,
}: DocumentCompareViewProps) {
  const rows = useMemo(() => buildRows(leftData, rightData), [leftData, rightData])

  return (
    <div className={cn("grid h-full min-h-0 grid-cols-2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm", className)}>
      <div className="border-r border-slate-200">
        <ComparePane
          label={leftLabel}
          subtitle={leftSubtitle}
          side="left"
          rows={rows}
        />
      </div>
      <div>
        <ComparePane
          label={rightLabel}
          subtitle={rightSubtitle}
          side="right"
          rows={rows}
        />
      </div>
    </div>
  )
}
