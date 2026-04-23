import {
  COLUMNS_LAYOUT_REGION_INDEX,
  VISUAL_BLOCK_REGION_INDEX,
  columnsRegionIndex,
} from "@/lib/columnsDiff"
import type { EditorBlock } from "@/lib/diffUtils"
import { cn } from "@/lib/utils"
import type { OutputData } from "@editorjs/editorjs"
import { diff_match_patch } from "diff-match-patch"
import {
  Check,
  ChevronsLeft,
  ChevronsRight,
  GitMerge,
  Maximize2,
  X,
} from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import DocumentEditor, { type DocumentEditorRef } from "./DocumentEditor"
import EditorBlockPreview, {
  getComparableBlockText,
  getVisibleBlockText,
  type PreviewDiffSegment,
} from "./EditorBlockPreview"
import { Button } from "./ui/button"

interface DocumentMergeViewProps {
  baseData: OutputData
  targetData: OutputData
  onSave: (mergedData: OutputData) => void
  onCancel: () => void
  title?: string
  baseLabel?: string
  targetLabel?: string
  documentId?: number
  className?: string
}

type MergeRowStatus = "same" | "modified" | "deleted" | "added"
type MergeDecision = "left" | "right" | null
type ExpandedPane = "left" | "result" | "right" | null
type ResultMarker = {
  id: number
  label: string
  tone: "blue" | "rose" | "emerald"
  rects: Array<{
    top: number
    left: number
    width: number
    height: number
  }>
} | null
type ResultTextRange = { start: number; end: number } | null

type MergeRow = {
  key: string
  leftBlock?: EditorBlock
  rightBlock?: EditorBlock
  leftIndex: number | null
  rightIndex: number | null
  status: MergeRowStatus
}

type DiffSegment =
  | { type: "equal"; text: string }
  | {
      type: "changed"
      leftText: string
      rightText: string
      regionIndex: number
    }

function cloneData<T>(value: T): T {
  return JSON.parse(JSON.stringify(value))
}

