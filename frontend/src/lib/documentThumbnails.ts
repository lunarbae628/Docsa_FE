import type { EditorBlock } from "@/lib/diffUtils"

const THUMBNAIL_WIDTH = 360
const THUMBNAIL_HEIGHT = 509
const CANVAS_SCALE = 2
const RENDER_WIDTH = 1040
const RENDER_HEIGHT = Math.round(
  (THUMBNAIL_HEIGHT * RENDER_WIDTH) / THUMBNAIL_WIDTH,
)
const RENDER_SCALE = THUMBNAIL_WIDTH / RENDER_WIDTH
const EDITOR_CONTENT_WIDTH = 860
const EDITOR_MARGIN_X = (RENDER_WIDTH - EDITOR_CONTENT_WIDTH) / 2
const EDITOR_MARGIN_TOP = 112
let blankDocumentThumbnailDataUrl: string | undefined

type ThumbnailBlock = Partial<EditorBlock> & {
  data?: Record<string, unknown>
  tunes?: Record<string, unknown>
}

type DrawBounds = {
  x: number
  y: number
  width: number
}

export type DocumentThumbnailArtifact = {
  dataUrl: string
  blob: Blob
  file: File
  signature: string
}

function decodeText(value: unknown) {
  if (typeof value !== "string") return ""

  if (typeof document === "undefined") {
    return value.replace(/<[^>]+>/g, "")
  }

  const template = document.createElement("template")
  template.innerHTML = value
  return template.content.textContent ?? ""
}

function getListItemText(item: unknown) {
  if (typeof item === "string") return decodeText(item)
  if (!item || typeof item !== "object") return String(item ?? "")

  const record = item as Record<string, unknown>
  return decodeText(record.content ?? record.text ?? record.value ?? "")
}

function getImageUrl(data: Record<string, unknown> | undefined) {
  const file = data?.file
  if (file && typeof file === "object") {
    const url = (file as { url?: unknown }).url
    return typeof url === "string" ? url : ""
  }

  const url = data?.url
  return typeof url === "string" ? url : ""
}

function getRecord(value: unknown) {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null
}

function getImageFlag(data: Record<string, unknown>, key: string) {
  const value = data[key]
  return value === true || value === "true"
}

function getNumberFromTune(
  tune: Record<string, unknown> | null | undefined,
  key: string,
) {
  const rawValue = tune?.[key]
  const value =
    typeof rawValue === "string"
      ? Number.parseFloat(rawValue)
      : Number(rawValue)

  return Number.isFinite(value) && value > 0 ? value : null
}

function getImageResizeTune(
  block: ThumbnailBlock,
  data: Record<string, unknown>,
) {
  const blockTunes = getRecord(block.tunes)
  const dataTunes = getRecord(data.tunes)
  const internalTunes = getRecord(data.__tunes)
  const candidates = [
    getRecord(data.imageResize),
    getRecord(data.imageTune),
    getRecord(blockTunes?.imageResize),
    getRecord(blockTunes?.imageTune),
    getRecord(dataTunes?.imageResize),
    getRecord(dataTunes?.imageTune),
    getRecord(internalTunes?.imageResize),
    getRecord(internalTunes?.imageTune),
  ]

  return candidates.find(Boolean) ?? null
}

function getImageResizeWidth(
  block: ThumbnailBlock,
  data: Record<string, unknown>,
) {
  const tune = getImageResizeTune(block, data)
  if (!tune || tune.resize !== true) {
    return null
  }

  return getNumberFromTune(tune, "resizeSize")
}

function roundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const safeRadius = Math.min(radius, width / 2, height / 2)

  context.beginPath()
  context.moveTo(x + safeRadius, y)
  context.arcTo(x + width, y, x + width, y + height, safeRadius)
  context.arcTo(x + width, y + height, x, y + height, safeRadius)
  context.arcTo(x, y + height, x, y, safeRadius)
  context.arcTo(x, y, x + width, y, safeRadius)
  context.closePath()
}

function fillRoundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  fillStyle: string,
) {
  context.fillStyle = fillStyle
  roundedRect(context, x, y, width, height, radius)
  context.fill()
}

function strokeRoundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  strokeStyle: string,
) {
  context.strokeStyle = strokeStyle
  roundedRect(context, x, y, width, height, radius)
  context.stroke()
}

function splitLongWord(
  context: CanvasRenderingContext2D,
  word: string,
  maxWidth: number,
) {
  const chunks: string[] = []
  let current = ""

  for (const character of word) {
    const next = `${current}${character}`
    if (current && context.measureText(next).width > maxWidth) {
      chunks.push(current)
      current = character
    } else {
      current = next
    }
  }

  if (current) chunks.push(current)
  return chunks
}

