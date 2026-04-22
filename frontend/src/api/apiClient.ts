import {
  AuthApi,
  BASE_PATH,
  BranchAPIApi,
  CommitAPIApi,
  Configuration,
  DocumentAPIApi,
  ImageAPIApi,
  MergeAPIApi,
  ResponseError,
  SaveAPIApi,
  UserAPIApi,
} from "./__generated__"
import type {
  ImageUploadCompleteResponse,
  ImageUploadUrlRequest,
  ImageUploadUrlResponse,
} from "./__generated__"

export const BACKEND_API = import.meta.env.VITE_BACKEND_API

const apiBasePath = (BACKEND_API || BASE_PATH).replace(/\/+$/, "")

async function parseApiError(response: Response, fallback: string) {
  try {
    const contentType = response.headers.get("content-type") ?? ""

    if (contentType.includes("application/json")) {
      const body = (await response.clone().json()) as {
        message?: unknown
        detail?: unknown
        title?: unknown
        error?: unknown
      }
      for (const value of [body.message, body.detail, body.title, body.error]) {
        if (typeof value === "string" && value.trim()) {
          return value
        }
      }
    }

    const text = await response.clone().text()
    return text.trim() || fallback
  } catch {
    return fallback
  }
}

async function toReadableApiError(
  error: unknown,
  fallbackErrorMessage: string,
): Promise<Error> {
  if (error instanceof ResponseError) {
    return new Error(await parseApiError(error.response, fallbackErrorMessage))
  }

  if (error instanceof Error && error.message.trim()) {
    return error
  }

  return new Error(fallbackErrorMessage)
}

function assertUploadUrlResponse(
  response: ImageUploadUrlResponse,
): asserts response is ImageUploadUrlResponse & {
  imageId: number
  objectKey: string
  uploadUrl: string
  method: string
} {
  if (
    typeof response.imageId !== "number" ||
    typeof response.objectKey !== "string" ||
    typeof response.uploadUrl !== "string" ||
    typeof response.method !== "string"
  ) {
    throw new Error("이미지 업로드 응답이 올바르지 않습니다.")
  }
}

function assertUploadCompleteResponse(
  response: ImageUploadCompleteResponse,
): asserts response is ImageUploadCompleteResponse & {
  imageId: number
  objectKey: string
  imageUrl: string
  contentType: string
  size: number
} {
  if (
    typeof response.imageId !== "number" ||
    typeof response.objectKey !== "string" ||
    typeof response.imageUrl !== "string" ||
    typeof response.contentType !== "string" ||
    typeof response.size !== "number"
  ) {
    throw new Error("이미지 업로드 완료 응답이 올바르지 않습니다.")
  }
}

const imageApi = {
  async createUploadUrl(request: ImageUploadUrlRequest) {
    try {
      const response = await generatedImageApi.createUploadUrl({
        imageUploadUrlRequest: request,
      })
      assertUploadUrlResponse(response)
      return response
    } catch (error) {
      throw await toReadableApiError(
        error,
        "이미지 업로드 URL 생성에 실패했습니다.",
      )
    }
  },
  async uploadToPresignedUrl(uploadUrl: string, file: File, method = "PUT") {
    const response = await fetch(uploadUrl, {
      method,
      credentials: "omit",
      headers: {
        "Content-Type": file.type,
      },
      body: file,
    })

    if (!response.ok) {
      throw new Error("이미지 파일 업로드에 실패했습니다.")
    }
  },
  async completeUpload(imageId: number) {
    try {
      const response = await generatedImageApi.complete({
        imageId,
      })
      assertUploadCompleteResponse(response)
      return response
    } catch (error) {
      throw await toReadableApiError(
        error,
        "이미지 업로드 완료 처리에 실패했습니다.",
      )
    }
  },
  async uploadEditorImage({
    docId,
    file,
  }: {
    docId: number
    file: File
  }) {
    const upload = await imageApi.createUploadUrl({
      docId,
      originalFileName: file.name || "image",
      contentType: file.type,
      size: file.size,
    })

    await imageApi.uploadToPresignedUrl(upload.uploadUrl, file, upload.method)
    return imageApi.completeUpload(upload.imageId)
  },
}

const customFetch = async (url: string, init?: RequestInit) => {
  return fetch(url, init)
}

const config = new Configuration({
  basePath: apiBasePath,
  credentials: "include",
  fetchApi: customFetch,
})

const generatedImageApi = new ImageAPIApi(config)

// 모든 API 클라이언트를 하나의 객체로 통합
export const apiClient = {
  auth: new AuthApi(config),
  user: new UserAPIApi(config),
  branch: new BranchAPIApi(config),
  commit: new CommitAPIApi(config),
  document: new DocumentAPIApi(config),
  image: imageApi,
  merge: new MergeAPIApi(config),
  save: new SaveAPIApi(config),
}