function createOutputData(blocks: OutputData["blocks"]): OutputData {
  return {
    time: Date.now(),
    version: "2.30.8",
    blocks,
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

  for (const token of leftTokens) {
    if (rightTokens.has(token)) {
      intersection += 1
    }
  }

  const tokenScore = union.size > 0 ? intersection / union.size : 0
  const prefixScore =
    left.startsWith(right) || right.startsWith(left) ? 0.15 : 0
  const lengthScore =
    1 -
    Math.min(
      Math.abs(left.length - right.length),
      Math.max(left.length, right.length),
    ) /
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

function getColumnLayoutSignature(block: EditorBlock) {
  if (block.type !== "columns") {
    return ""
  }

  const ratio = Number(block.data.leftRatio)
  const leftRatio = Number.isFinite(ratio)
    ? Math.min(72, Math.max(28, ratio))
    : 50

  return `columns:${leftRatio}:${100 - leftRatio}`
}

function isSameBlockForPreview(
  leftBlock: EditorBlock,
  rightBlock: EditorBlock,
) {
  return (
    leftBlock.type === rightBlock.type &&
    getComparableBlockText(leftBlock) === getComparableBlockText(rightBlock) &&
    getColumnLayoutSignature(leftBlock) === getColumnLayoutSignature(rightBlock)
  )
}

function buildMergeRows(
  baseData: OutputData,
  targetData: OutputData,
): MergeRow[] {
  const leftBlocks = (baseData.blocks as EditorBlock[]) ?? []
  const rightBlocks = (targetData.blocks as EditorBlock[]) ?? []
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

  const rows: MergeRow[] = []
  let i = 0
  let j = 0

  while (i < leftBlocks.length || j < rightBlocks.length) {
    const leftBlock = leftBlocks[i]
    const rightBlock = rightBlocks[j]
    const match =
      leftBlock && rightBlock
        ? pairScore(leftBlock, rightBlock) + dp[i + 1][j + 1]
        : Number.NEGATIVE_INFINITY
    const deleteLeft = leftBlock
      ? gapPenalty + dp[i + 1][j]
      : Number.NEGATIVE_INFINITY
    const insertRight = rightBlock
      ? gapPenalty + dp[i][j + 1]
      : Number.NEGATIVE_INFINITY

    if (
      leftBlock &&
      rightBlock &&
      Number.isFinite(match) &&
      match >= deleteLeft &&
      match >= insertRight
    ) {
      rows.push({
        key: `pair-${i}-${j}`,
        leftBlock,
        rightBlock,
        leftIndex: i,
        rightIndex: j,
        status: isSameBlockForPreview(leftBlock, rightBlock)
          ? "same"
          : "modified",
      })
      i += 1
      j += 1
      continue
    }

    if (leftBlock && (!rightBlock || deleteLeft >= insertRight)) {
      rows.push({
        key: `left-${i}`,
        leftBlock,
        leftIndex: i,
        rightIndex: null,
        status: "deleted",
      })
      i += 1
      continue
    }

    if (rightBlock) {
      rows.push({
        key: `right-${j}`,
        rightBlock,
        leftIndex: null,
        rightIndex: j,
        status: "added",
      })
      j += 1
    }
  }

  return rows
}

function buildDiffSegments(leftText: string, rightText: string): DiffSegment[] {
  const dmp = new diff_match_patch()
  const diffs = dmp.diff_main(leftText, rightText)

  const segments: DiffSegment[] = []
  let pendingLeft = ""
  let pendingRight = ""
  let regionIndex = 0

  const flushChanged = () => {
    if (!pendingLeft && !pendingRight) return

    segments.push({
      type: "changed",
      leftText: pendingLeft,
      rightText: pendingRight,
      regionIndex,
    })
    pendingLeft = ""
    pendingRight = ""
    regionIndex += 1
  }

  for (const [op, text] of diffs) {
    if (op === 0) {
      flushChanged()
      segments.push({ type: "equal", text })
    } else if (op === -1) {
      pendingLeft += text
    } else {
      pendingRight += text
    }
  }

  flushChanged()
  return segments
}

function isEditableTextBlock(block?: EditorBlock) {
  return Boolean(
    block &&
      ["paragraph", "header", "quote", "code", "list"].includes(block.type),
  )
}

function getListStyle(
  block: EditorBlock,
): "ordered" | "unordered" | "checklist" {
  return block.data.style === "ordered" ||
    block.data.style === "unordered" ||
    block.data.style === "checklist"
    ? block.data.style
    : "unordered"
}

function normalizeListText(value: unknown) {
  return String(value ?? "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/\u00a0/g, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .trim()
}

function parseListLine(
  line: string,
  style: "ordered" | "unordered" | "checklist",
) {
  const trimmedLine = normalizeListText(line)

  if (style === "checklist") {
    const checklistMatch = trimmedLine.match(
      /^(?:[-*•]|\d+\.)?\s*\[(x|X|\s)?]\s*(.*)$/,
    )

    return {
      content: normalizeListText(
        checklistMatch ? checklistMatch[2] : trimmedLine,
      ),
      checked: checklistMatch
        ? (checklistMatch[1] ?? "").toLowerCase() === "x"
        : false,
    }
  }

  return {
    content: normalizeListText(trimmedLine.replace(/^(\d+\.|[-*•])\s+/, "")),
    checked: false,
  }
}

function setListItemContent(
  item: unknown,
  content: string,
  checked: boolean,
  style: "ordered" | "unordered" | "checklist",
) {
  if (typeof item === "string") {
    return content
  }

  if (!item || typeof item !== "object") {
    if (style === "checklist") {
      return { content, meta: { checked }, items: [] }
    }

    return { content, meta: {}, items: [] }
  }

  const nextItem = { ...(item as Record<string, unknown>) }

  nextItem.content = content
  nextItem.text = undefined
  nextItem.value = undefined
  nextItem.checked = undefined

  if (style === "checklist") {
    const meta =
      nextItem.meta && typeof nextItem.meta === "object" ? nextItem.meta : {}
    nextItem.meta = { ...(meta as Record<string, unknown>), checked }
  }

  if (!Array.isArray(nextItem.items)) {
    nextItem.items = []
  }

  return nextItem
}

function setListBlockText(block: EditorBlock, text: string): EditorBlock {
  const nextBlock = cloneData(block)
  const style = getListStyle(nextBlock)
  const originalItems = Array.isArray(nextBlock.data.items)
    ? nextBlock.data.items
    : []
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)

  nextBlock.data.style = style
  nextBlock.data.items = lines
    .map((line) => parseListLine(line, style))
    .filter((line) => line.content.length > 0)
    .map((line, index) =>
      setListItemContent(
        originalItems[index],
        line.content,
        line.checked,
        style,
      ),
    )

  return nextBlock
}

function setBlockText(block: EditorBlock, text: string): EditorBlock {
  const nextBlock = cloneData(block)

  switch (nextBlock.type) {
    case "paragraph":
    case "header":
    case "quote":
      nextBlock.data.text = text.replace(/\n/g, "<br>")
      return nextBlock
    case "code":
      nextBlock.data.code = text
      return nextBlock
    case "list":
      return setListBlockText(block, text)
    default:
      return nextBlock
  }
}

function decisionKey(row: MergeRow, regionIndex: number | null) {
  return `${row.key}:${regionIndex ?? "block"}`
}

function getColumnBlocks(block: EditorBlock | undefined, columnIndex: number) {
  const columns = Array.isArray(block?.data.columns)
    ? block.data.columns.slice(0, 2)
    : []
  const column = columns[columnIndex]

  if (!column || typeof column !== "object") {
    return []
  }

  const blocks = (column as { blocks?: unknown }).blocks
  return Array.isArray(blocks) ? (blocks as EditorBlock[]) : []
}

function getColumnId(block: EditorBlock | undefined, columnIndex: number) {
  const columns = Array.isArray(block?.data.columns)
    ? block.data.columns.slice(0, 2)
    : []
  const column = columns[columnIndex]

  if (!column || typeof column !== "object") {
    return undefined
  }

  const id = (column as { id?: unknown }).id
  return typeof id === "string" ? id : undefined
}

function buildMergedEditableBlock(
  row: MergeRow,
  leftBlock: EditorBlock,
  rightBlock: EditorBlock,
  decisions: Record<string, MergeDecision>,
  mapRegionIndex = (regionIndex: number) => regionIndex,
) {
  const leftText = getVisibleBlockText(leftBlock)
  const rightText = getVisibleBlockText(rightBlock)
  const segments = buildDiffSegments(leftText, rightText)
  const nextText = segments
    .map((segment) => {
      if (segment.type === "equal") return segment.text

      const decision =
        decisions[decisionKey(row, mapRegionIndex(segment.regionIndex))]
      if (decision === "left") return segment.leftText
      if (decision === "right") return segment.rightText

      return ""
    })
    .join("")

  if (!nextText.replace(/\s+/g, "")) {
    return null
  }

  return setBlockText(rightBlock, nextText)
}

function buildMergedVisualBlock(
  row: MergeRow,
  leftBlock: EditorBlock | undefined,
  rightBlock: EditorBlock | undefined,
  decisions: Record<string, MergeDecision>,
  regionIndex: number,
) {
  const decision = decisions[decisionKey(row, regionIndex)]

  if (decision === "left" && leftBlock) return cloneData(leftBlock)
  if (decision === "right" && rightBlock) return cloneData(rightBlock)

  if (
    leftBlock &&
    rightBlock &&
    leftBlock.type === rightBlock.type &&
    getVisibleBlockText(leftBlock) === getVisibleBlockText(rightBlock)
  ) {
    return cloneData(rightBlock)
  }

  return null
}

function buildMergedColumnsBlock(
  row: MergeRow,
  decisions: Record<string, MergeDecision>,
) {
  if (!row.leftBlock || !row.rightBlock) {
    return null
  }

  const nextBlock = cloneData(row.rightBlock)
  const layoutDecision =
    decisions[decisionKey(row, COLUMNS_LAYOUT_REGION_INDEX)]

  if (layoutDecision === "left" && row.leftBlock) {
    nextBlock.data.leftRatio = row.leftBlock.data.leftRatio
  } else if (layoutDecision === "right" && row.rightBlock) {
    nextBlock.data.leftRatio = row.rightBlock.data.leftRatio
  }

  nextBlock.data.columns = [0, 1].map((columnIndex) => {
    const leftBlocks = getColumnBlocks(row.leftBlock, columnIndex)
    const rightBlocks = getColumnBlocks(row.rightBlock, columnIndex)
    const maxLength = Math.max(leftBlocks.length, rightBlocks.length)
    const blocks: EditorBlock[] = []

    for (let blockIndex = 0; blockIndex < maxLength; blockIndex += 1) {
      const leftBlock = leftBlocks[blockIndex]
      const rightBlock = rightBlocks[blockIndex]
      const visualRegionIndex = columnsRegionIndex(
        columnIndex,
        blockIndex,
        VISUAL_BLOCK_REGION_INDEX,
      )

      if (
        leftBlock &&
        rightBlock &&
        leftBlock.type === rightBlock.type &&
        isEditableTextBlock(leftBlock) &&
        isEditableTextBlock(rightBlock)
      ) {
        const mergedBlock = buildMergedEditableBlock(
          row,
          leftBlock,
          rightBlock,
          decisions,
          (regionIndex) =>
            columnsRegionIndex(columnIndex, blockIndex, regionIndex),
        )

        if (mergedBlock) {
          blocks.push(mergedBlock)
        }
        continue
      }

      const mergedVisualBlock = buildMergedVisualBlock(
        row,
        leftBlock,
        rightBlock,
        decisions,
        visualRegionIndex,
      )

      if (mergedVisualBlock) {
        blocks.push(mergedVisualBlock)
      }
    }

    return {
      id:
        getColumnId(row.rightBlock, columnIndex) ??
        getColumnId(row.leftBlock, columnIndex),
      blocks,
    }
  })

  return nextBlock
}

function buildCommonBlock(
  row: MergeRow,
  decisions: Record<string, MergeDecision>,
) {
  if (row.status === "same") {
    const commonBlock = row.rightBlock ?? row.leftBlock
    return commonBlock ? cloneData(commonBlock) : null
  }

  const wholeDecision = decisions[decisionKey(row, null)]
  if (wholeDecision === "left" && row.leftBlock) return cloneData(row.leftBlock)
  if (wholeDecision === "right" && row.rightBlock)
    return cloneData(row.rightBlock)

  if (row.leftBlock?.type === "columns" && row.rightBlock?.type === "columns") {
    return buildMergedColumnsBlock(row, decisions)
  }

  if (
    row.leftBlock &&
    row.rightBlock &&
    row.leftBlock.type === row.rightBlock.type
  ) {
    const mergedVisualBlock = buildMergedVisualBlock(
      row,
      row.leftBlock,
      row.rightBlock,
      decisions,
      VISUAL_BLOCK_REGION_INDEX,
    )

    if (mergedVisualBlock) {
      return mergedVisualBlock
    }
  }

  if (
    !row.leftBlock ||
    !row.rightBlock ||
    !isEditableTextBlock(row.leftBlock) ||
    !isEditableTextBlock(row.rightBlock)
  ) {
    return null
  }

  return buildMergedEditableBlock(row, row.leftBlock, row.rightBlock, decisions)
}

function buildMergedDataFromDecisions(
  rows: MergeRow[],
  decisions: Record<string, MergeDecision>,
) {
  const blocks = rows
    .map((row) => buildCommonBlock(row, decisions))
    .filter((block): block is EditorBlock => Boolean(block))

  return createOutputData(blocks)
}

function findResultBlockIndex(
  rows: MergeRow[],
  decisions: Record<string, MergeDecision>,
  rowKey: string | null,
) {
  if (!rowKey) return null

  let fallbackIndex = 0
  let blockIndex = 0

  for (const row of rows) {
    const resultBlock = buildCommonBlock(row, decisions)

    if (row.key === rowKey) {
      return resultBlock ? blockIndex : Math.max(0, blockIndex - 1)
    }

    if (resultBlock) {
      blockIndex += 1
      fallbackIndex = blockIndex - 1
    }
  }

  return fallbackIndex
}

function createRangeFromOffsets(
  textNodes: Text[],
  startOffset: number,
  endOffset: number,
) {
  const range = document.createRange()
  let cursor = 0
  let startSet = false

  for (const textNode of textNodes) {
    const nextCursor = cursor + textNode.data.length

    if (!startSet && startOffset <= nextCursor) {
      range.setStart(textNode, Math.max(0, startOffset - cursor))
      startSet = true
    }

    if (startSet && endOffset <= nextCursor) {
      range.setEnd(textNode, Math.max(0, endOffset - cursor))
      return range
    }

    cursor = nextCursor
  }

  return null
}

function getTextNodes(root: HTMLElement) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const textNodes: Text[] = []
  let fullText = ""
  let currentNode = walker.nextNode()

  while (currentNode) {
    const textNode = currentNode as Text
    textNodes.push(textNode)
    fullText += textNode.data
    currentNode = walker.nextNode()
  }

  return { textNodes, fullText }
}

function findTextRangeByOffsets(
  root: HTMLElement,
  textRange: ResultTextRange,
  expectedText: string | null,
) {
  if (!textRange || textRange.start >= textRange.end) return null

  const { textNodes, fullText } = getTextNodes(root)
  if (textRange.end > fullText.length) return null

  if (
    expectedText &&
    fullText.slice(textRange.start, textRange.end) !== expectedText
  ) {
    return null
  }

  return createRangeFromOffsets(textNodes, textRange.start, textRange.end)
}

function findTextRange(root: HTMLElement, targetText: string | null) {
  const needle = targetText?.trim()
  if (!needle) return null

  const { textNodes, fullText } = getTextNodes(root)
  const startOffset = fullText.indexOf(needle)
  if (startOffset < 0) return null

  return createRangeFromOffsets(
    textNodes,
    startOffset,
    startOffset + needle.length,
  )
}

function getChangedSegmentRange(
  row: MergeRow,
  regionIndex: number,
  decisions: Record<string, MergeDecision>,
): ResultTextRange {
  if (
    !row.leftBlock ||
    !row.rightBlock ||
    !isEditableTextBlock(row.leftBlock) ||
    !isEditableTextBlock(row.rightBlock)
  ) {
    return null
  }

  const segments = buildDiffSegments(
    getVisibleBlockText(row.leftBlock),
    getVisibleBlockText(row.rightBlock),
  )
  let cursor = 0

  for (const segment of segments) {
    if (segment.type === "equal") {
      cursor += segment.text.length
      continue
    }

    const decision = decisions[decisionKey(row, segment.regionIndex)]
    const text =
      decision === "left"
        ? segment.leftText
        : decision === "right"
          ? segment.rightText
          : ""
    const start = cursor
    cursor += text.length

    if (segment.regionIndex === regionIndex && text) {
      return { start, end: cursor }
    }
  }

  return null
}

function getRangeRects(
  range: Range | null,
  fallbackElement: HTMLElement,
  shell: HTMLElement,
  useFallback: boolean,
) {
  const holderRect = shell.getBoundingClientRect()
  const sourceRects = range
    ? Array.from(range.getClientRects()).filter(
        (rect) => rect.width > 6 && rect.height > 8,
      )
    : []
  const rects = sourceRects.length
    ? sourceRects
    : useFallback
      ? [fallbackElement.getBoundingClientRect()]
      : []

  return rects.map((rect) => ({
    top: rect.top - holderRect.top + shell.scrollTop,
    left: rect.left - holderRect.left + shell.scrollLeft,
    width: rect.width,
    height: rect.height,
  }))
}

function getChangedSegmentText(
  row: MergeRow,
  regionIndex: number,
  side: "left" | "right",
) {
  const segment = getChangedSegments(row).find(
    (candidate) => candidate.regionIndex === regionIndex,
  )

  if (!segment) return null
  return side === "left" ? segment.leftText : segment.rightText
}

function getChangedSegments(row: MergeRow) {
  if (
    !row.leftBlock ||
    !row.rightBlock ||
    !isEditableTextBlock(row.leftBlock) ||
    !isEditableTextBlock(row.rightBlock)
  ) {
    return []
  }

  return buildDiffSegments(
    getVisibleBlockText(row.leftBlock),
    getVisibleBlockText(row.rightBlock),
  ).filter(
    (segment): segment is Extract<DiffSegment, { type: "changed" }> =>
      segment.type === "changed",
  )
}

function buildAllDecisions(rows: MergeRow[], side: "left" | "right") {
  const nextDecisions: Record<string, MergeDecision> = {}

  for (const row of rows) {
    if (row.status === "same") continue

    const changedSegments = getChangedSegments(row)
    if (!changedSegments.length) {
      nextDecisions[decisionKey(row, null)] = side
      continue
    }

    for (const segment of changedSegments) {
      nextDecisions[decisionKey(row, segment.regionIndex)] = side
    }
  }

  return nextDecisions
}

function PaneBlock({
  row,
  side,
  showDiff,
  decisions,
  onSelectWhole,
  onSelectRegion,
}: {
  row: MergeRow
  side: "left" | "right"
  showDiff: boolean
  decisions: Record<string, MergeDecision>
  onSelectWhole: (row: MergeRow, side: "left" | "right") => void
  onSelectRegion: (
    row: MergeRow,
    side: "left" | "right",
    regionIndex: number,
  ) => void
}) {
  const block = side === "left" ? row.leftBlock : row.rightBlock
  const compareBlock = side === "left" ? row.rightBlock : row.leftBlock

  if (!block) {
    return <div className="h-6" />
  }

  const blockText = getVisibleBlockText(block)
  const compareText = getVisibleBlockText(compareBlock)
  const hasVisibleTextDiff = blockText !== compareText
  const wholeDecision = decisions[decisionKey(row, null)] ?? null
  const isWholeSelected = wholeDecision === side

  const segments =
    showDiff && row.status !== "same" && compareBlock && hasVisibleTextDiff
      ? (buildDiffSegments(
          side === "left" ? blockText : compareText,
          side === "left" ? compareText : blockText,
        ) as PreviewDiffSegment[])
      : undefined

  return (
    <EditorBlockPreview
      block={block}
      compareBlock={showDiff ? compareBlock : undefined}
      side={side}
      status={showDiff ? row.status : "same"}
      segments={segments}
      buildSegments={showDiff ? buildDiffSegments : undefined}
      isWholeSelected={isWholeSelected}
      isRegionSelected={(regionIndex) =>
        decisions[decisionKey(row, regionIndex)] === side
      }
      onSelectWhole={
        showDiff && row.status !== "same"
          ? () => onSelectWhole(row, side)
          : undefined
      }
      onSelectRegion={
        showDiff
          ? (regionIndex) => onSelectRegion(row, side, regionIndex)
          : undefined
      }
    />
  )
}

function PreviewPane({
  label,
  subtitle,
  side,
  showDiff,
  rows,
  decisions,
  onExpand,
  onSelectWhole,
  onSelectRegion,
}: {
  label: string
  subtitle: string
  side: "left" | "right"
  showDiff: boolean
  rows: MergeRow[]
  decisions: Record<string, MergeDecision>
  onExpand: () => void
  onSelectWhole: (row: MergeRow, side: "left" | "right") => void
  onSelectRegion: (
    row: MergeRow,
    side: "left" | "right",
    regionIndex: number,
  ) => void
}) {
  return (
    <div className="flex min-h-0 min-w-0 flex-col bg-white">
      <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-slate-900">
            {label}
          </div>
          <div className="mt-1 text-xs text-slate-500">{subtitle}</div>
        </div>
        <button
          type="button"
          className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
          onClick={onExpand}
        >
          <Maximize2 className="h-3.5 w-3.5" />
          크게 보기
        </button>
      </div>
      <div className="min-h-0 min-w-0 flex-1 overflow-auto px-6 py-6">
        <div className="w-full min-w-0">
          {rows.map((row) => (
            <div key={`${side}-${row.key}`} className="py-4">
              <PaneBlock
                row={row}
                side={side}
                showDiff={showDiff}
                decisions={decisions}
                onSelectWhole={onSelectWhole}
                onSelectRegion={onSelectRegion}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function ExpandedReadOnlyDocument({
  rows,
  side,
}: {
  rows: MergeRow[]
  side: "left" | "right"
}) {
  return (
    <div className="mx-auto w-full max-w-[860px] px-10 py-10">
      {rows.map((row) => {
        const block = side === "left" ? row.leftBlock : row.rightBlock
        if (!block) return <div key={`${side}-${row.key}`} className="h-6" />

        return (
          <div key={`${side}-${row.key}`} className="py-3">
            <EditorBlockPreview block={block} side={side} status="same" />
          </div>
        )
      })}
    </div>
  )
}

export default function DocumentMergeView({
  baseData,
  targetData,
  onSave,
  onCancel,
  title = "브랜치 병합",
  baseLabel = "기준 브랜치",
  targetLabel = "병합할 브랜치",
  documentId,
  className,
}: DocumentMergeViewProps) {
  const editorRef = useRef<DocumentEditorRef>(null)
  const resultEditorShellRef = useRef<HTMLDivElement>(null)
  const flashTimerRef = useRef<number | null>(null)
  const flashRequestRef = useRef(0)
  const rows = useMemo(
    () => buildMergeRows(baseData, targetData),
    [baseData, targetData],
  )
  const baselineData = useMemo(
    () => buildMergedDataFromDecisions(rows, {}),
    [rows],
  )
  const [mergedData, setMergedData] = useState<OutputData>(
    cloneData(baselineData),
  )
  const [decisions, setDecisions] = useState<Record<string, MergeDecision>>({})
  const [resultMarker, setResultMarker] = useState<ResultMarker>(null)
  const [expandedPane, setExpandedPane] = useState<ExpandedPane>(null)

  useEffect(() => {
    const nextData = cloneData(baselineData)
    setMergedData(nextData)
    setDecisions({})
    void editorRef.current?.updateData(nextData)
  }, [baselineData])

  useEffect(() => {
    return () => {
      if (flashTimerRef.current) {
        window.clearTimeout(flashTimerRef.current)
      }
    }
  }, [])

  const flashResult = (
    rowKey: string | null,
    nextDecisions: Record<string, MergeDecision>,
    label: string,
    tone: "blue" | "rose" | "emerald",
    targetText: string | null,
    targetTextRange: ResultTextRange = null,
  ) => {
    if (flashTimerRef.current) {
      window.clearTimeout(flashTimerRef.current)
    }

    const requestId = flashRequestRef.current + 1
    flashRequestRef.current = requestId

    requestAnimationFrame(() => {
      if (flashRequestRef.current !== requestId) return

      const shell = resultEditorShellRef.current
      const blockIndex = findResultBlockIndex(rows, nextDecisions, rowKey)
      if (!shell || blockIndex === null) return

      const blocks = Array.from(
        shell.querySelectorAll<HTMLElement>(".ce-block"),
      )
      const targetBlock =
        blocks[blockIndex] ?? blocks[blocks.length - 1] ?? null
      if (!targetBlock) return

      const textRange =
        findTextRangeByOffsets(targetBlock, targetTextRange, targetText) ??
        findTextRange(targetBlock, targetText)
      const rects = getRangeRects(textRange, targetBlock, shell, !targetText)
      if (!rects.length) return

      setResultMarker({
        id: Date.now(),
        label,
        tone,
        rects,
      })

      flashTimerRef.current = window.setTimeout(() => {
        if (flashRequestRef.current !== requestId) return
        setResultMarker(null)
        flashTimerRef.current = null
      }, 1100)
    })
  }

  const applyWholeDocument = async (side: "left" | "right") => {
    const nextDecisions = buildAllDecisions(rows, side)
    const nextData = buildMergedDataFromDecisions(rows, nextDecisions)
    setDecisions(nextDecisions)
    setMergedData(nextData)
    await editorRef.current?.updateData(nextData)
    flashResult(
      null,
      nextDecisions,
      side === "left" ? "왼쪽 전체 반영" : "오른쪽 전체 반영",
      side === "left" ? "rose" : "emerald",
      null,
    )
  }

  const handleWholeToggle = async (row: MergeRow, side: "left" | "right") => {
    const key = decisionKey(row, null)
    const currentDecision = decisions[key] ?? null
    const nextDecision = currentDecision === side ? null : side

    setDecisions((prev) => {
      const next = { ...prev }
      if (nextDecision) {
        next[key] = nextDecision
      } else {
        delete next[key]
      }
      return next
    })

    const nextDecisions = { ...decisions }
    if (nextDecision) {
      nextDecisions[key] = nextDecision
    } else {
      delete nextDecisions[key]
    }

    const nextData = buildMergedDataFromDecisions(rows, nextDecisions)
    setMergedData(nextData)
    await editorRef.current?.updateData(nextData)

    if (!nextDecision) {
      flashRequestRef.current += 1
      setResultMarker(null)
      return
    }

    flashResult(
      row.key,
      nextDecisions,
      nextDecision === "left" ? "왼쪽 블록 반영" : "오른쪽 블록 반영",
      nextDecision === "left" ? "rose" : "emerald",
      getVisibleBlockText(
        nextDecision === "left" ? row.leftBlock : row.rightBlock,
      ),
    )
  }

  const handleRegionToggle = async (
    row: MergeRow,
    side: "left" | "right",
    regionIndex: number,
  ) => {
    const key = decisionKey(row, regionIndex)
    const currentDecision = decisions[key] ?? null
    const nextDecision = currentDecision === side ? null : side

    setDecisions((prev) => {
      const next = { ...prev }
      if (nextDecision) {
        next[key] = nextDecision
      } else {
        delete next[key]
      }
      return next
    })

    const nextDecisions = { ...decisions }
    if (nextDecision) {
      nextDecisions[key] = nextDecision
    } else {
      delete nextDecisions[key]
    }

    const nextData = buildMergedDataFromDecisions(rows, nextDecisions)
    setMergedData(nextData)
    await editorRef.current?.updateData(nextData)

    if (!nextDecision) {
      flashRequestRef.current += 1
      setResultMarker(null)
      return
    }

    flashResult(
      row.key,
      nextDecisions,
      nextDecision === "left" ? "왼쪽 문구 반영" : "오른쪽 문구 반영",
      nextDecision === "left" ? "rose" : "emerald",
      getChangedSegmentText(row, regionIndex, nextDecision),
      getChangedSegmentRange(row, regionIndex, nextDecisions),
    )
  }

  const handleSave = async () => {
    const latestData = (await editorRef.current?.saveData()) ?? mergedData
    onSave(latestData)
  }

  const openExpandedPane = async (pane: Exclude<ExpandedPane, null>) => {
    if (pane === "result") {
      const latestData = await editorRef.current?.saveData()
      if (latestData) {
        setMergedData(latestData)
      }
    }

    setExpandedPane(pane)
  }

  const closeExpandedPane = async () => {
    if (expandedPane === "result") {
      const latestData = await editorRef.current?.saveData()
      if (latestData) {
        setMergedData(latestData)
      }
    }

    setExpandedPane(null)
  }

  const expandedTitle =
    expandedPane === "left"
      ? baseLabel
      : expandedPane === "right"
        ? targetLabel
        : "병합 결과"

  return (
    <div
      className={cn("flex h-full min-h-0 min-w-0 flex-col bg-white", className)}
    >
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <GitMerge className="h-4 w-4" />
            {title}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            좌우 차이를 누르면 가운데 결과에 바로 반영됩니다.
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-full border border-slate-200 bg-white p-1 shadow-sm">
            <button
              type="button"
              className="inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-semibold text-slate-600 transition hover:bg-rose-50 hover:text-rose-700"
              onClick={() => applyWholeDocument("left")}
            >
              <ChevronsLeft className="h-3.5 w-3.5" />
              왼쪽 전체
            </button>
            <button
              type="button"
              className="inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-semibold text-slate-600 transition hover:bg-emerald-50 hover:text-emerald-700"
              onClick={() => applyWholeDocument("right")}
            >
              오른쪽 전체
              <ChevronsRight className="h-3.5 w-3.5" />
            </button>
          </div>
          <Button size="sm" variant="outline" onClick={onCancel}>
            <X className="h-4 w-4" />
            종료
          </Button>
          <Button size="sm" onClick={handleSave}>
            <Check className="h-4 w-4" />
            적용
          </Button>
        </div>
      </div>

      <div className="grid min-h-0 min-w-0 flex-1 grid-cols-[minmax(0,1fr)_minmax(0,1.08fr)_minmax(0,1fr)]">
        <PreviewPane
          label={baseLabel}
          subtitle="기존 문서"
          side="left"
          showDiff
          rows={rows}
          decisions={decisions}
          onExpand={() => void openExpandedPane("left")}
          onSelectWhole={(row) => void handleWholeToggle(row, "left")}
          onSelectRegion={(row, _side, regionIndex) =>
            void handleRegionToggle(row, "left", regionIndex)
          }
        />

        <div className="min-h-0 min-w-0 border-x border-slate-200 bg-white">
          <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-slate-900">
                병합 결과
              </div>
              <div className="mt-1 text-xs text-slate-500">
                공통 기반 위에 선택한 차이가 반영됩니다.
              </div>
            </div>
            <button
              type="button"
              className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
              onClick={() => void openExpandedPane("result")}
            >
              <Maximize2 className="h-3.5 w-3.5" />
              크게 보기
            </button>
          </div>
          <div
            ref={expandedPane === "result" ? undefined : resultEditorShellRef}
            className="relative h-full min-h-0 overflow-auto"
          >
            {resultMarker ? (
              <div className="pointer-events-none absolute inset-0 z-20">
                {resultMarker.rects.map((rect, index) => (
                  <div
                    key={`${resultMarker.id}-${index}`}
                    className={cn(
                      "absolute rounded-md ring-2 transition-opacity duration-150",
                      resultMarker.tone === "rose"
                        ? "bg-rose-400/20 ring-rose-300/80"
                        : resultMarker.tone === "emerald"
                          ? "bg-emerald-400/20 ring-emerald-300/80"
                          : "bg-blue-400/20 ring-blue-300/80",
                    )}
                    style={{
                      top: rect.top,
                      left: rect.left,
                      width: rect.width,
                      height: rect.height,
                    }}
                  />
                ))}
                <div
                  className={cn(
                    "absolute rounded-full px-2.5 py-1 text-[11px] font-semibold shadow-lg",
                    resultMarker.tone === "rose"
                      ? "bg-rose-600 text-white"
                      : resultMarker.tone === "emerald"
                        ? "bg-emerald-600 text-white"
                        : "bg-blue-600 text-white",
                  )}
                  style={{
                    top: Math.max(8, resultMarker.rects[0].top - 28),
                    left: Math.max(8, resultMarker.rects[0].left),
                  }}
                >
                  {resultMarker.label}
                </div>
              </div>
            ) : null}
            <div className="h-full w-full px-6 py-6">
              <div className="merge-result-editor-frame h-full w-full">
                {expandedPane === "result" ? (
                  <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-sm font-medium text-slate-500">
                    크게 보기에서 병합 결과를 편집 중입니다.
                  </div>
                ) : (
                  <DocumentEditor
                    ref={editorRef}
                    key="merge-result-editor"
                    isEditable={true}
                    documentId={documentId}
                    initialData={mergedData}
                    onDataChange={setMergedData}
                    disableAutoUpdate={true}
                    minimalChrome={true}
                    contentLayout="full"
                  />
                )}
              </div>
              <style>{`
                .merge-result-editor-frame .ce-block__content {
                  max-width: none !important;
                  margin: 0 !important;
                }

                .merge-result-editor-frame .codex-editor,
                .merge-result-editor-frame .codex-editor__redactor {
                  width: 100% !important;
                }
              `}</style>
            </div>
          </div>
        </div>

        <PreviewPane
          label={targetLabel}
          subtitle="변경된 문서"
          side="right"
          showDiff
          rows={rows}
          decisions={decisions}
          onExpand={() => void openExpandedPane("right")}
          onSelectWhole={(row) => void handleWholeToggle(row, "right")}
          onSelectRegion={(row, _side, regionIndex) =>
            void handleRegionToggle(row, "right", regionIndex)
          }
        />
      </div>
      {expandedPane ? (
        <div className="fixed inset-0 z-[80] bg-slate-950/45 p-5 backdrop-blur-sm">
          <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-[28px] border border-white/70 bg-white shadow-[0_30px_90px_rgba(15,23,42,0.35)]">
            <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-6 py-4">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-slate-950">
                  {expandedTitle}
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  {expandedPane === "result"
                    ? "실제 문서 폭으로 병합 결과를 편집합니다."
                    : "원본 문서를 실제 문서 폭으로 확인합니다."}
                </div>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => void closeExpandedPane()}
              >
                <X className="h-4 w-4" />
                닫기
              </Button>
            </div>

            <div
              ref={expandedPane === "result" ? resultEditorShellRef : undefined}
              className="min-h-0 flex-1 overflow-auto bg-slate-50"
            >
              {expandedPane === "left" ? (
                <ExpandedReadOnlyDocument rows={rows} side="left" />
              ) : expandedPane === "right" ? (
                <ExpandedReadOnlyDocument rows={rows} side="right" />
              ) : (
                <div className="mx-auto min-h-[calc(100vh-128px)] w-full max-w-[980px] bg-white px-10 py-10 shadow-[0_16px_50px_rgba(15,23,42,0.08)]">
                  <DocumentEditor
                    ref={editorRef}
                    key="merge-result-expanded-editor"
                    isEditable={true}
                    documentId={documentId}
                    initialData={mergedData}
                    onDataChange={setMergedData}
                    disableAutoUpdate={true}
                    minimalChrome={true}
                    contentLayout="document"
                    fillHeight={false}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
