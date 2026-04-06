import { useEffect, useMemo, useRef, useState } from "react"
import type { OutputData } from "@editorjs/editorjs"
import { diff_match_patch } from "diff-match-patch"
import { Check, ChevronsLeft, ChevronsRight, GitMerge, X } from "lucide-react"
import DocumentEditor, { type DocumentEditorRef } from "./DocumentEditor"
import { Button } from "./ui/button"
import { cn } from "@/lib/utils"
import type { EditorBlock } from "@/lib/diffUtils"

interface DocumentMergeViewProps {
  baseData: OutputData
  targetData: OutputData
  onSave: (mergedData: OutputData) => void
  onCancel: () => void
  title?: string
  baseLabel?: string
  targetLabel?: string
  initialMergedData?: OutputData
  className?: string
}

type MergeRowStatus = "same" | "modified" | "deleted" | "added"
type MergeDecision = "left" | "right" | null

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
  | { type: "changed"; leftText: string; rightText: string; regionIndex: number }

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
    if (rightTokens.has(token)) {
      intersection += 1
    }
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

function buildMergeRows(baseData: OutputData, targetData: OutputData): MergeRow[] {
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

  diffs.forEach(([op, text]) => {
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

function isEditableTextBlock(block?: EditorBlock) {
  return Boolean(block && ["paragraph", "header", "quote", "code", "list"].includes(block.type))
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

function findClosestBlockIndex(currentBlocks: EditorBlock[], row: MergeRow) {
  const expectedIndex = row.rightIndex ?? row.leftIndex ?? currentBlocks.length
  const rightText = getVisibleBlockText(row.rightBlock)
  const leftText = getVisibleBlockText(row.leftBlock)

  let bestScore = Number.NEGATIVE_INFINITY
  let bestIndex = -1

  currentBlocks.forEach((block, index) => {
    const currentText = getVisibleBlockText(block)
    const similarity = Math.max(
      scoreTextSimilarity(currentText, rightText),
      scoreTextSimilarity(currentText, leftText) * 0.92,
    )
    const distancePenalty = Math.abs(index - expectedIndex) * 0.05
    const score = similarity - distancePenalty

    if (score > bestScore) {
      bestScore = score
      bestIndex = index
    }
  })

  return bestScore > 0.08 ? bestIndex : -1
}

function computeInsertIndex(currentBlocks: EditorBlock[], row: MergeRow) {
  const hint = row.rightIndex ?? row.leftIndex ?? currentBlocks.length
  return Math.max(0, Math.min(hint, currentBlocks.length))
}

function applyRegionText(
  currentText: string,
  leftText: string,
  rightText: string,
  regionIndex: number,
  side: "left" | "right",
) {
  const segments = buildDiffSegments(leftText, rightText)
  const segment = segments.find(
    (candidate) => candidate.type === "changed" && candidate.regionIndex === regionIndex,
  )

  if (!segment || segment.type !== "changed") {
    return currentText
  }

  const segmentIndex = segments.indexOf(segment)
  const prevContext =
    segmentIndex > 0 && segments[segmentIndex - 1]?.type === "equal"
      ? segments[segmentIndex - 1].text.slice(-20)
      : ""
  const nextContext =
    segmentIndex < segments.length - 1 && segments[segmentIndex + 1]?.type === "equal"
      ? segments[segmentIndex + 1].text.slice(0, 20)
      : ""

  const fromText = side === "left" ? segment.rightText : segment.leftText
  const toText = side === "left" ? segment.leftText : segment.rightText

  if (fromText && currentText.includes(fromText)) {
    return currentText.replace(fromText, toText)
  }

  if (!fromText && toText) {
    if (prevContext && currentText.includes(prevContext)) {
      const pivot = currentText.indexOf(prevContext) + prevContext.length
      return `${currentText.slice(0, pivot)}${toText}${currentText.slice(pivot)}`
    }

    if (nextContext && currentText.includes(nextContext)) {
      const pivot = currentText.indexOf(nextContext)
      return `${currentText.slice(0, pivot)}${toText}${currentText.slice(pivot)}`
    }

    return `${currentText}${toText}`
  }

  if (fromText && !toText) {
    return currentText.replace(fromText, "")
  }

  const dmp = new diff_match_patch()
  const [patched, applied] = dmp.patch_apply(
    dmp.patch_make(`${prevContext}${fromText}${nextContext}`, `${prevContext}${toText}${nextContext}`),
    currentText,
  )

  return applied.some(Boolean) ? (patched as string) : currentText
}

function decisionKey(row: MergeRow, regionIndex: number | null) {
  return `${row.key}:${regionIndex ?? "block"}`
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
  onSelectRegion: (row: MergeRow, side: "left" | "right", regionIndex: number) => void
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

  if (row.status === "same") {
    return (
      <div className={cn("whitespace-pre-wrap break-words font-sans", blockBodyClass(block))}>
        {blockText}
      </div>
    )
  }

  if (!compareBlock) {
    return (
      <button
        type="button"
        onClick={() => onSelectWhole(row, side)}
        className={cn(
          "w-full rounded-xl px-3 py-2 text-left transition",
          side === "left"
            ? isWholeSelected
              ? "bg-rose-200/90"
              : "bg-rose-100/80 hover:bg-rose-150"
            : isWholeSelected
              ? "bg-emerald-200/90"
              : "bg-emerald-100/80 hover:bg-emerald-150",
        )}
      >
        <div className={cn("whitespace-pre-wrap break-words font-sans", blockBodyClass(block))}>
          {blockText}
        </div>
      </button>
    )
  }

  const segments = buildDiffSegments(
    side === "left" ? blockText : compareText,
    side === "left" ? compareText : blockText,
  )

  return (
    <div className={cn("whitespace-pre-wrap break-words font-sans", blockBodyClass(block))}>
      {segments.map((segment, index) => {
        if (segment.type === "equal") {
          return <span key={`equal-${index}`}>{segment.text}</span>
        }

        const visibleText = side === "left" ? segment.leftText : segment.rightText
        if (!visibleText) {
          return null
        }

        const selected = decisions[decisionKey(row, segment.regionIndex)] === side

        return (
          <button
            key={`changed-${segment.regionIndex}`}
            type="button"
            onClick={() => onSelectRegion(row, side, segment.regionIndex)}
            className={cn(
              "inline rounded px-0.5 transition",
              side === "left"
                ? selected
                  ? "bg-rose-300 text-rose-900"
                  : "bg-rose-100/95 text-rose-700 hover:bg-rose-200"
                : selected
                  ? "bg-emerald-300 text-emerald-900"
                  : "bg-emerald-100/95 text-emerald-700 hover:bg-emerald-200",
            )}
          >
            {visibleText}
          </button>
        )
      })}
    </div>
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
  onSelectRegion: (row: MergeRow, side: "left" | "right", regionIndex: number) => void
}) {
  return (
    <div className="flex min-h-0 flex-col bg-white">
      <div className="border-b border-slate-200 px-5 py-4">
        <div className="text-sm font-semibold text-slate-900">{label}</div>
        <div className="mt-1 text-xs text-slate-500">{subtitle}</div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-6 py-6">
        <div className="mx-auto max-w-[860px]">
          {rows.map((row) => (
            <div key={`${side}-${row.key}`} className="border-b border-slate-100 py-4 last:border-b-0">
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
  initialMergedData,
  className,
}: DocumentMergeViewProps) {
  const editorRef = useRef<DocumentEditorRef>(null)
  const baselineData = useMemo(
    () => cloneData(initialMergedData ?? targetData),
    [initialMergedData, targetData],
  )
  const [mergedData, setMergedData] = useState<OutputData>(cloneData(baselineData))
  const [decisions, setDecisions] = useState<Record<string, MergeDecision>>({})

  useEffect(() => {
    setMergedData(cloneData(baselineData))
    setDecisions({})
  }, [baselineData])

  const rows = useMemo(() => buildMergeRows(baseData, targetData), [baseData, targetData])

  const applyWholeDocument = async (side: "left" | "right") => {
    const nextData = cloneData(side === "left" ? baseData : targetData)
    setMergedData(nextData)
    await editorRef.current?.updateData(nextData)
  }

  const applyWholeRow = async (row: MergeRow, side: "left" | "right") => {
    const sourceBlock = side === "left" ? row.leftBlock : row.rightBlock
    const currentData = (await editorRef.current?.saveData()) ?? mergedData
    const currentBlocks = cloneData((currentData.blocks as EditorBlock[]) ?? [])
    const matchIndex = findClosestBlockIndex(currentBlocks, row)

    if (sourceBlock) {
      if (matchIndex >= 0) {
        currentBlocks[matchIndex] = cloneData(sourceBlock)
      } else {
        currentBlocks.splice(computeInsertIndex(currentBlocks, row), 0, cloneData(sourceBlock))
      }
    } else if (matchIndex >= 0) {
      currentBlocks.splice(matchIndex, 1)
    }

    const nextData = createOutputData(currentBlocks)
    setMergedData(nextData)
    await editorRef.current?.updateData(nextData)
  }

  const restoreWholeRow = async (row: MergeRow) => {
    const baselineBlocks = cloneData((baselineData.blocks as EditorBlock[]) ?? [])
    const currentData = (await editorRef.current?.saveData()) ?? mergedData
    const currentBlocks = cloneData((currentData.blocks as EditorBlock[]) ?? [])
    const matchIndex = findClosestBlockIndex(currentBlocks, row)
    const baselineBlock =
      row.rightIndex !== null ? baselineBlocks[row.rightIndex] : undefined

    if (baselineBlock) {
      if (matchIndex >= 0) {
        currentBlocks[matchIndex] = cloneData(baselineBlock)
      } else {
        currentBlocks.splice(computeInsertIndex(currentBlocks, row), 0, cloneData(baselineBlock))
      }
    } else if (matchIndex >= 0) {
      currentBlocks.splice(matchIndex, 1)
    }

    const nextData = createOutputData(currentBlocks)
    setMergedData(nextData)
    await editorRef.current?.updateData(nextData)
  }

  const applyRegion = async (row: MergeRow, side: "left" | "right", regionIndex: number) => {
    if (!row.leftBlock || !row.rightBlock) {
      await applyWholeRow(row, side)
      return
    }

    const currentData = (await editorRef.current?.saveData()) ?? mergedData
    const currentBlocks = cloneData((currentData.blocks as EditorBlock[]) ?? [])
    const matchIndex = findClosestBlockIndex(currentBlocks, row)

    if (matchIndex < 0) {
      await applyWholeRow(row, side)
      return
    }

    const currentBlock = currentBlocks[matchIndex]
    if (
      !isEditableTextBlock(currentBlock) ||
      !isEditableTextBlock(row.leftBlock) ||
      !isEditableTextBlock(row.rightBlock)
    ) {
      await applyWholeRow(row, side)
      return
    }

    const currentText = getVisibleBlockText(currentBlock)
    const leftText = getVisibleBlockText(row.leftBlock)
    const rightText = getVisibleBlockText(row.rightBlock)
    const nextText = applyRegionText(currentText, leftText, rightText, regionIndex, side)

    currentBlocks[matchIndex] = setBlockText(currentBlock, nextText)
    const nextData = createOutputData(currentBlocks)
    setMergedData(nextData)
    await editorRef.current?.updateData(nextData)
  }

  const restoreRegion = async (row: MergeRow, regionIndex: number) => {
    if (!row.leftBlock || !row.rightBlock) {
      await restoreWholeRow(row)
      return
    }

    const currentData = (await editorRef.current?.saveData()) ?? mergedData
    const currentBlocks = cloneData((currentData.blocks as EditorBlock[]) ?? [])
    const matchIndex = findClosestBlockIndex(currentBlocks, row)

    if (matchIndex < 0) {
      await restoreWholeRow(row)
      return
    }

    const currentBlock = currentBlocks[matchIndex]
    if (
      !isEditableTextBlock(currentBlock) ||
      !isEditableTextBlock(row.leftBlock) ||
      !isEditableTextBlock(row.rightBlock)
    ) {
      await restoreWholeRow(row)
      return
    }

    const currentText = getVisibleBlockText(currentBlock)
    const leftText = getVisibleBlockText(row.leftBlock)
    const rightText = getVisibleBlockText(row.rightBlock)
    const nextText = applyRegionText(currentText, leftText, rightText, regionIndex, "right")

    currentBlocks[matchIndex] = setBlockText(currentBlock, nextText)
    const nextData = createOutputData(currentBlocks)
    setMergedData(nextData)
    await editorRef.current?.updateData(nextData)
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

    if (!nextDecision) {
      await restoreWholeRow(row)
      return
    }

    await applyWholeRow(row, nextDecision)
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

    if (!nextDecision) {
      await restoreRegion(row, regionIndex)
      return
    }

    await applyRegion(row, nextDecision, regionIndex)
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
            좌우 문서 안에서 색으로 표시된 차이를 직접 눌러 가운데 결과를 조립합니다. 같은 표시를 다시 누르면 기준 상태로 원복됩니다.
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => applyWholeDocument("left")}>
            <ChevronsLeft className="h-4 w-4" />
            왼쪽 모두 반영
          </Button>
          <Button size="sm" variant="outline" onClick={() => applyWholeDocument("right")}>
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
            <div className="text-sm font-semibold text-slate-900">병합 결과</div>
            <div className="mt-1 text-xs text-slate-500">
              공통 내용은 그대로 유지되고, 선택한 차이만 현재 문서에 반영됩니다.
            </div>
          </div>
          <div className="h-full min-h-0 overflow-auto">
            <DocumentEditor
              ref={editorRef}
              key="merge-result-editor"
              isEditable={true}
              initialData={mergedData}
              onDataChange={setMergedData}
              disableAutoUpdate={true}
              minimalChrome={true}
              contentLayout="document"
            />
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
