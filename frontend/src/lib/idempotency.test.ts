import assert from "node:assert/strict"
import test from "node:test"

import {
  getCreateOperationErrorCode,
  IdempotencyKeyStore,
  shouldClearIdempotencyKey,
} from "./idempotency.ts"

test("같은 생성 payload를 재시도하면 같은 멱등 키를 반환한다", () => {
  const keys = ["operation-1", "operation-2"]
  const store = new IdempotencyKeyStore(() => keys.shift() ?? "unexpected")

  const first = store.acquire("commit", { title: "첫 기록", blocks: [1, 2] })
  const retried = store.acquire("commit", { title: "첫 기록", blocks: [1, 2] })

  assert.equal(first, "operation-1")
  assert.equal(retried, "operation-1")
})

test("payload가 바뀌거나 완료된 작업은 새 멱등 키를 반환한다", () => {
  const keys = ["operation-1", "operation-2", "operation-3"]
  const store = new IdempotencyKeyStore(() => keys.shift() ?? "unexpected")

  assert.equal(store.acquire("branch", { name: "feature-a" }), "operation-1")
  assert.equal(store.acquire("branch", { name: "feature-b" }), "operation-2")

  store.clear("branch")

  assert.equal(store.acquire("branch", { name: "feature-b" }), "operation-3")
})

test("취소된 작업만 다음 사용자 재시도 전에 멱등 키를 폐기한다", () => {
  assert.equal(shouldClearIdempotencyKey("CREATE_OPERATION_CANCELLED"), true)
  assert.equal(shouldClearIdempotencyKey("CREATE_OPERATION_IN_PROGRESS"), false)
  assert.equal(shouldClearIdempotencyKey(undefined), false)
})

test("백엔드 오류 응답에서 생성 작업 오류 코드를 읽는다", async () => {
  const error = {
    response: new Response(
      JSON.stringify({ error: "CREATE_OPERATION_CANCELLED" }),
      { headers: { "Content-Type": "application/json" }, status: 409 },
    ),
  }

  assert.equal(
    await getCreateOperationErrorCode(error),
    "CREATE_OPERATION_CANCELLED",
  )
})
