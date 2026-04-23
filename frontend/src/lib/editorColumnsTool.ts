import Delimiter from "@editorjs/delimiter"
import EditorJS, { type OutputData } from "@editorjs/editorjs"
import Header from "@editorjs/header"
import ImageTool from "@editorjs/image"
import List from "@editorjs/list"
import Paragraph from "@editorjs/paragraph"
import { CodeWithLanguage } from "./editorCodeTool"
import { ResizeOnlyImageTune } from "./editorImageTune"
import { AlignedQuote } from "./editorQuoteTool"

type EditorBlock = OutputData["blocks"][number]

interface ColumnData {
  id?: string
  blocks?: EditorBlock[]
}

interface ColumnsToolData {
  columns?: ColumnData[]
  leftRatio?: number
}

interface ColumnsToolConfig {
  uploadImageByFile?: (file: File) => Promise<unknown>
  uploadImageByUrl?: (url: string) => Promise<unknown>
}

interface ColumnsToolConstructor {
  data?: ColumnsToolData
  config?: ColumnsToolConfig
  readOnly?: boolean
}

function createId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`
  }

  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`
}

function createParagraphBlock(text = ""): EditorBlock {
  return {
    id: createId("paragraph"),
    type: "paragraph",
    data: { text },
  }
}

function createOutputData(blocks?: EditorBlock[]): OutputData {
  return {
    time: Date.now(),
    version: "2.30.8",
    blocks: blocks?.length ? blocks : [createParagraphBlock()],
  }
}

function normalizeColumns(data?: ColumnsToolData): Required<ColumnData>[] {
  const columns = Array.isArray(data?.columns) ? data.columns : []
  const normalized = columns.slice(0, 2).map((column) => ({
    id: column.id || createId("column"),
    blocks: Array.isArray(column.blocks)
      ? column.blocks
      : [createParagraphBlock()],
  }))

  while (normalized.length < 2) {
    normalized.push({
      id: createId("column"),
      blocks: [createParagraphBlock()],
    })
  }

  return normalized
}

function normalizeLeftRatio(value: unknown) {
  const ratio = Number(value)

  if (!Number.isFinite(ratio)) {
    return 50
  }

  return Math.min(72, Math.max(28, ratio))
}

function createNestedTools(
  uploadImageByFile?: ColumnsToolConfig["uploadImageByFile"],
  uploadImageByUrl?: ColumnsToolConfig["uploadImageByUrl"],
) {
  return {
    header: {
      class: Header,
      inlineToolbar: false,
      config: {
        placeholder: "제목을 입력하세요",
        levels: [1, 2, 3, 4, 5, 6],
        defaultLevel: 3,
      },
    },
    list: {
      class: List,
      inlineToolbar: true,
      config: {
        defaultStyle: "unordered",
      },
    },
    quote: {
      class: AlignedQuote,
      inlineToolbar: true,
      config: {
        quotePlaceholder: "인용문을 입력하세요",
        captionPlaceholder: "인용문의 출처",
      },
    },
    code: {
      class: CodeWithLanguage,
      config: {
        placeholder: "코드를 입력하세요",
      },
    },
    delimiter: Delimiter,
    image: {
      class: ImageTool,
      inlineToolbar: true,
      tunes: ["imageResize"],
      config: {
        captionPlaceholder: "이미지 설명을 입력하세요",
        buttonContent: "이미지 업로드",
        features: {
          border: true,
          stretch: true,
          background: true,
          caption: true,
        },
        uploader: uploadImageByFile
          ? {
              uploadByFile: uploadImageByFile,
              uploadByUrl: uploadImageByUrl,
            }
          : undefined,
      },
    },
    imageResize: {
      class: ResizeOnlyImageTune,
      config: {
        resize: true,
        crop: false,
      },
    },
    paragraph: {
      class: Paragraph,
      inlineToolbar: true,
      config: {
        preserveBlank: true,
      },
    },
  }
}

export class ColumnsTool {
  private data: Required<ColumnData>[]
  private config: ColumnsToolConfig
  private readOnly: boolean
  private leftRatio: number
  private editors: Array<EditorJS | null> = []
  private holders: HTMLElement[] = []
  private destroyed = false

  constructor({ data, config, readOnly = false }: ColumnsToolConstructor) {
    this.data = normalizeColumns(data)
    this.config = config ?? {}
    this.readOnly = readOnly
    this.leftRatio = normalizeLeftRatio(data?.leftRatio)
  }

