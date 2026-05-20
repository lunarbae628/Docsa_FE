import type { QueryClient } from "@tanstack/react-query"

type CachedDocument = {
  id?: number
  title?: string
  updatedAt?: Date | string
}

type CachedDocumentPage = {
  content?: CachedDocument[]
  totalElements?: number
  numberOfElements?: number
  empty?: boolean
}

function isDocumentPage(value: unknown): value is CachedDocumentPage {
  return (
    typeof value === "object" &&
    value !== null &&
    Array.isArray((value as CachedDocumentPage).content)
  )
}

export function updateDocumentTitleInCache({
  queryClient,
  docId,
  title,
  updatedAt,
}: {
  queryClient: QueryClient
  docId: number
  title: string
  updatedAt?: Date | string
}) {
  queryClient.setQueriesData<CachedDocumentPage>(
    { queryKey: ["documents"] },
    (oldData) => {
      if (!isDocumentPage(oldData)) {
        return oldData
      }

      let changed = false
      const content = oldData.content?.map((document) => {
        if (document.id !== docId) {
          return document
        }

        changed = true
        return {
          ...document,
          title,
          updatedAt: updatedAt ?? document.updatedAt,
        }
      })

      return changed ? { ...oldData, content } : oldData
    },
  )
}

export function removeDocumentFromCache({
  queryClient,
  docId,
}: {
  queryClient: QueryClient
  docId: number
}) {
  queryClient.setQueriesData<CachedDocumentPage>(
    { queryKey: ["documents"] },
    (oldData) => {
      if (!isDocumentPage(oldData)) {
        return oldData
      }

      const content = oldData.content?.filter((document) => document.id !== docId)
      if (content?.length === oldData.content?.length) {
        return oldData
      }

      return {
        ...oldData,
        content,
        totalElements:
          typeof oldData.totalElements === "number"
            ? Math.max(0, oldData.totalElements - 1)
            : oldData.totalElements,
        numberOfElements: content?.length,
        empty: content?.length === 0,
      }
    },
  )
}
