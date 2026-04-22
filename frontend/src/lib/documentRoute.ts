type DocumentRouteSource = {
  id?: number
  recent?: {
    recentType?: string
    recentTypeId?: number
  }
}

export function getDocumentWorkspacePath(document: DocumentRouteSource) {
  const documentId = document.id

  if (!documentId) {
    return "/documents"
  }

  const { recentType, recentTypeId } = document.recent ?? {}

  if (recentType === "SAVE" && recentTypeId) {
    return `/documents/${documentId}?mode=save&saveId=${recentTypeId}`
  }

  if (recentType === "COMMIT" && recentTypeId) {
    return `/documents/${documentId}?mode=commit&commitId=${recentTypeId}`
  }

  return `/documents/${documentId}`
}
