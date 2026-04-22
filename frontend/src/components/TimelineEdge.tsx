import { BaseEdge, getBezierPath, type EdgeProps } from "reactflow"

export default function TimelineEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  data,
}: EdgeProps) {
  const [path] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    curvature: 0.28,
  })

  return (
    <BaseEdge
      id={id}
      path={path}
      style={{
        stroke: style?.stroke ?? "#94a3b8",
        strokeWidth: style?.strokeWidth ?? 2.5,
        strokeDasharray: data?.dashed ? "7 7" : undefined,
        opacity: 0.95,
      }}
    />
  )
}
