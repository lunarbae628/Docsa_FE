import { type ReactNode, createElement } from "react"

export function normalizeVisibleText(value: unknown): string {
  return String(value ?? "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(?:p|div|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/\u00a0/g, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
}

export function renderTextWithBreaks(text: string): ReactNode {
  return text.split("\n").map((line, index) => (
    <span key={`${line}-${index}`}>
      {index > 0 ? <br /> : null}
      {line}
    </span>
  ))
}

function isSafeHref(value: string) {
  return /^(https?:|mailto:|tel:|#|\/)/i.test(value)
}

function renderSanitizedNode(node: Node, key: string): ReactNode {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return null
  }

  const element = node as HTMLElement
  const children = Array.from(element.childNodes).map((child, index) =>
    renderSanitizedNode(child, `${key}-${index}`),
  )

  switch (element.tagName.toLowerCase()) {
    case "br":
      return <br key={key} />
    case "b":
    case "strong":
      return createElement("strong", { key }, children)
    case "i":
    case "em":
      return createElement("em", { key }, children)
    case "u":
      return createElement("span", { key, className: "underline" }, children)
    case "s":
    case "strike":
      return createElement("s", { key }, children)
    case "mark":
      return createElement(
        "mark",
        { key, className: "rounded bg-amber-100 px-0.5 text-inherit" },
        children,
      )
    case "code":
      return createElement(
        "code",
        {
          key,
          className:
            "rounded bg-slate-100 px-1 py-0.5 font-mono text-[0.92em] text-slate-700",
        },
        children,
      )
    case "a": {
      const href = element.getAttribute("href") ?? ""
      return createElement(
        "a",
        {
          key,
          href: isSafeHref(href) ? href : undefined,
          target:
            href.startsWith("#") || href.startsWith("/") ? undefined : "_blank",
          rel: "noreferrer",
          className:
            "font-medium text-blue-700 underline decoration-blue-300 underline-offset-4",
        },
        children,
      )
    }
    default:
      return children
  }
}

export function renderRichTextWithBreaks(value: unknown): ReactNode {
  const html = String(value ?? "").replace(/<br\s*\/?>/gi, "<br>")

  if (typeof document === "undefined") {
    return renderTextWithBreaks(normalizeVisibleText(html))
  }

  const template = document.createElement("template")
  template.innerHTML = html

  return Array.from(template.content.childNodes).map((node, index) =>
    renderSanitizedNode(node, `rich-${index}`),
  )
}

function serializeInlineNode(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return normalizeVisibleText(node.textContent)
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return ""
  }

  const element = node as HTMLElement
  const children = Array.from(element.childNodes)
    .map(serializeInlineNode)
    .join("")

  switch (element.tagName.toLowerCase()) {
    case "br":
      return "\n"
    case "b":
    case "strong":
      return `<strong>${children}</strong>`
    case "i":
    case "em":
      return `<em>${children}</em>`
    case "u":
      return `<u>${children}</u>`
    case "s":
    case "strike":
      return `<s>${children}</s>`
    case "mark":
      return `<mark>${children}</mark>`
    case "code":
      return `<code>${children}</code>`
    case "a": {
      const href = element.getAttribute("href") ?? ""
      const safeHref = isSafeHref(href) ? href : ""
      return `<a href="${safeHref}">${children}</a>`
    }
    default:
      return children
  }
}

export function normalizeInlineDiffText(value: unknown): string {
  const html = String(value ?? "").replace(/<br\s*\/?>/gi, "<br>")

  if (typeof document === "undefined") {
    return normalizeVisibleText(html)
  }

  const template = document.createElement("template")
  template.innerHTML = html

  return Array.from(template.content.childNodes)
    .map(serializeInlineNode)
    .join("")
}
