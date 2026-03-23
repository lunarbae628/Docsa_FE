import type { OutputData } from "@editorjs/editorjs"
import { diff_match_patch } from "diff-match-patch"

export interface EditorBlock {
  id: string
  type: string
  data: Record<string, unknown>
}

export interface BlockDiff {
  type: "added" | "deleted" | "modified" | "unchanged"
  oldBlock?: EditorBlock
  newBlock?: EditorBlock
  block?: EditorBlock
  diffs?: [number, string][]
  index: number
}

// 블록을 텍스트로 변환하는 함수
export function blockToText(block: EditorBlock): string {
  if (!block || !block.data) return ""

  switch (block.type) {
    case "paragraph":
      return (block.data.text as string) || ""
    case "header":
      return `${"#".repeat((block.data.level as number) || 1)} ${(block.data.text as string) || ""}`
    case "list": {
      const items = block.data.items as any[]
      return (
        items
          ?.map((item: any, index: number) => {
            // item이 객체인 경우 content 속성을 찾거나 문자열로 변환
            let itemText = ""
            if (typeof item === "string") {
              itemText = item
            } else if (item && typeof item === "object") {
              // content, text, value 등의 속성에서 텍스트 찾기
              itemText =
                item.content || item.text || item.value || JSON.stringify(item)
            } else {
              itemText = String(item)
            }

            return block.data.style === "ordered"
              ? `${index + 1}. ${itemText}`
              : `• ${itemText}`
          })
          .join("\n") || ""
      )
    }
    case "quote":
      return `> ${(block.data.text as string) || ""}`
    case "code":
      return `\`\`\`\n${(block.data.code as string) || ""}\n\`\`\``
    case "delimiter":
      return "---"
    case "image":
      return `![${(block.data.caption as string) || "Image"}](${(block.data.file as { url?: string })?.url || ""})`
    default:
      return JSON.stringify(block.data)
  }
}

// OutputData를 텍스트로 변환하는 함수
export function outputDataToText(data: OutputData): string {
  if (!data || !data.blocks) return ""

  return data.blocks
    .map((block) => blockToText(block as EditorBlock))
    .join("\n\n")
}

// 블록 레벨에서 diff 계산
export function calculateBlockDiff(
  oldData: OutputData,
  newData: OutputData,
): BlockDiff[] {
  const dmp = new diff_match_patch()
  const results: BlockDiff[] = []

  const oldBlocks = (oldData?.blocks as EditorBlock[]) || []
  const newBlocks = (newData?.blocks as EditorBlock[]) || []
  const maxLength = Math.max(oldBlocks.length, newBlocks.length)

  for (let i = 0; i < maxLength; i++) {
    const oldBlock = oldBlocks[i]
    const newBlock = newBlocks[i]

    if (!oldBlock && newBlock) {
      // 새로 추가된 블록
      results.push({
        type: "added",
        block: newBlock,
        index: i,
      })
    } else if (oldBlock && !newBlock) {
      // 삭제된 블록
      results.push({
        type: "deleted",
        block: oldBlock,
        index: i,
      })
    } else if (oldBlock && newBlock) {
      // 수정된 블록인지 확인
      const oldText = blockToText(oldBlock)
      const newText = blockToText(newBlock)

      if (oldText !== newText || oldBlock.type !== newBlock.type) {
        const diffs = dmp.diff_main(oldText, newText)
        dmp.diff_cleanupSemantic(diffs)
        results.push({
          type: "modified",
          oldBlock,
          newBlock,
          diffs: diffs as [number, string][],
          index: i,
        })
      } else {
        results.push({
          type: "unchanged",
          block: oldBlock,
          index: i,
        })
      }
    }
  }

  return results
}

function hasUniqueStableIds(blocks: EditorBlock[]): boolean {
  const ids = new Set<string>()

  for (const block of blocks) {
    if (!block?.id) return false
    if (ids.has(block.id)) return false
    ids.add(block.id)
  }

  return true
}

export function calculateBlockDiffById(
  oldData: OutputData,
  newData: OutputData,
): BlockDiff[] {
  const oldBlocks = (oldData?.blocks as EditorBlock[]) || []
  const newBlocks = (newData?.blocks as EditorBlock[]) || []

  if (!hasUniqueStableIds(oldBlocks) || !hasUniqueStableIds(newBlocks)) {
    return calculateBlockDiff(oldData, newData)
  }

  const dmp = new diff_match_patch()
  const results: BlockDiff[] = []
  const oldBlocksById = new Map(oldBlocks.map((block) => [block.id, block]))
  const seenOldBlockIds = new Set<string>()

  for (let i = 0; i < newBlocks.length; i++) {
    const newBlock = newBlocks[i]
    const oldBlock = oldBlocksById.get(newBlock.id)

    if (!oldBlock) {
      results.push({
        type: "added",
        block: newBlock,
        index: i,
      })
      continue
    }

    seenOldBlockIds.add(newBlock.id)

    const oldText = blockToText(oldBlock)
    const newText = blockToText(newBlock)

    if (oldText !== newText || oldBlock.type !== newBlock.type) {
      const diffs = dmp.diff_main(oldText, newText)
      dmp.diff_cleanupSemantic(diffs)
      results.push({
        type: "modified",
        oldBlock,
        newBlock,
        diffs: diffs as [number, string][],
        index: i,
      })
    } else {
      results.push({
        type: "unchanged",
        block: newBlock,
        index: i,
      })
    }
  }

  for (let i = 0; i < oldBlocks.length; i++) {
    const oldBlock = oldBlocks[i]

    if (!seenOldBlockIds.has(oldBlock.id)) {
      results.push({
        type: "deleted",
        block: oldBlock,
        index: i,
      })
    }
  }

  return results
}

// 전체 문서 diff 계산
export function calculateDocumentDiff(
  oldData: OutputData,
  newData: OutputData,
) {
  const dmp = new diff_match_patch()
  const oldText = outputDataToText(oldData)
  const newText = outputDataToText(newData)

  const diffs = dmp.diff_main(oldText, newText)
  dmp.diff_cleanupSemantic(diffs)

  return diffs
}

// diff 타입 상수
export const DIFF_DELETE = diff_match_patch.DIFF_DELETE
export const DIFF_INSERT = diff_match_patch.DIFF_INSERT
export const DIFF_EQUAL = diff_match_patch.DIFF_EQUAL
