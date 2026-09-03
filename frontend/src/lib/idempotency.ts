type KeyEntry = {
  fingerprint: string
  key: string
}

type ErrorWithResponse = {
  response?: Response
}

export class IdempotencyKeyStore {
  private readonly entries = new Map<string, KeyEntry>()
  private readonly createKey: () => string

  constructor(createKey: () => string = () => crypto.randomUUID()) {
    this.createKey = createKey
  }

  acquire(scope: string, payload: unknown) {
    const fingerprint = JSON.stringify(payload)
    const existing = this.entries.get(scope)
    if (existing?.fingerprint === fingerprint) {
      return existing.key
    }

    const key = this.createKey()
    this.entries.set(scope, { fingerprint, key })
    return key
  }

  clear(scope: string) {
    this.entries.delete(scope)
  }
}

export function shouldClearIdempotencyKey(errorCode: string | undefined) {
  return errorCode === "CREATE_OPERATION_CANCELLED"
}

export async function getCreateOperationErrorCode(error: unknown) {
  const response = (error as ErrorWithResponse)?.response
  if (!(response instanceof Response)) {
    return undefined
  }

  try {
    const body = (await response.clone().json()) as { error?: unknown }
    return typeof body.error === "string" ? body.error : undefined
  } catch {
    return undefined
  }
}
