import { useQuery } from "@tanstack/react-query"
import { apiClient } from "@/api/apiClient"

export type SnapshotKind = "commit" | "workspace"

interface UseSnapshotContentParams {
  documentId: number
  kind: SnapshotKind | null
  id: number | null
  enabled?: boolean
}

export function useSnapshotContent({
  documentId,
  kind,
  id,
  enabled = true,
}: UseSnapshotContentParams) {
  return useQuery({
    queryKey: ["snapshotContent", documentId, kind, id],
    enabled: enabled && !!documentId && !!kind && !!id,
    queryFn: async () => {
      if (!kind || !id) {
        return []
      }

      if (kind === "workspace") {
        const response = await apiClient.save.getSave({
          docId: documentId,
          saveId: id,
        })
        return (response.content ?? []) as Array<{ [key: string]: any }>
      }

      const response = await apiClient.commit.getCommit({
        docId: documentId,
        commitId: id,
      })
      return (response.content ?? []) as Array<{ [key: string]: any }>
    },
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  })
}
