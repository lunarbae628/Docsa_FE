const COLUMNS_REGION_BASE = 100_000
const COLUMN_STRIDE = 10_000
const BLOCK_STRIDE = 100
export const VISUAL_BLOCK_REGION_INDEX = 0
export const COLUMNS_LAYOUT_REGION_INDEX = 99

export function columnsRegionIndex(
  columnIndex: number,
  blockIndex: number,
  regionIndex: number,
) {
  return (
    COLUMNS_REGION_BASE +
    columnIndex * COLUMN_STRIDE +
    blockIndex * BLOCK_STRIDE +
    regionIndex
  )
}
