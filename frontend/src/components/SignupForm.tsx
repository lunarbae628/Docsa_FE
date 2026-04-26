import { useState, useEffect } from "react"
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Eye,
  EyeOff,
  Mail,
  User,
  Lock,
  Shield,
  CheckCircle,
} from "lucide-react"
import { apiClient } from "@/api/apiClient"
import { CodeCheckRequestTypeEnum } from "@/api/__generated__"
import { getApiErrorMessage } from "@/lib/apiError"

const signupSchema = z
  .object({
    name: z.string().min(2, "이름은 최소 2자 이상이어야 합니다"),
    email: z.string().email("올바른 이메일 주소를 입력해주세요"),
    verificationCode: z
      .string()
      .min(6, "인증코드는 6자리입니다")
      .max(6, "인증코드는 6자리입니다"),
    password: z
      .string()
      .min(8, "비밀번호는 최소 8자 이상이어야 합니다")
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
        "비밀번호는 대소문자와 숫자를 포함해야 합니다",
      ),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "비밀번호가 일치하지 않습니다",
    path: ["confirmPassword"],
  })

type SignupFormData = z.infer<typeof signupSchema>

export default function SignupForm({
  onSuccess,
}: {
  onSuccess: () => void
}) {
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isCodeSent, setIsCodeSent] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isCodeVerified, setIsCodeVerified] = useState(false)
  const [verifiedPassCode, setVerifiedPassCode] = useState("")

  // 재발송 타이머 상태 (5분 = 300초)
  const [resendTimer, setResendTimer] = useState(0)
  const [canResend, setCanResend] = useState(true)

  // Dialog states
  const [showDialog, setShowDialog] = useState(false)
  const [dialogContent, setDialogContent] = useState({
    title: "",
    description: "",
    type: "info" as "info" | "success" | "error",
  })

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    trigger,
    setError,
  } = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    mode: "onChange",
  })

  const email = watch("email")
  const verificationCode = watch("verificationCode")

  // 재발송 타이머 관리
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null

    if (resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer((prev) => {
          if (prev <= 1) {
            setCanResend(true)
            return 0
          }
          return prev - 1
        })
      }, 1000)
    }

    return () => {
      if (interval) {
        clearInterval(interval)
      }
    }
  }, [resendTimer])

  // 타이머 포맷팅 함수 (mm:ss 형식)
  const formatTimer = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes.toString().padStart(2, "0")}:${remainingSeconds.toString().padStart(2, "0")}`
  }

  // 인증코드 확인
  const verifyCode = async () => {
    const isCodeValid = await trigger("verificationCode")
    if (!isCodeValid || !verificationCode || !email) return

    setIsLoading(true)
    try {
      console.log("인증코드 확인:", { email, code: verificationCode })

      const response = await apiClient.auth.checkCode({
        codeCheckRequest: {
          email: email,
          code: verificationCode,
          type: CodeCheckRequestTypeEnum.Signup,
        },
      })

      setIsCodeVerified(true)
      setVerifiedPassCode(response.passCode || "")
      setDialogContent({
        title: "인증 완료",
        description: "이메일 인증이 완료되었습니다!",
        type: "info",
      })
      setShowDialog(true)
    } catch (error) {
      console.error("인증코드 확인 실패:", error)
      const message = await getApiErrorMessage(
        error,
        "인증코드가 올바르지 않습니다. 다시 시도해주세요.",
      )
      setError("verificationCode", {
        message,
      })
      setDialogContent({
        title: "인증 실패",
        description: message,
        type: "error",
      })
      setShowDialog(true)
    } finally {
      setIsLoading(false)
    }
  }

  const onSubmit = async (data: SignupFormData) => {
    if (!isCodeVerified) {
      setError("verificationCode", {
        message: "먼저 인증코드를 확인해주세요.",
      })
      return
    }

    setIsLoading(true)
    try {
      // 회원가입 로직 구현

      await apiClient.user.signup({
        userSignupRequest: {
          email: data.email,
          password: data.password,
          name: data.name,
          passCode: verifiedPassCode,
        },
      })

      setDialogContent({
        title: "회원가입 완료",
        description: "회원가입이 완료되었습니다!",
        type: "success",
      })
      setShowDialog(true)
    } catch (error) {
      console.error("회원가입 실패:", error)
      setDialogContent({
        title: "회원가입 실패",
        description: await getApiErrorMessage(
          error,
          "회원가입에 실패했습니다. 다시 시도해주세요.",
        ),
        type: "error",
      })
      setShowDialog(true)
    } finally {
      setIsLoading(false)
    }
  }

  const sendVerificationCode = async () => {
    const isEmailValid = await trigger("email")
    if (!isEmailValid || !email || !canResend) return

    setIsLoading(true)
    try {
      // 인증코드 발송 로직
      console.log("인증코드 발송:", email)

      const response = await apiClient.auth.sendSignupCode({
        signupCodeRequest: {
          email: email,
        },
      })
      console.log("인증코드 발송 응답:", response)

      setIsCodeSent(true)
      setCanResend(false)
      setResendTimer(300)

      setDialogContent({
        title: "인증코드 발송",
        description: "인증코드가 발송되었습니다!",
        type: "info",
      })
      setShowDialog(true)
    } catch (error) {
      console.error("인증코드 발송 실패:", error)
      setDialogContent({
        title: "인증코드 발송 실패",
        description: await getApiErrorMessage(
          error,
          "인증코드 발송에 실패했습니다. 다시 시도해주세요.",
        ),
        type: "error",
      })
      setShowDialog(true)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDialogClose = () => {
    setShowDialog(false)
    if (dialogContent.type === "success") {
      onSuccess()
    }
  }

  return (
    <>
      <div className="h-full bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-xl border-0 bg-white/80 backdrop-blur-sm">
          <CardHeader className="space-y-1 text-center pb-8">
            <CardTitle className="text-3xl font-bold text-slate-800">
              회원가입
            </CardTitle>
            <CardDescription className="text-base text-slate-600">
              새로운 계정을 만들어보세요
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {/* 이름 입력 */}
              <div className="space-y-2">
                <Label
                  htmlFor="name"
                  className="text-base font-medium text-slate-700"
                >
                  이름
                </Label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <Input
                    id="name"
                    type="text"
                    placeholder="이름을 입력해주세요"
                    className="pl-10 h-12 border-slate-200 focus:border-blue-500 focus:ring-blue-500 text-base"
                    {...register("name")}
                  />
                </div>
                {errors.name && (
                  <Alert className="py-2 border-red-200 bg-red-50">
                    <AlertDescription className="text-red-600 text-base">
                      {errors.name.message}
                    </AlertDescription>
                  </Alert>
                )}
              </div>

              {/* 이메일 입력 */}
              <div className="space-y-2">
                <Label
                  htmlFor="email"
                  className="text-base font-medium text-slate-700"
                >
                  이메일
                </Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="이메일을 입력해주세요"
                      className="pl-10 h-12 border-slate-200 focus:border-blue-500 focus:ring-blue-500 text-base"
                      {...register("email")}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={sendVerificationCode}
                    disabled={
                      isLoading || !email || !!errors.email || !canResend
                    }
                    className="h-12 px-4 border-slate-200 hover:bg-slate-50 bg-transparent text-base whitespace-nowrap"
                  >
                    {!verifiedPassCode && !canResend && resendTimer > 0
                      ? `${formatTimer(resendTimer)}`
                      : isCodeSent
                        ? "재발송"
                        : "인증"}
                  </Button>
                </div>
                {errors.email && (
                  <Alert className="py-2 border-red-200 bg-red-50">
                    <AlertDescription className="text-red-600 text-base">
                      {errors.email.message}
                    </AlertDescription>
                  </Alert>
                )}
              </div>

              {/* 인증코드 입력 */}
              <div className="space-y-2">
                <Label
                  htmlFor="verificationCode"
                  className="text-base font-medium text-slate-700"
                >
                  인증코드
                </Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Shield className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                    <Input
                      id="verificationCode"
                      type="text"
                      placeholder="6자리 인증코드를 입력해주세요"
                      maxLength={6}
                      className="pl-10 h-12 border-slate-200 focus:border-blue-500 focus:ring-blue-500 text-base"
                      {...register("verificationCode")}
                    />
                  </div>
                  <Button
                    type="button"
                    onClick={verifyCode}
                    disabled={
                      isLoading || !verificationCode || !email || isCodeVerified
                    }
                    className="h-12 px-4 border-slate-200 hover:bg-slate-50 bg-transparent text-base whitespace-nowrap"
                    variant={isCodeVerified ? "default" : "outline"}
                  >
                    {isCodeVerified
                      ? "✓ 확인됨"
                      : isLoading
                        ? "확인 중..."
                        : "인증 확인"}
                  </Button>
                </div>
                {errors.verificationCode && (
                  <Alert className="py-2 border-red-200 bg-red-50">
                    <AlertDescription className="text-red-600 text-base">
                      {errors.verificationCode.message}
                    </AlertDescription>
                  </Alert>
                )}

                {/* 재발송 안내 메시지 */}
                {!verifiedPassCode &&
                  isCodeSent &&
                  !canResend &&
                  resendTimer > 0 && (
                    <div className="text-sm text-slate-500 bg-slate-50 p-2 rounded-md">
                      재발송은 {formatTimer(resendTimer)} 후에 가능합니다
                    </div>
                  )}

                {isCodeSent && canResend && (
                  <div className="text-sm text-green-600 bg-green-50 p-2 rounded-md">
                    인증코드를 재발송할 수 있습니다
                  </div>
                )}

                {/* 인증 완료 메시지 */}
                {isCodeVerified && (
                  <div className="text-sm text-green-600 bg-green-50 p-2 rounded-md">
                    ✓ 이메일 인증이 완료되었습니다
                  </div>
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
                    className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
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

              {/* 비밀번호 확인 */}
              <div className="space-y-2">
                <Label
                  htmlFor="confirmPassword"
                  className="text-base font-medium text-slate-700"
                >
                  비밀번호 확인
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="비밀번호를 다시 입력해주세요"
                    className="pl-10 pr-10 h-12 border-slate-200 focus:border-blue-500 focus:ring-blue-500 text-base"
                    {...register("confirmPassword")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                {errors.confirmPassword && (
                  <Alert className="py-2 border-red-200 bg-red-50">
                    <AlertDescription className="text-red-600 text-base">
                      {errors.confirmPassword.message}
                    </AlertDescription>
                  </Alert>
                )}
              </div>

              {/* 회원가입 버튼 */}
              <Button
                type="submit"
                disabled={isLoading}
                className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-medium mt-6 text-base"
              >
                {isLoading ? "처리중..." : "회원가입"}
              </Button>
            </form>

            {/* 로그인 링크 */}
            <div className="text-center pt-4 border-t border-slate-200">
              <p className="text-base text-slate-600">
                이미 계정이 있으신가요?{" "}
                <a
                  href="/login"
                  className="text-blue-600 hover:text-blue-700 font-medium text-base"
                >
                  로그인
                </a>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Success/Info Dialog */}
      <Dialog open={showDialog} onOpenChange={handleDialogClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <CheckCircle
                className={`h-5 w-5 ${
                  dialogContent.type === "success"
                    ? "text-green-600"
                    : dialogContent.type === "error"
                      ? "text-red-600"
                      : "text-blue-600"
                }`}
              />
              <DialogTitle className="text-lg font-semibold">
                {dialogContent.title}
              </DialogTitle>
            </div>
            <DialogDescription className="text-base text-slate-600">
              {dialogContent.description}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={handleDialogClose} className="w-full">
              확인
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
