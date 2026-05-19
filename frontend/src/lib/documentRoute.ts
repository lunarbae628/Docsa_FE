type DocumentRouteSource = {
  id?: number
  recentSaveId?: number
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

  if (document.recentSaveId) {
    return `/documents/${documentId}?mode=save&saveId=${document.recentSaveId}`
  }

  if (recentType === "SAVE" && recentTypeId) {
    return `/documents/${documentId}?mode=save&saveId=${recentTypeId}`
  }

  if (recentType === "COMMIT" && recentTypeId) {
    return `/documents/${documentId}?mode=commit&commitId=${recentTypeId}`
  }

  return `/documents/${documentId}`
}