function wrapText(
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines = Number.POSITIVE_INFINITY,
) {
  const normalized = text.replace(/\s+/g, " ").trim()
  if (!normalized) return []

  const words = normalized.split(" ")
  const lines: string[] = []
  let currentLine = ""

  for (const word of words) {
    const candidates =
      context.measureText(word).width > maxWidth
        ? splitLongWord(context, word, maxWidth)
        : [word]

    for (const candidate of candidates) {
      const nextLine = currentLine ? `${currentLine} ${candidate}` : candidate

      if (currentLine && context.measureText(nextLine).width > maxWidth) {
        lines.push(currentLine)
        currentLine = candidate
      } else {
        currentLine = nextLine
      }

      if (lines.length >= maxLines) {
        return lines
      }
    }
  }

  if (currentLine && lines.length < maxLines) {
    lines.push(currentLine)
  }

  return lines
}

function drawLines({
  context,
  lines,
  x,
  y,
  lineHeight,
  maxY,
}: {
  context: CanvasRenderingContext2D
  lines: string[]
  x: number
  y: number
  lineHeight: number
  maxY: number
}) {
  let nextY = y

  for (const line of lines) {
    if (nextY > maxY) return nextY
    context.fillText(line, x, nextY)
    nextY += lineHeight
  }

  return nextY
}

function loadImage(url: string) {
  return new Promise<HTMLImageElement | null>((resolve) => {
    const image = new Image()
    const timeout = window.setTimeout(() => resolve(null), 1400)

    image.onload = () => {
      window.clearTimeout(timeout)
      resolve(image)
    }
    image.onerror = () => {
      window.clearTimeout(timeout)
      resolve(null)
    }

    if (!url.startsWith("data:") && !url.startsWith("blob:")) {
      image.crossOrigin = "anonymous"
    }

    image.src = url
  })
}

function getContainedImageSize(
  image: HTMLImageElement,
  width: number,
  height: number,
) {
  const ratio = Math.min(width / image.width, height / image.height)
  return {
    width: image.width * ratio,
    height: image.height * ratio,
  }
}

function drawImageContain(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const { width: drawWidth, height: drawHeight } = getContainedImageSize(
    image,
    width,
    height,
  )
  const drawX = x + (width - drawWidth) / 2
  const drawY = y + (height - drawHeight) / 2

  context.drawImage(image, drawX, drawY, drawWidth, drawHeight)
}

function drawImagePlaceholder(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  fillRoundedRect(context, x, y, width, height, 10, "#f8fafc")
  strokeRoundedRect(context, x, y, width, height, 10, "#e2e8f0")

  context.fillStyle = "#94a3b8"
  context.font = "600 11px Arial, sans-serif"
  context.fillText("Image", x + 16, y + height / 2 + 4)
}

