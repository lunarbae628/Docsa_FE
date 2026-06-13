import { apiClient } from "@/api/apiClient"
import { CodeWithLanguage } from "@/lib/editorCodeTool"
import { ColumnsTool } from "@/lib/editorColumnsTool"
import { ResizeOnlyImageTune } from "@/lib/editorImageTune"
import {
  editorDataToMarkdown,
  markdownToEditorData,
} from "@/lib/editorMarkdown"
import { AlignedQuote } from "@/lib/editorQuoteTool"
import { alertDialog } from "@/lib/utils"
import Delimiter from "@editorjs/delimiter"
import EditorJS, { type OutputData } from "@editorjs/editorjs"
import Header from "@editorjs/header"
import ImageTool from "@editorjs/image"
import List from "@editorjs/list"
import Paragraph from "@editorjs/paragraph"
import "editorjs-image-resize-crop/dist/index.css"
import {
  type KeyboardEvent,
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react"

interface DocumentEditorProps {
  isEditable: boolean
  initialData?: OutputData
  onDataChange?: (data: OutputData) => void
  onFocus?: () => void
  onBlur?: () => void
  documentId?: number
  shouldUpdateOnChange?: boolean // 포커스 상태에 따라 onChange 실행 제어
  disableAutoUpdate?: boolean // initialData 변경 시 자동 업데이트 비활성화
  enableMarkdownShortcuts?: boolean
  minimalChrome?: boolean
  contentLayout?: "full" | "document"
  fillHeight?: boolean
}

export interface DocumentEditorRef {
  saveData: () => Promise<OutputData | null>
  updateData: (data: OutputData) => Promise<void>
}

function createOutputData(blocks: OutputData["blocks"]): OutputData {
  return {
    time: Date.now(),
    version: "2.30.8",
    blocks,
  }
}

const IMAGE_RESIZE_TUNE_KEYS = ["resize", "resizeSize"] as const

function parseFiniteNumber(value: unknown) {
  const numberValue =
    typeof value === "string" ? Number.parseFloat(value) : Number(value)

  return Number.isFinite(numberValue) ? numberValue : null
}

function sanitizeImageResizeTune(value: unknown) {
  if (!value || typeof value !== "object") {
    return undefined
  }

  const source = value as Record<string, unknown>
  const sanitized: Record<string, boolean | number> = {}

  for (const key of IMAGE_RESIZE_TUNE_KEYS) {
    if (!(key in source)) {
      continue
    }

    if (key === "resize") {
      sanitized[key] = source[key] === true || source[key] === "true"
      continue
    }

    const numberValue = parseFiniteNumber(source[key])
    if (numberValue !== null) {
      sanitized[key] = numberValue
    }
  }

  return Object.keys(sanitized).length ? sanitized : undefined
}

function sanitizeBlockTunes(tunes: unknown) {
  if (!tunes || typeof tunes !== "object") {
    return undefined
  }

  const source = tunes as Record<string, unknown>
  const sanitized: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(source)) {
    if (key === "imageResize" || key === "imageTune") {
      const imageResizeTune = sanitizeImageResizeTune(value)
      if (imageResizeTune) {
        sanitized[key] = imageResizeTune
      }
      continue
    }

    sanitized[key] = value
  }

  return Object.keys(sanitized).length ? sanitized : undefined
}

function sanitizeEditorOutputData(data: OutputData): OutputData {
  return {
    ...data,
    blocks: compactRepeatedEmptyParagraphBlocks(
      data.blocks.map((block) => sanitizeEditorBlock(block)),
    ),
  }
}

function sanitizeEditorBlock(block: OutputData["blocks"][number]) {
  const sanitizedData =
    block.type === "columns" ? sanitizeColumnsData(block.data) : block.data

  const nextBlock = {
    ...block,
    data: sanitizedData,
  }

  if (block.type === "columns") {
    return nextBlock
  }

  const blockWithTunes = block as typeof block & {
    tunes?: Record<string, unknown>
  }
  const sanitizedTunes = sanitizeBlockTunes(blockWithTunes.tunes)

  if (!sanitizedTunes) {
    const { tunes: _tunes, ...blockWithoutTunes } =
      nextBlock as typeof nextBlock & {
        tunes?: Record<string, unknown>
      }
    return blockWithoutTunes
  }

  return {
    ...nextBlock,
    tunes: sanitizedTunes,
  }
}

