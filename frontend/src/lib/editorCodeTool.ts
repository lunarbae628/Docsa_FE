import Code from "@editorjs/code"
import type { ConversionConfig, SanitizerConfig } from "@editorjs/editorjs"

type CodeData = {
  code?: string
  language?: string
}

const LANGUAGES = [
  { id: "plain", label: "Plain text" },
  { id: "javascript", label: "JavaScript" },
  { id: "typescript", label: "TypeScript" },
  { id: "java", label: "Java" },
  { id: "sql", label: "SQL" },
  { id: "json", label: "JSON" },
] as const

const KEYWORD_PATTERNS: Record<string, string> = {
  javascript:
    "\\b(?:const|let|var|function|return|async|await|if|else|for|while|import|export|from|class|new|try|catch|throw)\\b",
  typescript:
    "\\b(?:const|let|var|function|return|async|await|if|else|for|while|import|export|from|class|new|try|catch|throw|type|interface|implements|extends)\\b",
  java: "\\b(?:public|private|protected|class|interface|return|new|if|else|for|while|try|catch|throw|void|static|final)\\b",
  sql: "\\b(?:select|from|where|join|left|right|inner|outer|insert|update|delete|into|values|group|order|by|limit|and|or|as)\\b",
  json: "\\b(?:true|false|null)\\b",
}

function normalizeLanguage(value: unknown) {
  return LANGUAGES.some((language) => language.id === value)
    ? String(value)
    : "plain"
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function highlightCodeToHtml(code: string, language: string) {
  const keywordPattern = KEYWORD_PATTERNS[language]
  if (!keywordPattern) {
    return escapeHtml(code)
  }

  const tokenPattern = new RegExp(
    `("(?:\\\\.|[^"\\\\])*"|'(?:\\\\.|[^'\\\\])*'|//[^\\n]*|/\\*[\\s\\S]*?\\*/|\\b\\d+(?:\\.\\d+)?\\b|${keywordPattern})`,
    "gi",
  )

  return code
    .split(tokenPattern)
    .map((part) => {
      if (!part) return ""

      const escapedPart = escapeHtml(part)
      const isString = /^["']/.test(part)
      const isComment = part.startsWith("//") || part.startsWith("/*")
      const isNumber = /^\d/.test(part)
      const isKeyword = new RegExp(keywordPattern, "i").test(part)

      if (isString) {
        return `<span class="code-token code-token--string">${escapedPart}</span>`
      }
      if (isComment) {
        return `<span class="code-token code-token--comment">${escapedPart}</span>`
      }
      if (isNumber) {
        return `<span class="code-token code-token--number">${escapedPart}</span>`
      }
      if (isKeyword) {
        return `<span class="code-token code-token--keyword">${escapedPart}</span>`
      }

      return escapedPart
    })
    .join("")
}

export class CodeWithLanguage extends Code {
  private language = "plain"
  private readOnly = false
  private blockApi: { dispatchChange?: () => void } | null = null
  private holder: HTMLElement | null = null
  private highlightElement: HTMLElement | null = null
  private textarea: HTMLTextAreaElement | null = null

  constructor(params: ConstructorParameters<typeof Code>[0]) {
    super(params)
    this.language = normalizeLanguage(
      (params.data as CodeData | undefined)?.language,
    )
    this.blockApi =
      (params as unknown as { block?: { dispatchChange?: () => void } })
        .block ?? null
    this.readOnly = Boolean(
      (params as unknown as { readOnly?: boolean }).readOnly,
    )
  }

  static get conversionConfig(): ConversionConfig {
    return {
      import: "code",
      export: "code",
    }
  }

  static get sanitize(): SanitizerConfig {
    return {
      code: true,
      language: false,
    }
  }

  render(): HTMLDivElement {
    const holder = super.render()
    this.holder = holder
    this.applyLanguageControl()
    this.applyHighlightLayer()
    return holder
  }

  save(codeWrapper: HTMLDivElement): CodeData {
    const data = super.save(codeWrapper) as CodeData
    return {
      ...data,
      language: this.language,
    }
  }

  renderSettings() {
    return LANGUAGES.map((language) => ({
      label: language.label,
      onActivate: () => {
        this.language = language.id
        this.applyLanguageControl()
        this.blockApi?.dispatchChange?.()
      },
      isActive: this.language === language.id,
      closeOnActivate: true,
    }))
  }

  private applyLanguageControl() {
    if (!this.holder) return

    this.holder.dataset.language = this.language

    if (!this.readOnly) {
      this.holder.querySelector(".ce-code__language")?.remove()
      let select = this.holder.querySelector<HTMLSelectElement>(
        ".ce-code__language-select",
      )

      if (!select) {
        select = document.createElement("select")
        select.className = "ce-code__language-select"

        for (const language of LANGUAGES) {
          const option = document.createElement("option")
          option.value = language.id
          option.textContent = language.label
          select.append(option)
        }

        select.addEventListener("change", () => {
          this.language = normalizeLanguage(select.value)
          this.holder?.setAttribute("data-language", this.language)
          this.updateHighlightLayer()
          this.blockApi?.dispatchChange?.()
        })

        this.holder.prepend(select)
      }

      select.value = this.language
      return
    }

    this.holder.querySelector(".ce-code__language-select")?.remove()
    let label = this.holder.querySelector<HTMLElement>(".ce-code__language")

    if (!label) {
      label = document.createElement("div")
      label.className = "ce-code__language"
      this.holder.prepend(label)
    }

    label.textContent =
      LANGUAGES.find((language) => language.id === this.language)?.label ??
      "Plain text"
  }

  private applyHighlightLayer() {
    if (!this.holder || this.readOnly) return

    const textarea =
      this.holder.querySelector<HTMLTextAreaElement>(".ce-code__textarea")
    if (!textarea) return

    this.textarea = textarea
    this.holder.classList.add("ce-code--highlighted")

    let highlightElement = this.holder.querySelector<HTMLElement>(
      ".ce-code__highlight",
    )

    if (!highlightElement) {
      highlightElement = document.createElement("pre")
      highlightElement.className = "ce-code__highlight"
      highlightElement.setAttribute("aria-hidden", "true")
      textarea.before(highlightElement)
    }

    this.highlightElement = highlightElement

    const syncHighlight = () => this.updateHighlightLayer()
    textarea.addEventListener("input", syncHighlight)
    textarea.addEventListener("scroll", () => {
      if (!this.highlightElement || !this.textarea) return
      this.highlightElement.scrollTop = this.textarea.scrollTop
      this.highlightElement.scrollLeft = this.textarea.scrollLeft
    })

    this.updateHighlightLayer()
  }

  private updateHighlightLayer() {
    if (!this.highlightElement || !this.textarea) return

    const code = this.textarea.value || "\n"
    this.highlightElement.innerHTML = highlightCodeToHtml(code, this.language)
    this.highlightElement.style.height = `${this.textarea.offsetHeight}px`
    this.highlightElement.scrollTop = this.textarea.scrollTop
    this.highlightElement.scrollLeft = this.textarea.scrollLeft
  }
}
