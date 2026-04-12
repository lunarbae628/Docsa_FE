import type { OutputData } from "@editorjs/editorjs"

type EditorBlock = OutputData["blocks"][number]

function escapeMarkdownText(text: string) {
  return text.replace(/\r\n/g, "\n").trim()
}

function normalizeInlineText(text: string | undefined) {
  if (!text) return ""

  return text
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\u00a0/g, " ")
}

function flattenListItems(items: any[], depth = 0): string[] {
  const lines: string[] = []

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index]

    if (typeof item === "string") {
      lines.push(`${"  ".repeat(depth)}${item}`)
      continue
    }

    if (item && typeof item === "object") {
      const content = normalizeInlineText(item.content ?? item.text ?? "")
      lines.push(`${"  ".repeat(depth)}${content}`)

      if (Array.isArray(item.items) && item.items.length > 0) {
        lines.push(...flattenListItems(item.items, depth + 1))
      }
    }
  }

  return lines
}

export function editorDataToMarkdown(data: OutputData): string {
  const sections = data.blocks
    .map((block: EditorBlock) => {
      switch (block.type) {
        case "header": {
          const level = Math.min(Math.max(block.data.level ?? 2, 1), 6)
          const text = normalizeInlineText(block.data.text)
          return `${"#".repeat(level)} ${text}`
        }
        case "paragraph": {
          return escapeMarkdownText(normalizeInlineText(block.data.text))
        }
        case "list": {
          const style = block.data.style === "ordered" ? "ordered" : "unordered"
          const items = Array.isArray(block.data.items) ? block.data.items : []

          return flattenListItems(items)
            .map((item, index) => {
              const indentMatch = item.match(/^(\s*)/)
              const indent = indentMatch?.[1] ?? ""
              const content = item.trim()
              const marker =
                style === "ordered" ? `${index + 1}.` : "-"
              return `${indent}${marker} ${content}`
            })
            .join("\n")
        }
        case "quote": {
          const quote = normalizeInlineText(block.data.text)
          return quote
            .split("\n")
            .filter(Boolean)
            .map((line) => `> ${line}`)
            .join("\n")
        }
        case "code": {
          const code = block.data.code ?? ""
          return ["```", code, "```"].join("\n")
        }
        case "delimiter":
          return "---"
        default: {
          if (block?.data?.text) {
            return escapeMarkdownText(normalizeInlineText(block.data.text))
          }
          return ""
        }
      }
    })
    .filter((section) => section.length > 0)

  return sections.join("\n\n")
}

function createBlock(
  type: string,
  data: Record<string, unknown>,
  index: number,
): EditorBlock {
  return {
    id: `${type}-${index}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    data,
  }
}

export function markdownToEditorData(markdown: string): OutputData {
  const normalized = markdown.replace(/\r\n/g, "\n").trim()

  if (!normalized) {
    return {
      time: Date.now(),
      version: "2.30.8",
      blocks: [createBlock("paragraph", { text: "" }, 0)],
    }
  }

  const lines = normalized.split("\n")
  const blocks: EditorBlock[] = []
  let index = 0

  while (index < lines.length) {
    const rawLine = lines[index]
    const line = rawLine.trimEnd()

    if (!line.trim()) {
      index += 1
      continue
    }

    const headerMatch = line.match(/^(#{1,6})\s+(.*)$/)
    if (headerMatch) {
      blocks.push(
        createBlock(
          "header",
          {
            level: headerMatch[1].length,
            text: headerMatch[2],
          },
          blocks.length,
        ),
      )
      index += 1
      continue
    }

    if (/^(```)/.test(line)) {
      const codeLines: string[] = []
      index += 1
      while (index < lines.length && !/^```/.test(lines[index].trim())) {
        codeLines.push(lines[index])
        index += 1
      }
      if (index < lines.length) index += 1
      blocks.push(
        createBlock("code", { code: codeLines.join("\n") }, blocks.length),
      )
      continue
    }

    if (/^(-{3,}|\*{3,})$/.test(line.trim())) {
      blocks.push(createBlock("delimiter", {}, blocks.length))
      index += 1
      continue
    }

    if (/^>\s?/.test(line)) {
      const quoteLines: string[] = []
      while (index < lines.length && /^>\s?/.test(lines[index].trim())) {
        quoteLines.push(lines[index].trim().replace(/^>\s?/, ""))
        index += 1
      }
      blocks.push(
        createBlock(
          "quote",
          { text: quoteLines.join("\n"), caption: "" },
          blocks.length,
        ),
      )
      continue
    }

    if (/^([-*+])\s+/.test(line) || /^\d+\.\s+/.test(line)) {
      const ordered = /^\d+\.\s+/.test(line)
      const items: string[] = []

      while (
        index < lines.length &&
        (new RegExp(ordered ? "^\\d+\\.\\s+" : "^[-*+]\\s+").test(
          lines[index].trim(),
        ) ||
          /^\s{2,}/.test(lines[index]))
      ) {
        const currentLine = lines[index]
        if (/^\s{2,}/.test(currentLine)) {
          const previous = items.pop() ?? ""
          items.push(`${previous}\n${currentLine.trim()}`)
        } else {
          items.push(currentLine.trim().replace(/^([-*+]|\d+\.)\s+/, ""))
        }
        index += 1
      }

      blocks.push(
        createBlock(
          "list",
          {
            style: ordered ? "ordered" : "unordered",
            items,
          },
          blocks.length,
        ),
      )
      continue
    }

    const paragraphLines: string[] = [line]
    index += 1

    while (index < lines.length) {
      const nextLine = lines[index]
      if (
        !nextLine.trim() ||
        /^(#{1,6})\s+/.test(nextLine) ||
        /^(```)/.test(nextLine.trim()) ||
        /^>\s?/.test(nextLine.trim()) ||
        /^(-{3,}|\*{3,})$/.test(nextLine.trim()) ||
        /^([-*+]|\d+\.)\s+/.test(nextLine.trim())
      ) {
        break
      }
      paragraphLines.push(nextLine)
      index += 1
    }

    blocks.push(
      createBlock(
        "paragraph",
        { text: paragraphLines.join("<br>") },
        blocks.length,
      ),
    )
  }

  return {
    time: Date.now(),
    version: "2.30.8",
    blocks,
  }
}