async function drawBlock(
  context: CanvasRenderingContext2D,
  block: ThumbnailBlock,
  bounds: DrawBounds,
  maxY: number,
) {
  const data = block.data ?? {}

  if (bounds.y > maxY) return bounds.y

  switch (block.type) {
    case "header": {
      const level = typeof data.level === "number" ? data.level : 2
      const fontSize = level <= 1 ? 36 : level === 2 ? 28 : 22
      const lineHeight = Math.round(fontSize * 1.28)

      context.fillStyle = "#0f172a"
      context.font = `700 ${fontSize}px Arial, sans-serif`

      const lines = wrapText(
        context,
        decodeText(data.text),
        bounds.width,
        level <= 2 ? 2 : 3,
      )

      const nextY = drawLines({
        context,
        lines,
        x: bounds.x,
        y: bounds.y + fontSize,
        lineHeight,
        maxY,
      })

      return nextY + 14
    }

    case "list": {
      const items = Array.isArray(data.items) ? data.items : []
      const style = typeof data.style === "string" ? data.style : "unordered"
      let nextY = bounds.y + 18

      context.fillStyle = "#334155"
      context.font = "400 16px Arial, sans-serif"

      for (const [index, item] of items.entries()) {
        if (nextY > maxY) break

        const prefix =
          style === "ordered"
            ? `${index + 1}.`
            : style === "checklist"
              ? (item as { meta?: { checked?: boolean } })?.meta?.checked
                ? "[x]"
                : "[ ]"
              : "•"
        const lines = wrapText(
          context,
          getListItemText(item),
          bounds.width - 34,
        )

        context.fillStyle = "#64748b"
        context.fillText(prefix, bounds.x, nextY)
        context.fillStyle = "#334155"
        nextY = drawLines({
          context,
          lines,
          x: bounds.x + 34,
          y: nextY,
          lineHeight: 28,
          maxY,
        })
        nextY += 6
      }

      return nextY + 10
    }

    case "quote": {
      const text = decodeText(data.text)
      const lines = wrapText(context, text, bounds.width - 24)

      context.fillStyle = "#cbd5e1"
      context.fillRect(bounds.x, bounds.y + 6, 4, lines.length * 28 + 10)
      context.fillStyle = "#475569"
      context.font = "italic 400 16px Arial, sans-serif"

      const nextY = drawLines({
        context,
        lines,
        x: bounds.x + 22,
        y: bounds.y + 24,
        lineHeight: 28,
        maxY,
      })

      return nextY + 16
    }

    case "code": {
      const code = decodeText(data.code).split("\n").slice(0, 4)
      const height = Math.min(122, code.length * 24 + 34)

      fillRoundedRect(
        context,
        bounds.x,
        bounds.y,
        bounds.width,
        height,
        12,
        "#f1f5f9",
      )

      context.fillStyle = "#334155"
      context.font = "400 14px Menlo, Monaco, Consolas, monospace"

      let nextY = bounds.y + 30
      for (const line of code) {
        context.fillText(line.slice(0, 78), bounds.x + 12, nextY)
        nextY += 24
      }

      return bounds.y + height + 18
    }

    case "delimiter": {
      context.fillStyle = "#cbd5e1"
      context.fillRect(
        bounds.x + bounds.width * 0.35,
        bounds.y + 18,
        bounds.width * 0.3,
        2,
      )
      return bounds.y + 44
    }

    case "image": {
      const url = getImageUrl(data)
      const resizeWidth = getImageResizeWidth(block, data)
      const stretched = getImageFlag(data, "stretched")
      const withBorder = getImageFlag(data, "withBorder")
      const withBackground = getImageFlag(data, "withBackground")
      const frameWidth = stretched
        ? bounds.width
        : Math.min(bounds.width, resizeWidth ?? bounds.width)
      const frameX = bounds.x
      const padding = withBackground ? 34 : withBorder ? 12 : 0

      if (url) {
        const image = await loadImage(url)

        if (image) {
          const availableImageWidth = Math.max(24, frameWidth - padding * 2)
          const imageScale =
            stretched || resizeWidth
              ? availableImageWidth / image.width
              : Math.min(1, availableImageWidth / image.width)
          const imageHeight = Math.max(72, image.height * imageScale)
          const height = Math.min(520, imageHeight + padding * 2)

          fillRoundedRect(
            context,
            frameX,
            bounds.y,
            frameWidth,
            height,
            14,
            withBackground || withBorder ? "#f8fafc" : "#ffffff",
          )
          if (withBorder || withBackground) {
            strokeRoundedRect(
              context,
              frameX,
              bounds.y,
              frameWidth,
              height,
              14,
              "#e2e8f0",
            )
          }
          drawImageContain(
            context,
            image,
            frameX + padding,
            bounds.y + padding,
            frameWidth - padding * 2,
            height - padding * 2,
          )
          return bounds.y + height + 20
        } else {
          const height = Math.max(96, Math.min(180, frameWidth * 0.56))
          drawImagePlaceholder(context, frameX, bounds.y, frameWidth, height)
          return bounds.y + height + 20
        }
      } else {
        const height = Math.max(96, Math.min(180, frameWidth * 0.56))
        drawImagePlaceholder(context, frameX, bounds.y, frameWidth, height)
        return bounds.y + height + 20
      }
    }

    case "columns": {
      const columns = Array.isArray(data.columns)
        ? data.columns.slice(0, 2)
        : []
      if (!columns.length) return bounds.y

      const gap = 32
      const columnWidth = (bounds.width - gap) / 2
      const startY = bounds.y
      const nextYs = await Promise.all(
        columns.map((column, index) => {
          const columnBlocks =
            column &&
            typeof column === "object" &&
            Array.isArray((column as { blocks?: unknown }).blocks)
              ? ((column as { blocks: ThumbnailBlock[] }).blocks ?? [])
              : []

          return drawBlocks(context, columnBlocks, {
            x: bounds.x + index * (columnWidth + gap),
            y: startY,
            width: columnWidth,
          })
        }),
      )

      return Math.max(...nextYs, startY) + 16
    }

    case "paragraph":
    default: {
      const text = decodeText(data.text)
      if (!text) return bounds.y + 4

      context.fillStyle = "#334155"
      context.font = "400 16px Arial, sans-serif"

      const nextY = drawLines({
        context,
        lines: wrapText(context, text, bounds.width),
        x: bounds.x,
        y: bounds.y + 18,
        lineHeight: 28,
        maxY,
      })

      return nextY + 14
    }
  }
}

