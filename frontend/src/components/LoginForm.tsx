import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Eye, EyeOff, Mail, Lock } from "lucide-react"
import { apiClient } from "@/api/apiClient"
import { getApiErrorMessage } from "@/lib/apiError"

const loginSchema = z.object({
  email: z.string().email("올바른 이메일 주소를 입력해주세요"),
  password: z.string().min(1, "비밀번호를 입력해주세요"),
})

type LoginFormData = z.infer<typeof loginSchema>

export default function LoginForm({
  onSuccess,
}: {
  onSuccess: (user: { id: number; email: string }) => void
}) {
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    mode: "onChange",
  })

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true)
    try {
      // 로그인 로직 구현
      console.log("로그인 데이터:", data)
      const { id } = await apiClient.user.login({
        userLoginRequest: {
          email: data.email,
          password: data.password,
        },
      })

      if (!id) {
        throw new Error("로그인 실패")
      }

      onSuccess({
        id,
        email: data.email,
      })

      // 실제로는 리다이렉트 또는 상태 업데이트
    } catch (error) {
      setError("root", {
        message: await getApiErrorMessage(
          error,
          "로그인 중 오류가 발생했습니다. 다시 시도해주세요.",
        ),
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      <div className="h-full bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-xl border-0 bg-white/80 backdrop-blur-sm">
          <CardHeader className="space-y-1 text-center pb-8">
            <CardTitle className="text-3xl font-bold text-slate-800">
              로그인
            </CardTitle>
            <CardDescription className="text-base text-slate-600">
              계정에 로그인하세요
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {/* 전역 에러 메시지 */}
              {errors.root && (
                <Alert className="py-3 border-red-200 bg-red-50">
                  <AlertDescription className="text-red-600 text-base">
                    {errors.root.message}
                  </AlertDescription>
                </Alert>
              )}

              {/* 이메일 입력 */}
              <div className="space-y-2">
                <Label
                  htmlFor="email"
                  className="text-base font-medium text-slate-700"
                >
                  이메일
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="이메일을 입력해주세요"
                    className="pl-10 h-12 border-slate-200 focus:border-blue-500 focus:ring-blue-500 text-base"
                    {...register("email")}
                  />
                </div>
                {errors.email && (
                  <Alert className="py-2 border-red-200 bg-red-50">
                    <AlertDescription className="text-red-600 text-base">
                      {errors.email.message}
                    </AlertDescription>
                  </Alert>
                )}
              </div>

              {/* 비밀번호 입력 */}
              <div className="space-y-2">
                <Label
                  htmlFor="password"
                  className="text-base font-medium text-slate-700"
                >
                  비밀번호
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="비밀번호를 입력해주세요"
                    className="pl-10 pr-10 h-12 border-slate-200 focus:border-blue-500 focus:ring-blue-500 text-base"
                    {...register("password")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                {errors.password && (
                  <Alert className="py-2 border-red-200 bg-red-50">
                    <AlertDescription className="text-red-600 text-base">
                      {errors.password.message}
                    </AlertDescription>
                  </Alert>
                )}
              </div>

              {/* 로그인 유지 & 비밀번호 찾기 */}
              <div className="text-right">
                <a
                  href="/forgot-password"
                  className="text-base text-blue-600 hover:text-blue-700 transition-colors"
                >
                  비밀번호 찾기
                </a>
              </div>

              {/* 로그인 버튼 */}
              <Button
                type="submit"
                disabled={isLoading}
                className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-medium mt-6 transition-colors text-base"
              >
                {isLoading ? "로그인 중..." : "로그인"}
              </Button>
            </form>

            {/* 회원가입 링크 */}
            <div className="text-center pt-4 border-t border-slate-200">
              <p className="text-base text-slate-600">
                아직 계정이 없으신가요?{" "}
                <a
                  href="/signup"
                  className="text-blue-600 hover:text-blue-700 font-medium transition-colors text-base"
                >
                  회원가입
                </a>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
