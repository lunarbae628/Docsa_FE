import type { EditorBlock } from "@/lib/diffUtils"
import { cn } from "@/lib/utils"
import type { OutputData } from "@editorjs/editorjs"
import { diff_match_patch } from "diff-match-patch"
import { Check, ChevronsLeft, ChevronsRight, GitMerge, X } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import DocumentEditor, { type DocumentEditorRef } from "./DocumentEditor"
import EditorBlockPreview, {
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
  className?: string
}

type MergeRowStatus = "same" | "modified" | "deleted" | "added"
type MergeDecision = "left" | "right" | null
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
      const leftText = getVisibleBlockText(leftBlock)
      const rightText = getVisibleBlockText(rightBlock)

      rows.push({
        key: `pair-${i}-${j}`,
        leftBlock,
        rightBlock,
        leftIndex: i,
        rightIndex: j,
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
  dmp.diff_cleanupSemantic(diffs)

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
    case "list": {
      const lines = text
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
      const ordered = lines.every((line) => /^\d+\.\s+/.test(line))
      nextBlock.data.style = ordered ? "ordered" : "unordered"
      nextBlock.data.items = lines.map((line) =>
        line.replace(/^(\d+\.|[-*•])\s+/, ""),
      )
      return nextBlock
    }
    default:
      return nextBlock
  }
}

function decisionKey(row: MergeRow, regionIndex: number | null) {
  return `${row.key}:${regionIndex ?? "block"}`
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

  if (
    !row.leftBlock ||
    !row.rightBlock ||
    !isEditableTextBlock(row.leftBlock) ||
    !isEditableTextBlock(row.rightBlock)
  ) {
    return null
  }

  const leftText = getVisibleBlockText(row.leftBlock)
  const rightText = getVisibleBlockText(row.rightBlock)
  const segments = buildDiffSegments(leftText, rightText)
  const nextText = segments
    .map((segment) => {
      if (segment.type === "equal") return segment.text

      const decision = decisions[decisionKey(row, segment.regionIndex)]
      if (decision === "left") return segment.leftText
      if (decision === "right") return segment.rightText

      return ""
    })
    .join("")

  if (!nextText.replace(/\s+/g, "")) {
    return null
  }

  return setBlockText(row.rightBlock, nextText)
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
  decisions,
  onSelectWhole,
  onSelectRegion,
}: {
  row: MergeRow
  side: "left" | "right"
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
  const wholeDecision = decisions[decisionKey(row, null)] ?? null
  const isWholeSelected = wholeDecision === side

  const segments =
    row.status !== "same" && compareBlock
      ? (buildDiffSegments(
          side === "left" ? blockText : compareText,
          side === "left" ? compareText : blockText,
        ) as PreviewDiffSegment[])
      : undefined

  return (
    <EditorBlockPreview
      block={block}
      side={side}
      status={row.status}
      segments={segments}
      isWholeSelected={isWholeSelected}
      isRegionSelected={(regionIndex) =>
        decisions[decisionKey(row, regionIndex)] === side
      }
      onSelectWhole={
        row.status !== "same" ? () => onSelectWhole(row, side) : undefined
      }
      onSelectRegion={(regionIndex) => onSelectRegion(row, side, regionIndex)}
    />
  )
}

function PreviewPane({
  label,
  subtitle,
  side,
  rows,
  decisions,
  onSelectWhole,
  onSelectRegion,
}: {
  label: string
  subtitle: string
  side: "left" | "right"
  rows: MergeRow[]
  decisions: Record<string, MergeDecision>
  onSelectWhole: (row: MergeRow, side: "left" | "right") => void
  onSelectRegion: (
    row: MergeRow,
    side: "left" | "right",
    regionIndex: number,
  ) => void
}) {
  return (
    <div className="flex min-h-0 flex-col bg-white">
      <div className="border-b border-slate-200 px-5 py-4">
        <div className="text-sm font-semibold text-slate-900">{label}</div>
        <div className="mt-1 text-xs text-slate-500">{subtitle}</div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-6 py-6">
        <div className="w-full">
          {rows.map((row) => (
            <div key={`${side}-${row.key}`} className="py-4">
              <PaneBlock
                row={row}
                side={side}
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

export default function DocumentMergeView({
  baseData,
  targetData,
  onSave,
  onCancel,
  title = "기록 병합",
  baseLabel = "병합 원본",
  targetLabel = "병합 대상",
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

  return (
    <div className={cn("flex h-full min-h-0 flex-col bg-white", className)}>
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
          <Button
            size="sm"
            variant="outline"
            onClick={() => applyWholeDocument("left")}
          >
            <ChevronsLeft className="h-4 w-4" />
            왼쪽 모두 반영
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => applyWholeDocument("right")}
          >
            오른쪽 모두 반영
            <ChevronsRight className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="outline" onClick={onCancel}>
            <X className="h-4 w-4" />
            병합 종료
          </Button>
          <Button size="sm" onClick={handleSave}>
            <Check className="h-4 w-4" />
            병합 적용
          </Button>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_minmax(0,1.08fr)_minmax(0,1fr)]">
        <PreviewPane
          label={baseLabel}
          subtitle="기존 문서"
          side="left"
          rows={rows}
          decisions={decisions}
          onSelectWhole={(row) => void handleWholeToggle(row, "left")}
          onSelectRegion={(row, _side, regionIndex) =>
            void handleRegionToggle(row, "left", regionIndex)
          }
        />

        <div className="min-h-0 border-x border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-5 py-4">
            <div className="text-sm font-semibold text-slate-900">
              병합 결과
            </div>
            <div className="mt-1 text-xs text-slate-500">
              공통 기반 위에 선택한 차이가 반영됩니다.
            </div>
          </div>
          <div
            ref={resultEditorShellRef}
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
                <DocumentEditor
                  ref={editorRef}
                  key="merge-result-editor"
                  isEditable={true}
                  initialData={mergedData}
                  onDataChange={setMergedData}
                  disableAutoUpdate={true}
                  minimalChrome={true}
                  contentLayout="full"
                />
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
          rows={rows}
          decisions={decisions}
          onSelectWhole={(row) => void handleWholeToggle(row, "right")}
          onSelectRegion={(row, _side, regionIndex) =>
            void handleRegionToggle(row, "right", regionIndex)
          }
        />
      </div>
    </div>
  )
}
