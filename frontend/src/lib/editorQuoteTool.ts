import Quote from "@editorjs/quote"

type QuoteData = {
  text?: string
  caption?: string
  alignment?: "left" | "center"
}

function applyQuoteAlignment(
  element: HTMLElement,
  alignment: string | undefined,
) {
  const normalizedAlignment = alignment === "center" ? "center" : "left"
  element.dataset.alignment = normalizedAlignment
  element.style.textAlign = normalizedAlignment

  for (const child of element.querySelectorAll<HTMLElement>(
    ".cdx-quote__text, .cdx-quote__caption",
  )) {
    child.style.textAlign = normalizedAlignment
  }
}

export class AlignedQuote extends Quote {
  private element: HTMLElement | null = null

  render(): HTMLElement {
    const element = super.render()
    this.element = element
    applyQuoteAlignment(element, this.getData().alignment)
    return element
  }

  save(quoteElement: HTMLDivElement): Required<QuoteData> {
    const data = super.save(quoteElement) as Required<QuoteData>
    applyQuoteAlignment(quoteElement, data.alignment)
    return data
  }

  renderSettings() {
    const settings = super.renderSettings()

    if (!Array.isArray(settings)) {
      return settings
    }

    return settings.map((setting) => ({
      ...setting,
      onActivate: () => {
        setting.onActivate?.()
        if (this.element) {
          applyQuoteAlignment(this.element, this.getData().alignment)
        }
      },
    }))
  }

  private getData() {
    return (this as unknown as { data?: QuoteData }).data ?? {}
  }
}