async function drawBlocks(
  context: CanvasRenderingContext2D,
  blocks: ThumbnailBlock[],
  bounds: DrawBounds,
) {
  const maxY = RENDER_HEIGHT - EDITOR_MARGIN_TOP
  let nextY = bounds.y

  for (const block of blocks) {
    nextY = await drawBlock(context, block, { ...bounds, y: nextY }, maxY)
    if (nextY > maxY) break
  }

  return nextY
}

function createThumbnailCanvas() {
  const canvas = document.createElement("canvas")
  canvas.width = THUMBNAIL_WIDTH * CANVAS_SCALE
  canvas.height = THUMBNAIL_HEIGHT * CANVAS_SCALE
  canvas.style.width = `${THUMBNAIL_WIDTH}px`
  canvas.style.height = `${THUMBNAIL_HEIGHT}px`

  const context = canvas.getContext("2d")
  if (!context) {
    throw new Error("썸네일 캔버스를 만들 수 없습니다.")
  }

  context.scale(CANVAS_SCALE * RENDER_SCALE, CANVAS_SCALE * RENDER_SCALE)
  return { canvas, context }
}

function drawThumbnailPageBase(context: CanvasRenderingContext2D) {
  context.fillStyle = "#ffffff"
  context.fillRect(0, 0, RENDER_WIDTH, RENDER_HEIGHT)
  context.strokeStyle = "#e2e8f0"
  context.lineWidth = 2
  context.strokeRect(1, 1, RENDER_WIDTH - 2, RENDER_HEIGHT - 2)
}

function canvasToJpegBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("썸네일 이미지를 만들 수 없습니다."))
          return
        }

        resolve(blob)
      },
      "image/jpeg",
      0.86,
    )
  })
}

function arrayBufferToHex(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
}

async function createThumbnailSignature(blob: Blob) {
  const digest = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer())
  return `sha256:${arrayBufferToHex(digest)}`
}

async function createThumbnailArtifact(canvas: HTMLCanvasElement) {
  const blob = await canvasToJpegBlob(canvas)
  const dataUrl = canvas.toDataURL("image/jpeg", 0.86)
  const signature = await createThumbnailSignature(blob)
  const file = new File([blob], "document-thumbnail.jpg", {
    type: "image/jpeg",
    lastModified: Date.now(),
  })

  return {
    dataUrl,
    blob,
    file,
    signature,
  }
}

export function getBlankDocumentThumbnailDataUrl() {
  if (blankDocumentThumbnailDataUrl) {
    return blankDocumentThumbnailDataUrl
  }

  if (typeof document === "undefined") {
    return undefined
  }

  const { canvas, context } = createThumbnailCanvas()
  drawThumbnailPageBase(context)
  blankDocumentThumbnailDataUrl = canvas.toDataURL("image/jpeg", 0.86)
  return blankDocumentThumbnailDataUrl
}

export async function generateDocumentThumbnailArtifact({
  blocks,
}: {
  blocks: unknown[]
}): Promise<DocumentThumbnailArtifact | undefined> {
  if (typeof document === "undefined") {
    return undefined
  }

  const { canvas, context } = createThumbnailCanvas()
  const renderableBlocks = blocks.filter(
    (block): block is ThumbnailBlock =>
      Boolean(block) &&
      typeof block === "object" &&
      typeof (block as ThumbnailBlock).type === "string" &&
      typeof (block as ThumbnailBlock).data === "object",
  )

  drawThumbnailPageBase(context)

  if (renderableBlocks.length) {
    await drawBlocks(context, renderableBlocks, {
      x: EDITOR_MARGIN_X,
      y: EDITOR_MARGIN_TOP,
      width: EDITOR_CONTENT_WIDTH,
    })
  } else {
    context.fillStyle = "#94a3b8"
    context.font = "500 16px Arial, sans-serif"
    context.fillText(
      "내용이 없습니다.",
      EDITOR_MARGIN_X,
      EDITOR_MARGIN_TOP + 24,
    )
  }

  return createThumbnailArtifact(canvas)
}