function sanitizeColumnsData(data: Record<string, unknown>) {
  const columns = Array.isArray(data.columns) ? data.columns : []
  const leftRatio = Number(data.leftRatio)
  const sanitizedLeftRatio = Number.isFinite(leftRatio)
    ? Math.min(72, Math.max(28, leftRatio))
    : undefined
  const { leftRatio: _leftRatio, ...restData } = data

  return {
    ...restData,
    ...(sanitizedLeftRatio ? { leftRatio: sanitizedLeftRatio } : {}),
    columns: columns.slice(0, 2).map((column) => {
      const columnData =
        column && typeof column === "object"
          ? (column as { id?: unknown; blocks?: unknown })
          : {}
      const blocks = Array.isArray(columnData.blocks)
        ? columnData.blocks.map((block) =>
            sanitizeEditorBlock(block as OutputData["blocks"][number]),
          )
        : []

      return {
        id: typeof columnData.id === "string" ? columnData.id : undefined,
        blocks,
      }
    }),
  }
}

function getDataSignature(data: OutputData | undefined) {
  if (!data) return ""
  return getBlocksSignature(sanitizeEditorOutputData(data).blocks)
}

function getBlocksSignature(blocks: OutputData["blocks"]) {
  return JSON.stringify(blocks ?? [])
}

function destroyEditor(editor: EditorJS) {
  editor.isReady
    .then(() => {
      editor.destroy()
    })
    .catch((error) => {
      console.error("Error destroying editor:", error)
    })
}

function isEmptyParagraphBlock(block: OutputData["blocks"][number]) {
  if (block.type !== "paragraph") {
    return false
  }

  const text =
    block.data && typeof block.data === "object"
      ? String((block.data as { text?: unknown }).text ?? "")
      : ""

  return text.replace(/<br\s*\/?>/gi, "").trim() === ""
}

function compactRepeatedEmptyParagraphBlocks(blocks: OutputData["blocks"]) {
  let emptyParagraphStreak = 0

  return blocks.filter((block) => {
    if (!isEmptyParagraphBlock(block)) {
      emptyParagraphStreak = 0
      return true
    }

    emptyParagraphStreak += 1
    return emptyParagraphStreak <= 2
  })
}

function getEditableParagraphTarget(target: EventTarget | null) {
  const node = target instanceof Node ? target : null
  const element =
    node instanceof HTMLElement ? node : (node?.parentElement ?? null)

  return element?.closest<HTMLElement>('.ce-paragraph[contenteditable="true"]')
}

function isCaretAtEndOfElement(element: HTMLElement) {
  const selection = window.getSelection()

  if (!selection || selection.rangeCount === 0) {
    return true
  }

  const range = selection.getRangeAt(0)

  if (!range.collapsed) {
    return false
  }

  if (!element.contains(range.endContainer)) {
    return document.activeElement === element
  }

  const afterCaretRange = range.cloneRange()
  afterCaretRange.selectNodeContents(element)
  afterCaretRange.setStart(range.endContainer, range.endOffset)

  return afterCaretRange.toString() === ""
}

function refreshToolbarPosition(editor: EditorJS, blockIndex?: number) {
  editor.toolbar.close()

  const openToolbar = () => {
    if (typeof blockIndex === "number") {
      editor.caret.setToBlock(blockIndex, "start")
    }

    editor.toolbar.open()
  }

  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(openToolbar)
  })
}

function openEditorToolbox(editor: EditorJS) {
  window.requestAnimationFrame(() => {
    editor.toolbar.open()
    ;(
      editor.toolbar as EditorJS["toolbar"] & {
        toggleToolbox?: (openingState?: boolean) => void
      }
    ).toggleToolbox?.(true)
  })
}

