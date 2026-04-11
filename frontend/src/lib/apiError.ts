const GENERIC_RESPONSE_ERROR_MESSAGE = "Response returned an error code"

type ErrorWithResponse = {
  response?: Response
  message?: string
  cause?: unknown
}

function pickMessageFromBody(body: unknown) {
  if (!body || typeof body !== "object") return null

  const candidate = body as {
    message?: unknown
    detail?: unknown
    title?: unknown
    error?: unknown
  }

  for (const value of [
    candidate.message,
    candidate.detail,
    candidate.title,
    candidate.error,
  ]) {
    if (typeof value === "string" && value.trim()) {
      return value
    }
  }

  return null
}

async function readResponseMessage(response: Response) {
  try {
    const contentType = response.headers.get("content-type") ?? ""

    if (contentType.includes("application/json")) {
      const body = await response.clone().json()
      return pickMessageFromBody(body)
    }

    const text = await response.clone().text()
    return text.trim() || null
  } catch {
    return null
  }
}

export async function getApiErrorMessage(error: unknown, fallback: string) {
  const errorWithResponse = error as ErrorWithResponse

  if (errorWithResponse?.response instanceof Response) {
    const responseMessage = await readResponseMessage(errorWithResponse.response)
    if (responseMessage) return responseMessage
  }

  if (error instanceof Error && error.message !== GENERIC_RESPONSE_ERROR_MESSAGE) {
    return error.message
  }

  if (errorWithResponse?.cause instanceof Error && errorWithResponse.cause.message) {
    return errorWithResponse.cause.message
  }

  return fallback
}
