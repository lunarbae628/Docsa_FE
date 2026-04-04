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

interface DocumentEditorProps {
  isEditable: boolean
  initialData?: OutputData
  onDataChange?: (data: OutputData) => void
  onFocus?: () => void
  onBlur?: () => void
  shouldUpdateOnChange?: boolean // 포커스 상태에 따라 onChange 실행 제어
  disableAutoUpdate?: boolean // initialData 변경 시 자동 업데이트 비활성화
}

export interface DocumentEditorRef {
  saveData: () => Promise<OutputData | null>
  updateData: (data: OutputData) => Promise<void>
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
    },
    ref,
  ) => {
    const editorRef = useRef<EditorJS | null>(null)
    const containerRef = useRef<HTMLDivElement>(null)
    const [isReady, setIsReady] = useState(false)
    const shouldUpdateOnChangeRef = useRef(shouldUpdateOnChange)

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
          if (onDataChange && isEditable && shouldUpdateOnChangeRef.current) {
            try {
              const outputData = await editor.save()
              onDataChange(outputData)
            } catch (error) {
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
    }, [isEditable]) // 편집 모드 변경에만 반응

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
          className={`
          h-full
          min-h-[400px] 
          border rounded-lg 
          p-4
        `}
          style={{
            fontSize: "16px",
            lineHeight: "1.6",
          }}
          onFocusCapture={onFocus}
          onBlurCapture={onBlur}
        />
        {!isReady && (
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-gray-500">에디터를 로딩 중...</div>
          </div>
        )}
      </div>
    )
  },
)

DocumentEditor.displayName = "DocumentEditor"

export default DocumentEditor