function isMarkdownShortcutCandidate(text: string) {
  const normalized = text.replace(/<br\s*\/?>/gi, "\n").trim()

  return (
    /^(#{1,6})\s+/.test(normalized) ||
    /^([-*+]|\d+\.)\s+/.test(normalized) ||
    /^>\s?/.test(normalized) ||
    /^(-{3,}|\*{3,})$/.test(normalized) ||
    /^```/.test(normalized)
  )
}

function getImageFileExtension(contentType: string) {
  switch (contentType.toLowerCase()) {
    case "image/jpeg":
      return "jpg"
    case "image/png":
      return "png"
    case "image/gif":
      return "gif"
    case "image/webp":
      return "webp"
    case "image/svg+xml":
      return "svg"
    default:
      return "bin"
  }
}

function normalizeUploadImageFile(file: File) {
  const contentType = file.type || "image/png"
  const fileName =
    file.name ||
    `pasted-image-${Date.now()}.${getImageFileExtension(contentType)}`

  if (file.name && file.type) {
    return file
  }

  return new File([file], fileName, {
    type: contentType,
    lastModified: file.lastModified || Date.now(),
  })
}

async function createImageFileFromUrl(url: string) {
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error("붙여넣은 이미지를 불러오지 못했습니다.")
  }

  const blob = await response.blob()
  const contentType = blob.type || "image/png"
  const urlFileName = url.startsWith("data:")
    ? ""
    : decodeURIComponent(
        new URL(url, window.location.href).pathname.split("/").pop() || "",
      )
  const fileName =
    urlFileName ||
    `pasted-image-${Date.now()}.${getImageFileExtension(contentType)}`

  return new File([blob], fileName, {
    type: contentType,
    lastModified: Date.now(),
  })
}

const DocumentEditor = forwardRef<DocumentEditorRef, DocumentEditorProps>(
  (
    {
      isEditable,
      initialData,
      onDataChange,
      onFocus,
      onBlur,
      documentId,
      shouldUpdateOnChange = true,
      disableAutoUpdate = false,
      enableMarkdownShortcuts = false,
      minimalChrome = false,
      contentLayout = "full",
      fillHeight = true,
    },
    ref,
  ) => {
    const editorRef = useRef<EditorJS | null>(null)
    const containerRef = useRef<HTMLDivElement>(null)
    const [isReady, setIsReady] = useState(false)
    const shouldUpdateOnChangeRef = useRef(shouldUpdateOnChange)
    const isApplyingShortcutRef = useRef(false)
    const lastRenderedDataSignatureRef = useRef("")
    const lastEnterEventRef = useRef<{
      time: number
    } | null>(null)

    const uploadImageByFile = useCallback(
      async (file: File) => {
        if (!documentId) {
          await alertDialog(
            "문서 정보를 확인한 뒤 이미지를 다시 업로드해주세요.",
            "이미지 업로드 실패",
            "destructive",
          )
          return { success: 0 }
        }

        try {
          const uploadFile = normalizeUploadImageFile(file)
          const uploaded = await apiClient.image.uploadEditorImage({
            docId: documentId,
            file: uploadFile,
          })

          return {
            success: 1,
            file: {
              url: uploaded.imageUrl,
              imageId: uploaded.imageId,
              objectKey: uploaded.objectKey,
              contentType: uploaded.contentType,
              size: uploaded.size,
              name: uploadFile.name,
            },
          }
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : "이미지 업로드에 실패했습니다."
          await alertDialog(message, "이미지 업로드 실패", "destructive")
          return { success: 0 }
        }
      },
      [documentId],
    )

    const uploadImageByUrl = useCallback(
      async (url: string) => {
        try {
          const file = await createImageFileFromUrl(url)
          return uploadImageByFile(file)
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : "이미지 업로드에 실패했습니다."
          await alertDialog(message, "이미지 업로드 실패", "destructive")
          return { success: 0 }
        }
      },
      [uploadImageByFile],
    )

    const normalizeBlocksForCompare = useCallback((data: OutputData) => {
      return JSON.stringify(
        data.blocks.map((block) => ({
          type: block.type,
          data: block.data,
        })),
      )
    }, [])

    const applyMarkdownShortcuts = useCallback(
      (data: OutputData) => {
        let hasChanged = false

        const nextBlocks = data.blocks.flatMap((block) => {
          if (block.type !== "paragraph") {
            return [block]
          }

          const paragraphData = createOutputData([block])
          const paragraphMarkdown = editorDataToMarkdown(paragraphData)

          if (!isMarkdownShortcutCandidate(paragraphMarkdown)) {
            return [block]
          }

          const transformedBlocks =
            markdownToEditorData(paragraphMarkdown).blocks

          if (
            normalizeBlocksForCompare(paragraphData) ===
            normalizeBlocksForCompare(createOutputData(transformedBlocks))
          ) {
            return [block]
          }

          hasChanged = true
          return transformedBlocks
        })

        if (!hasChanged) {
          return null
        }

        return createOutputData(nextBlocks)
      },
      [normalizeBlocksForCompare],
    )

    const saveData = useCallback(async (): Promise<OutputData | null> => {
      if (editorRef.current) {
        try {
          const outputData = sanitizeEditorOutputData(
            await editorRef.current.save(),
          )
          return outputData
        } catch (error) {
          console.error("Error saving data:", error)
          return null
        }
      }
      return null
    }, [])

    const updateData = useCallback(async (data: OutputData): Promise<void> => {
      if (editorRef.current) {
        try {
          await editorRef.current.render(data)
        } catch (error) {
          console.error("Error updating editor data:", error)
        }
      }
    }, [])

    useImperativeHandle(
      ref,
      () => ({
        saveData,
        updateData,
      }),
      [saveData, updateData],
    )

    const handleKeyDownCapture = useCallback(
      (event: KeyboardEvent<HTMLDivElement>) => {
        if (
          event.key !== "Enter" ||
          event.altKey ||
          event.ctrlKey ||
          event.metaKey ||
          event.nativeEvent.isComposing
        ) {
          return
        }

        const now = performance.now()
        const lastEnterEvent = lastEnterEventRef.current

        if (lastEnterEvent && now - lastEnterEvent.time < 80) {
          event.preventDefault()
          event.stopPropagation()
          return
        }

        lastEnterEventRef.current = {
          time: now,
        }
      },
      [],
    )

    // shouldUpdateOnChange 값을 ref에 동기화
    useEffect(() => {
      shouldUpdateOnChangeRef.current = shouldUpdateOnChange
    }, [shouldUpdateOnChange])

    // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
    useEffect(() => {
      if (!containerRef.current) {
        return
      }
      const container = containerRef.current
      const normalizeRenderedData = async () => {
        const currentEditor = editorRef.current

        if (!currentEditor || isApplyingShortcutRef.current) {
          return
        }

        try {
          await currentEditor.isReady
          const rawOutputData = await currentEditor.save()
          const outputData = sanitizeEditorOutputData(rawOutputData)

          if (
            getBlocksSignature(rawOutputData.blocks) ===
            getBlocksSignature(outputData.blocks)
          ) {
            return
          }

          isApplyingShortcutRef.current = true
          await currentEditor.render(outputData)
          isApplyingShortcutRef.current = false
          onDataChange?.(outputData)
        } catch (error) {
          isApplyingShortcutRef.current = false
          console.error("Error normalizing editor data:", error)
        }
      }
      const handleNativeKeyDown = (event: globalThis.KeyboardEvent) => {
        if (
          event.shiftKey ||
          event.altKey ||
          event.ctrlKey ||
          event.metaKey ||
          event.isComposing ||
          (event.key !== "Enter" && event.key !== "/")
        ) {
          return
        }

        const paragraphTarget = getEditableParagraphTarget(event.target)

        if (
          !paragraphTarget ||
          !container.contains(paragraphTarget) ||
          (paragraphTarget.textContent?.trim() &&
            !isCaretAtEndOfElement(paragraphTarget))
        ) {
          return
        }

        const currentEditor = editorRef.current

        if (!currentEditor) {
          return
        }

        if (event.key === "/") {
          if (paragraphTarget.textContent?.trim()) {
            return
          }

          event.stopPropagation()
          event.stopImmediatePropagation()

          void currentEditor.isReady
            .then(() => {
              if (editorRef.current === currentEditor) {
                openEditorToolbox(currentEditor)
              }
            })
            .catch((error) => {
              console.error("Error handling editor slash key:", error)
            })
          return
        }

        event.preventDefault()
        event.stopPropagation()
        event.stopImmediatePropagation()

        void currentEditor.isReady
          .then(() => {
            if (editorRef.current !== currentEditor) {
              return
            }

            const currentBlockIndex =
              currentEditor.blocks.getCurrentBlockIndex()
            const insertIndex =
              currentBlockIndex >= 0
                ? currentBlockIndex + 1
                : currentEditor.blocks.getBlocksCount()

            currentEditor.blocks.insert(
              "paragraph",
              { text: "" },
              undefined,
              insertIndex,
              true,
            )
            refreshToolbarPosition(currentEditor, insertIndex)

            window.setTimeout(() => {
              void normalizeRenderedData()
            }, 0)
          })
          .catch((error) => {
            console.error("Error handling editor enter key:", error)
          })
      }

      // 이미 에디터가 있으면 먼저 삭제
      if (editorRef.current) {
        destroyEditor(editorRef.current)
        editorRef.current = null
        setIsReady(false)
      }

      // Initialize Editor.js with default tools
      lastRenderedDataSignatureRef.current = getDataSignature(initialData)
      let observer: MutationObserver | null = null
      let headerStyleTimer: number | null = null
      document.addEventListener("keydown", handleNativeKeyDown, {
        capture: true,
      })
      const editor = new EditorJS({
        holder: container,
        readOnly: !isEditable,
        data: initialData,
        placeholder: isEditable ? "내용을 입력하세요..." : "",
        tools: {
          header: {
            class: Header,
            inlineToolbar: false,
            config: {
              placeholder: "제목을 입력하세요",
              levels: [1, 2, 3, 4, 5, 6],
              defaultLevel: 2,
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
          columns: {
            class: ColumnsTool,
            config: {
              uploadImageByFile,
              uploadImageByUrl,
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
              uploader: {
                uploadByFile: uploadImageByFile,
                uploadByUrl: uploadImageByUrl,
              },
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
          },
        },
        onChange: async () => {
          if (isApplyingShortcutRef.current) {
            return
          }

          if (onDataChange && isEditable && shouldUpdateOnChangeRef.current) {
            try {
              await editor.isReady

              if (
                editorRef.current !== editor ||
                typeof editor.save !== "function"
              ) {
                return
              }

              const rawOutputData = await editor.save()
              const outputData = sanitizeEditorOutputData(rawOutputData)

              if (
                getBlocksSignature(rawOutputData.blocks) !==
                getBlocksSignature(outputData.blocks)
              ) {
                isApplyingShortcutRef.current = true

                if (editorRef.current !== editor) {
                  isApplyingShortcutRef.current = false
                  return
                }

                await editor.render(outputData)
                isApplyingShortcutRef.current = false
                onDataChange(outputData)
                return
              }

              if (enableMarkdownShortcuts) {
                const transformedData = applyMarkdownShortcuts(outputData)

                if (transformedData) {
                  isApplyingShortcutRef.current = true

                  if (editorRef.current !== editor) {
                    isApplyingShortcutRef.current = false
                    return
                  }

                  await editor.render(transformedData)
                  isApplyingShortcutRef.current = false
                  onDataChange(transformedData)
                  return
                }
              }

              onDataChange(outputData)
            } catch (error) {
              isApplyingShortcutRef.current = false
              console.error("Error saving editor data:", error)
            }
          }
        },
      })
      editorRef.current = editor

      editor.isReady
        .then(() => {
          if (editorRef.current !== editor) {
            return
          }

          // Header 스타일 강제 적용 (CSS 우선순위 문제 해결)
          const applyHeaderStyles = () => {
            const headers = containerRef.current?.querySelectorAll(
              "h1, h2, h3, h4, h5, h6",
            )

            if (headers) {
              for (const header of headers) {
                const headerElement = header as HTMLElement

                // EditorJS 헤더인지 확인
                const isEditorJSHeader =
                  headerElement.closest('.ce-block[data-tool="header"]') ||
                  headerElement.closest(".ce-header") ||
                  headerElement.parentElement?.classList.contains("ce-header")

                if (isEditorJSHeader) {
                  const tagName = header.tagName.toLowerCase()

                  // 헤더 레벨에 따른 스타일 적용
                  const styles = {
                    h1: { fontSize: "2em", fontWeight: "bold" },
                    h2: { fontSize: "1.5em", fontWeight: "bold" },
                    h3: { fontSize: "1.25em", fontWeight: "bold" },
                    h4: { fontSize: "1.1em", fontWeight: "bold" },
                    h5: { fontSize: "1em", fontWeight: "bold" },
                    h6: { fontSize: "0.875em", fontWeight: "bold" },
                  }

                  const style = styles[tagName as keyof typeof styles]
                  if (style) {
                    headerElement.style.fontSize = style.fontSize
                    headerElement.style.fontWeight = style.fontWeight
                    headerElement.style.margin = "0"
                    headerElement.style.padding = "0.5em 0"
                  }
                }
              }
            }
          }

          // 초기 적용
          headerStyleTimer = window.setTimeout(applyHeaderStyles, 100)

          // DOM 변화 감지하여 새로 생성된 헤더에도 스타일 적용
          if (containerRef.current) {
            observer = new MutationObserver(() => {
              applyHeaderStyles()
            })
            observer.observe(containerRef.current, {
              childList: true,
              subtree: true,
            })
          }

          setIsReady(true)
        })
        .catch((error) => {
          console.error("Editor.js initialization failed:", error)
        })

      return () => {
        if (headerStyleTimer) {
          window.clearTimeout(headerStyleTimer)
        }
        observer?.disconnect()
        document.removeEventListener("keydown", handleNativeKeyDown, {
          capture: true,
        })
        setIsReady(false)

        if (editorRef.current === editor) {
          editorRef.current = null
        }

        destroyEditor(editor)
      }
    }, [
      isEditable,
      enableMarkdownShortcuts,
      normalizeBlocksForCompare,
      uploadImageByFile,
      uploadImageByUrl,
    ]) // 편집 모드 변경에만 반응

    // initialData 변경 시 에디터 내용 업데이트 (재생성 없이)
    useEffect(() => {
      if (editorRef.current && isReady && initialData && !disableAutoUpdate) {
        const nextDataSignature = getDataSignature(initialData)
        if (lastRenderedDataSignatureRef.current === nextDataSignature) {
          return
        }

        editorRef.current.render(initialData).catch((error) => {
          console.error("Error updating editor data:", error)
        })
        lastRenderedDataSignatureRef.current = nextDataSignature
      }
    }, [initialData, isReady, disableAutoUpdate])

    // Handle mode changes
    useEffect(() => {
      if (editorRef.current && isReady) {
        editorRef.current.readOnly?.toggle(!isEditable)
      }
    }, [isEditable, isReady])

    // Expose saveData function to parent component
    useEffect(() => {
      if (containerRef.current) {
        ;(
          containerRef.current as HTMLDivElement & {
            saveData: () => Promise<OutputData | null>
          }
        ).saveData = saveData
      }
    }, [saveData])

    return (
      <div className={`w-full ${fillHeight ? "h-full" : "min-h-full"}`}>
        <div
          ref={containerRef}
          className={`document-editor-shell ${
            fillHeight ? "h-full min-h-full" : "min-h-full"
          } ${
            contentLayout === "document"
              ? "document-editor-shell--document"
              : ""
          } ${
            minimalChrome
              ? "border-0 rounded-none p-0"
              : "border rounded-lg p-4"
          }`}
          style={{
            fontSize: "16px",
            lineHeight: "1.6",
          }}
          onFocusCapture={onFocus}
          onBlurCapture={onBlur}
          onKeyDownCapture={handleKeyDownCapture}
        />
        <style>{`
          .document-editor-shell .codex-editor,
          .document-editor-shell .codex-editor__redactor {
            min-height: 100% !important;
            height: ${fillHeight ? "100%" : "auto"} !important;
            padding-bottom: 0 !important;
          }

          .document-editor-shell .ce-block__content,
          .document-editor-shell .ce-toolbar__content {
            max-width: none !important;
            margin: 0 20px !important;
          }

          .document-editor-shell.document-editor-shell--document .ce-block__content,
          .document-editor-shell.document-editor-shell--document .ce-toolbar__content {
            max-width: 860px !important;
            margin-left: auto !important;
            margin-right: auto !important;
          }

          .document-editor-shell .codex-editor {
            color: #1f2937;
          }

          .document-editor-shell .ce-block {
            padding: 1px 0;
          }

          .document-editor-shell .ce-paragraph,
          .document-editor-shell .cdx-list,
          .document-editor-shell .cdx-quote,
          .document-editor-shell .ce-code {
            font-size: 16px;
            line-height: 1.78;
            letter-spacing: -0.01em;
          }

          .document-editor-shell .ce-paragraph {
            padding: 0.18em 0;
          }

          .document-editor-shell .ce-paragraph[data-placeholder]:empty::before {
            color: #9ca3af;
            opacity: 1;
          }

          .document-editor-shell .ce-header {
            color: #111827 !important;
            letter-spacing: -0.035em;
            line-height: 1.28 !important;
            padding: 0.32em 0 0.16em !important;
          }

          .document-editor-shell h1.ce-header {
            font-size: 2.25rem !important;
          }

          .document-editor-shell h2.ce-header {
            font-size: 1.75rem !important;
          }

          .document-editor-shell h3.ce-header {
            font-size: 1.38rem !important;
          }

          .document-editor-shell h4.ce-header {
            font-size: 1.12rem !important;
          }

          .document-editor-shell h5.ce-header,
          .document-editor-shell h6.ce-header {
            font-size: 1rem !important;
          }

          .document-editor-shell .cdx-list {
            padding-left: 1.35em;
          }

          .document-editor-shell .cdx-list__item {
            padding: 0.08em 0 0.08em 0.1em;
          }

          .document-editor-shell .cdx-quote {
            margin: 0.5em 0;
            padding: 0.15em 0 0.15em 0.95em;
            border-left: 3px solid #d1d5db;
            color: #4b5563;
          }

          .document-editor-shell .cdx-quote__text {
            min-height: 0;
          }

          .document-editor-shell .cdx-quote__caption {
            color: #9ca3af;
            font-size: 0.9em;
          }

          .document-editor-shell .cdx-quote[data-alignment="center"] {
            text-align: center;
          }

          .document-editor-shell .cdx-quote[data-alignment="center"] .cdx-quote__text,
          .document-editor-shell .cdx-quote[data-alignment="center"] .cdx-quote__caption {
            text-align: center !important;
          }

          .document-editor-shell .cdx-quote[data-alignment="center"] .cdx-quote__text[data-placeholder]::before,
          .document-editor-shell .cdx-quote[data-alignment="center"] .cdx-quote__caption[data-placeholder]::before {
            display: block;
            width: 100%;
            text-align: center !important;
          }

          .document-editor-shell .ce-code {
            margin: 0.65em 0;
            position: relative;
          }

          .document-editor-shell .ce-code__highlight {
            position: absolute;
            inset: 0;
            z-index: 1;
            min-height: 120px;
            margin: 0;
            overflow: auto;
            border: 1px solid transparent;
            border-radius: 14px;
            padding: 44px 18px 16px;
            color: #334155;
            font-family: "SFMono-Regular", "Menlo", "Consolas", monospace;
            font-size: 0.92rem;
            line-height: 1.7;
            pointer-events: none;
            white-space: pre;
            scrollbar-width: none;
          }

          .document-editor-shell .ce-code__highlight::-webkit-scrollbar {
            display: none;
          }

          .document-editor-shell .ce-code--highlighted .ce-code__textarea {
            position: relative;
            z-index: 2;
            background: transparent !important;
            color: transparent !important;
            caret-color: #334155;
            -webkit-text-fill-color: transparent;
          }

          .document-editor-shell .code-token--keyword {
            color: #4338ca;
            font-weight: 700;
          }

          .document-editor-shell .code-token--string {
            color: #047857;
          }

          .document-editor-shell .code-token--comment {
            color: #94a3b8;
          }

          .document-editor-shell .code-token--number {
            color: #1d4ed8;
          }

          .document-editor-shell .ce-code__language {
            position: absolute;
            top: 10px;
            right: 12px;
            z-index: 1;
            border-radius: 999px;
            background: rgb(255 255 255 / 0.88);
            padding: 2px 8px;
            color: #64748b;
            font-size: 11px;
            font-weight: 600;
            line-height: 18px;
            box-shadow: 0 1px 4px rgb(15 23 42 / 0.08);
          }

          .document-editor-shell .ce-code__language-select {
            position: absolute;
            top: 10px;
            right: 12px;
            z-index: 2;
            height: 26px;
            max-width: 148px;
            border: 1px solid #e2e8f0;
            border-radius: 999px;
            background: rgb(255 255 255 / 0.94);
            padding: 0 28px 0 10px;
            color: #475569;
            font-size: 11px;
            font-weight: 700;
            line-height: 24px;
            box-shadow: 0 1px 5px rgb(15 23 42 / 0.1);
            outline: none;
          }

          .document-editor-shell .ce-code__language-select:focus {
            border-color: #94a3b8;
            box-shadow: 0 0 0 3px rgb(148 163 184 / 0.18);
          }

          .document-editor-shell .ce-code__textarea {
            min-height: 120px;
            border: 1px solid #e5e7eb;
            border-radius: 14px;
            background: #f8fafc;
            color: #334155;
            font-family: "SFMono-Regular", "Menlo", "Consolas", monospace;
            font-size: 0.92rem;
            line-height: 1.7;
            padding: 44px 18px 16px;
            box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.75);
          }

          .document-editor-shell .columns-tool {
            --columns-divider-color: transparent;
            --columns-divider-thumb: transparent;
            display: grid;
            grid-template-columns:
              minmax(0, var(--columns-left-size, 1fr))
              1px
              minmax(0, var(--columns-right-size, 1fr));
            column-gap: 28px;
            align-items: start;
            margin: 0.75em 0;
            position: relative;
            width: 100%;
          }

          .document-editor-shell .columns-tool:hover,
          .document-editor-shell .columns-tool:focus-within {
            --columns-divider-color: #e2e8f0;
            --columns-divider-thumb: #cbd5e1;
          }

          .document-editor-shell .columns-tool__column {
            min-width: 0;
            min-height: 56px;
            border: 0;
            border-radius: 0;
            background: transparent;
            padding: 0;
          }

          .document-editor-shell .columns-tool__divider {
            align-self: stretch;
            min-height: 56px;
            width: 1px;
            background: var(--columns-divider-color);
            cursor: col-resize;
            position: relative;
            transition: background-color 140ms ease;
          }

          .document-editor-shell .columns-tool__divider::before {
            content: "";
            position: absolute;
            inset: 0 -12px;
          }

          .document-editor-shell .columns-tool__divider::after {
            content: "";
            position: absolute;
            top: 50%;
            left: 50%;
            width: 4px;
            height: 28px;
            border-radius: 999px;
            background: var(--columns-divider-thumb);
            transform: translate(-50%, -50%);
            transition: background-color 140ms ease;
          }

          .columns-tool-resizing,
          .columns-tool-resizing * {
            cursor: col-resize !important;
            user-select: none !important;
          }

          .document-editor-shell .columns-tool__column .codex-editor,
          .document-editor-shell .columns-tool__column .codex-editor__redactor {
            min-height: 56px !important;
            height: auto !important;
            padding-bottom: 0 !important;
          }

          .document-editor-shell .columns-tool__column .ce-block {
            margin: 0.25em 0;
            padding: 0;
          }

          .document-editor-shell .columns-tool__column .ce-block__content,
          .document-editor-shell .columns-tool__column .ce-toolbar__content {
            max-width: none !important;
            margin: 0 !important;
          }

          .document-editor-shell .columns-tool__column .ce-toolbar__plus {
            left: -32px;
          }

          .document-editor-shell .columns-tool__column .ce-toolbar__settings-btn {
            left: -4px;
          }

          @media (max-width: 720px) {
            .document-editor-shell .columns-tool {
              grid-template-columns: 1fr;
              row-gap: 10px;
            }

            .document-editor-shell .columns-tool__divider {
              display: none;
            }
          }

          .document-editor-shell .image-tool {
            margin: 0.9em 0;
            max-width: 100%;
          }

          .document-editor-shell .image-tool__image {
            overflow: hidden;
            border-radius: 16px;
            background: #f8fafc;
            max-width: 100%;
            transition:
              border-color 160ms ease,
              background-color 160ms ease,
              padding 160ms ease;
          }

          .document-editor-shell .image-tool__image-picture {
            border-radius: 16px;
            max-width: 100%;
            margin: 0 auto;
            object-fit: contain;
            transition:
              width 160ms ease,
              max-width 160ms ease;
          }

          .document-editor-shell .cdx-image-tool-tune--resize .cdx-block {
            max-width: 100% !important;
          }

          .document-editor-shell .cdx-image-tool-tune--resize .image-tool {
            max-width: 100% !important;
          }

          .document-editor-shell .cdx-image-tool-tune--resize .cdx-block .resizable .resizers .resizer {
            z-index: 6;
            width: 14px;
            height: 14px;
            border: 3px solid #0f766e;
            background: #ecfdf5;
            box-shadow: 0 6px 16px rgb(15 118 110 / 0.18);
          }

          .document-editor-shell .image-tool--withBorder .image-tool__image {
            border: 1px solid #cbd5e1;
            padding: 8px;
            background: #ffffff;
          }

          .document-editor-shell .image-tool--withBackground .image-tool__image {
            border: 1px solid #e2e8f0;
            padding: 24px;
            background: #f8fafc;
          }

          .document-editor-shell .image-tool--withBackground .image-tool__image-picture {
            max-width: 62%;
          }

          .document-editor-shell .image-tool--stretched .image-tool__image-picture {
            width: 100%;
            max-width: 100%;
          }

          .document-editor-shell .image-tool__caption {
            margin-top: 0.65rem;
            border: 0;
            box-shadow: none;
            color: #64748b;
            font-size: 0.9rem;
            line-height: 1.55;
            text-align: center;
          }

          .document-editor-shell .image-tool__caption[contenteditable="true"]:empty::before {
            color: #94a3b8;
          }

          .document-editor-shell .ce-delimiter {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 100%;
            padding: 1.35em 0;
            line-height: 0;
            text-align: center;
          }

          .document-editor-shell .ce-delimiter::before {
            display: block;
            width: 100%;
            max-width: 100%;
            height: 1px;
            border-radius: 999px;
            background: #e5e7eb;
            content: "" !important;
            font-size: 0;
            line-height: 0;
            letter-spacing: 0;
          }
        `}</style>
        {!isReady && (
          <div className="flex h-full min-h-full items-center justify-center">
            <div className="text-gray-500">에디터를 로딩 중...</div>
          </div>
        )}
      </div>
    )
  },
)

DocumentEditor.displayName = "DocumentEditor"

export default DocumentEditor
