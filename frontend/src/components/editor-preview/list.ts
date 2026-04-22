import { normalizeVisibleText } from "./text"

export type ListStyle = "ordered" | "unordered" | "checklist"

export function normalizeListStyle(value: unknown): ListStyle {
  return value === "ordered" || value === "unordered" || value === "checklist"
    ? value
    : "unordered"
}

function normalizeListItemText(value: unknown): string {
  return normalizeVisibleText(value).trim()
}

export function getListItemText(item: unknown): string {
  if (typeof item === "string") {
    return normalizeListItemText(item)
  }

  if (item && typeof item === "object") {
    const record = item as Record<string, unknown>
    return normalizeListItemText(record.content ?? record.text ?? record.value)
  }

  return normalizeListItemText(item)
}

export function getListItemChildren(item: unknown): unknown[] {
  if (!item || typeof item !== "object") {
    return []
  }

  const children = (item as Record<string, unknown>).items
  return Array.isArray(children) ? children : []
}

export function getListItemChecked(item: unknown): boolean {
  if (!item || typeof item !== "object") {
    return false
  }

  const record = item as Record<string, unknown>
  if (typeof record.checked === "boolean") {
    return record.checked
  }

  const meta = record.meta
  return Boolean(
    meta &&
      typeof meta === "object" &&
      (meta as Record<string, unknown>).checked,
  )
}
