import {
  AuthApi,
  BASE_PATH,
  BranchAPIApi,
  CommitAPIApi,
  Configuration,
  DocumentAPIApi,
  MergeAPIApi,
  SaveAPIApi,
  UserAPIApi,
} from "./__generated__"

export const BACKEND_API = import.meta.env.VITE_BACKEND_API

export interface ImageUploadUrlRequest {
  docId: number
  originalFileName: string
  contentType: string
  size: number
}

export interface ImageUploadUrlResponse {
  imageId: number
  objectKey: string
  uploadUrl: string
  method: string
  expiresInSeconds: number
}

export interface ImageUploadCompleteResponse {
  imageId: number
  objectKey: string
  imageUrl: string
  contentType: string
  size: number
  status: "PENDING" | "ACTIVE" | "FAILED"
}

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

async function fetchBackendJson<T>(
  path: string,
  init: RequestInit,
  fallbackErrorMessage: string,
): Promise<T> {
  const response = await fetch(`${apiBasePath}${path}`, {
    credentials: "include",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  })

  if (!response.ok) {
    throw new Error(await parseApiError(response, fallbackErrorMessage))
  }

  return response.json() as Promise<T>
}

const imageApi = {
  createUploadUrl(request: ImageUploadUrlRequest) {
    return fetchBackendJson<ImageUploadUrlResponse>(
      "/api/images/upload-url",
      {
        method: "POST",
        body: JSON.stringify(request),
      },
      "이미지 업로드 URL 생성에 실패했습니다.",
    )
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
  completeUpload(imageId: number) {
    return fetchBackendJson<ImageUploadCompleteResponse>(
      `/api/images/${imageId}/complete`,
      {
        method: "POST",
      },
      "이미지 업로드 완료 처리에 실패했습니다.",
    )
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
  // 새로운 init 객체 생성
  const newInit = {
    ...init,
    // headers,
  }

  // 원래의 fetch 함수 호출
  return fetch(url, newInit)
}

// API 클라이언트 설정
const config = new Configuration({
  basePath: BACKEND_API, // "http://localhost:8080",
  credentials: "include",
  fetchApi: customFetch,
})

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
