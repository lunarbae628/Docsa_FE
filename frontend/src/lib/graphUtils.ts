// 브랜치 색상 팔레트
export const COLOR_PALETTE = [
  "#10b981", // emerald
  "#f59e0b", // amber
  "#ef4444", // red
  "#8b5cf6", // violet
  "#06b6d4", // cyan
  "#84cc16", // lime
  "#f97316", // orange
  "#ec4899", // pink
  "#14b8a6", // teal
  "#a855f7", // purple
  "#22c55e", // green
  "#3b82f6", // blue
  "#f43f5e", // rose
  "#eab308", // yellow
  "#6366f1", // indigo
] as const

// 문자열을 기반으로 해시 생성
export function stringToHash(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash // Convert to 32-bit integer
  }
  return Math.abs(hash)
}

// 브랜치별 색상 생성 함수
export function getBranchColor(branchId: number): string {
  const colorIndex = Math.abs(branchId) % COLOR_PALETTE.length
  return COLOR_PALETTE[colorIndex]
}

// 그래프 레이아웃 상수
export const GRAPH_LAYOUT = {
  BRANCH_SPACING: 280,
  BASE_X_OFFSET: 80,
  BASE_Y_OFFSET: 80,
  ROW_SPACING: 190,
  WORKSPACE_OFFSET: 170,
  NODE_WIDTH: 220,
  NODE_HEIGHT: 112,
} as const
