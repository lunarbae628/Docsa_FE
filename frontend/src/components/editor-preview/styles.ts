import type { PreviewSide } from "./types"

export function sideTone(side: PreviewSide, selected?: boolean) {
  if (side === "left") {
    return selected
      ? "text-rose-900 decoration-rose-300"
      : "text-rose-700 decoration-rose-200 hover:decoration-rose-300"
  }

  return selected
    ? "text-emerald-900 decoration-emerald-300"
    : "text-emerald-700 decoration-emerald-200 hover:decoration-emerald-300"
}

export function blockTone(side: PreviewSide, selected?: boolean) {
  if (side === "left") {
    return selected
      ? "border-rose-200 bg-rose-50/80"
      : "border-rose-100 bg-rose-50/45"
  }

  return selected
    ? "border-emerald-200 bg-emerald-50/80"
    : "border-emerald-100 bg-emerald-50/45"
}
