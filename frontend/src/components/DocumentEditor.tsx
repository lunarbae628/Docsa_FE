import {
  useEffect,
  useRef,
  useState,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from "react"
import EditorJS, { type OutputData } from "@editorjs/editorjs"
import Header from "@editorjs/header"
import List from "@editorjs/list"
import Quote from "@editorjs/quote"
import Code from "@editorjs/code"
import Delimiter from "@editorjs/delimiter"
import Paragraph from "@editorjs/paragraph"
import { editorDataToMarkdown, markdownToEditorData } from "@/lib/editorMarkdown"

interface DocumentEditorProps {
  isEditable: boolean
  initialData?: OutputData
  onDataChange?: (data: OutputData) => void
  onFocus?: () => void
  onBlur?: () => void
  shouldUpdateOnChange?: boolean // 포커스 상태에 따라 onChange 실행 제어
  disableAutoUpdate?: boolean // initialData 변경 시 자동 업데이트 비활성화
  enableMarkdownShortcuts?: boolean
  minimalChrome?: boolean
  contentLayout?: "full" | "document"
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

const DocumentEditor = forwardRef<DocumentEditorRef, DocumentEditorProps>(
  (
    {
      isEditable,
      initialData,
      onDataChange,
      onFocus,
      onBlur,
      shouldUpdateOnChange = true,
      disableAutoUpdate = false,
      enableMarkdownShortcuts = false,
      minimalChrome = false,
      contentLayout = "full",
    },
    ref,
  ) => {
    const editorRef = useRef<EditorJS | null>(null)
    const containerRef = useRef<HTMLDivElement>(null)
    const [isReady, setIsReady] = useState(false)
    const shouldUpdateOnChangeRef = useRef(shouldUpdateOnChange)
    const isApplyingShortcutRef = useRef(false)

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

          const transformedBlocks = markdownToEditorData(paragraphMarkdown).blocks

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
          const outputData = await editorRef.current.save()
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

    // shouldUpdateOnChange 값을 ref에 동기화
    useEffect(() => {
      shouldUpdateOnChangeRef.current = shouldUpdateOnChange
    }, [shouldUpdateOnChange])

    // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
    useEffect(() => {
      if (!containerRef.current) {
        return
      }

      // 이미 에디터가 있으면 먼저 삭제
      if (editorRef.current) {
        editorRef.current.destroy()
        editorRef.current = null
        setIsReady(false)
      }

      // Initialize Editor.js with default tools
      const editor = new EditorJS({
        holder: containerRef.current,
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
            class: Quote,
            inlineToolbar: true,
            config: {
              quotePlaceholder: "인용문을 입력하세요",
              captionPlaceholder: "인용문의 출처",
            },
          },
          code: {
            class: Code,
            config: {
              placeholder: "코드를 입력하세요",
            },
          },
          delimiter: Delimiter,
          paragraph: {
            class: Paragraph,
            inlineToolbar: true,
            config: {
              preserveBlank: true,
            },
          },
        },
        onChange: async () => {
          if (isApplyingShortcutRef.current) {
            return
          }

          if (onDataChange && isEditable && shouldUpdateOnChangeRef.current) {
            try {
              const outputData = await editor.save()

              if (enableMarkdownShortcuts) {
                const transformedData = applyMarkdownShortcuts(outputData)

                if (transformedData) {
                  isApplyingShortcutRef.current = true
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

      editor.isReady
        .then(() => {
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
          setTimeout(applyHeaderStyles, 100)

          // DOM 변화 감지하여 새로 생성된 헤더에도 스타일 적용
          if (containerRef.current) {
            const observer = new MutationObserver(() => {
              applyHeaderStyles()
            })
            observer.observe(containerRef.current, {
              childList: true,
              subtree: true,
            })
          }

          setIsReady(true)
          editorRef.current = editor
        })
        .catch((error) => {
          console.error("Editor.js initialization failed:", error)
        })

      return () => {
        if (editorRef.current) {
          editorRef.current.destroy()
          editorRef.current = null
        }
      }
    }, [isEditable, enableMarkdownShortcuts, normalizeBlocksForCompare]) // 편집 모드 변경에만 반응

    // initialData 변경 시 에디터 내용 업데이트 (재생성 없이)
    useEffect(() => {
      if (editorRef.current && isReady && initialData && !disableAutoUpdate) {
        editorRef.current.render(initialData).catch((error) => {
          console.error("Error updating editor data:", error)
        })
      }
    }, [initialData, isReady, disableAutoUpdate])

    // Handle mode changes
    useEffect(() => {
      if (editorRef.current && isReady) {
        editorRef.current.readOnly.toggle(!isEditable)
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
      <div className="w-full h-full">
        <div
          ref={containerRef}
          className={`document-editor-shell h-full min-h-full ${
            contentLayout === "document" ? "document-editor-shell--document" : ""
          } ${
            minimalChrome ? "border-0 rounded-none p-0" : "border rounded-lg p-4"
          }`}
          style={{
            fontSize: "16px",
            lineHeight: "1.6",
          }}
          onFocusCapture={onFocus}
          onBlurCapture={onBlur}
        />
        <style>{`
          .document-editor-shell .codex-editor,
          .document-editor-shell .codex-editor__redactor {
            min-height: 100% !important;
            height: 100% !important;
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