  static get toolbox() {
    return {
      title: "Columns",
      icon: '<svg width="17" height="15" viewBox="0 0 17 15" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="2" width="6" height="11" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.6"/><rect x="10" y="2" width="6" height="11" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>',
    }
  }

  static get isReadOnlySupported() {
    return true
  }

  static get sanitize() {
    return {
      columns: {},
      leftRatio: false,
    }
  }

  render() {
    this.destroyed = false
    const wrapper = document.createElement("div")
    wrapper.className = "columns-tool cdx-block"
    this.applyGridRatio(wrapper)

    this.holders = []

    this.data.forEach((column, index) => {
      const columnElement = document.createElement("div")
      columnElement.className = "columns-tool__column"
      columnElement.dataset.columnIndex = String(index)

      const holder = document.createElement("div")
      holder.className = "columns-tool__editor"
      holder.dataset.columnId = column.id

      columnElement.appendChild(holder)
      wrapper.appendChild(columnElement)

      this.holders.push(holder)

      if (index === 0) {
        const divider = document.createElement("div")
        divider.className = "columns-tool__divider"
        divider.setAttribute("role", "separator")
        divider.setAttribute("aria-orientation", "vertical")
        divider.setAttribute("aria-label", "컬럼 너비 조절")

        if (!this.readOnly) {
          divider.addEventListener("mousedown", (event) => {
            this.startResize(event, wrapper)
          })
        }

        wrapper.appendChild(divider)
      }
    })

    queueMicrotask(() => {
      this.mountEditors()
    })

    return wrapper
  }

  private applyGridRatio(wrapper: HTMLElement) {
    wrapper.style.setProperty("--columns-left-size", `${this.leftRatio}fr`)
    wrapper.style.setProperty(
      "--columns-right-size",
      `${100 - this.leftRatio}fr`,
    )
  }

  private startResize(event: MouseEvent, wrapper: HTMLElement) {
    event.preventDefault()

    const apply = (clientX: number) => {
      const rect = wrapper.getBoundingClientRect()
      const nextRatio = normalizeLeftRatio(
        ((clientX - rect.left) / rect.width) * 100,
      )

      this.leftRatio = nextRatio
      this.applyGridRatio(wrapper)
    }

    apply(event.clientX)
    document.body.classList.add("columns-tool-resizing")

    const handleMove = (moveEvent: MouseEvent) => {
      apply(moveEvent.clientX)
    }

    const handleUp = () => {
      document.body.classList.remove("columns-tool-resizing")
      window.removeEventListener("mousemove", handleMove)
      window.removeEventListener("mouseup", handleUp)
    }

    window.addEventListener("mousemove", handleMove)
    window.addEventListener("mouseup", handleUp)
  }

  private mountEditors() {
    if (this.destroyed || this.editors.length) {
      return
    }

    this.editors = this.holders.map((holder, index) => {
      const editor = new EditorJS({
        holder,
        readOnly: this.readOnly,
        minHeight: 0,
        data: createOutputData(this.data[index]?.blocks),
        placeholder: this.readOnly ? "" : "내용을 입력하세요...",
        tools: createNestedTools(
          this.config.uploadImageByFile,
          this.config.uploadImageByUrl,
        ),
        onChange: async () => {
          if (this.readOnly || this.destroyed) {
            return
          }

          await editor.isReady
          if (
            this.editors[index] !== editor ||
            typeof editor.save !== "function"
          ) {
            return
          }

          const output = await editor.save()
          this.data[index] = {
            ...this.data[index],
            blocks: output.blocks as EditorBlock[],
          }
        },
      })

      return editor
    })
  }

  async save(): Promise<ColumnsToolData> {
    const columns = await Promise.all(
      this.data.map(async (column, index) => {
        const editor = this.editors[index]

        if (!editor || this.destroyed || typeof editor.save !== "function") {
          return column
        }

        await editor.isReady
        const output = await editor.save()

        return {
          id: column.id,
          blocks: output.blocks as EditorBlock[],
        }
      }),
    )

    return { columns, leftRatio: this.leftRatio }
  }

  destroy() {
    this.destroyed = true
    for (const editor of this.editors) {
      try {
        editor?.destroy()
      } catch (error) {
        console.error("Error destroying columns editor:", error)
      }
    }
    this.editors = []
  }
}
