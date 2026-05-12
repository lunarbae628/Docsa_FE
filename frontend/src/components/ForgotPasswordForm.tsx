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
  Shield,
  Lock,
  ArrowLeft,
  CheckCircle,
} from "lucide-react"
import { apiClient } from "@/api/apiClient"
import { CodeCheckRequestTypeEnum } from "@/api/__generated__"
import { getApiErrorMessage } from "@/lib/apiError"

const emailVerificationSchema = z.object({
  email: z.string().email("올바른 이메일 주소를 입력해주세요"),
  verificationCode: z
    .string()
    .min(6, "인증코드는 6자리입니다")
    .max(6, "인증코드는 6자리입니다"),
})

const passwordResetSchema = z
  .object({
    password: z
      .string()
      .min(8, "비밀번호는 최소 8자 이상이어야 합니다")
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
        "비밀번호는 대소문자와 숫자를 포함해야 합니다",
      ),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "비밀번호가 일치하지 않습니다",
    path: ["confirmPassword"],
  })

type EmailVerificationData = z.infer<typeof emailVerificationSchema>
type PasswordResetData = z.infer<typeof passwordResetSchema>

export default function ForgotPasswordForm({
  onSuccess,
}: {
  onSuccess: () => void
}) {
  const [step, setStep] = useState<1 | 2>(1)
  const [isCodeSent, setIsCodeSent] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [userEmail, setUserEmail] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
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

  /* ── 1단계 폼 ── */
  const emailForm = useForm<EmailVerificationData>({
    resolver: zodResolver(emailVerificationSchema),
    mode: "onChange",
  })

  /* ── 2단계 폼 ── */
  const passwordForm = useForm<PasswordResetData>({
    resolver: zodResolver(passwordResetSchema),
    mode: "onChange",
  })

  const email = emailForm.watch("email")
  const verificationCode = emailForm.watch("verificationCode")

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
    const isCodeValid = await emailForm.trigger("verificationCode")
    if (!isCodeValid || !verificationCode || !email) return

    setIsLoading(true)
    try {
      console.log("인증코드 확인:", { email, code: verificationCode })

      const response = await apiClient.auth.checkCode({
        codeCheckRequest: {
          email: email,
          code: verificationCode,
          type: CodeCheckRequestTypeEnum.ResetPassword,
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
      emailForm.setError("verificationCode", {
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

  /* 인증코드 발송 */
  const sendVerificationCode = async () => {
    const isEmailValid = await emailForm.trigger("email")
    if (!isEmailValid || !email || !canResend) return

    setIsLoading(true)
    try {
      console.log("인증코드 발송:", email)
      const response = await apiClient.auth.sendResetPwdCode({
        pwdResetCodeRequest: {
          email,
        },
      })
      console.log("인증코드 발송 응답:", response)

      // 성공 시 타이머 시작 (5분 = 300초)
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

  /* 1단계 제출 */
  const onEmailVerificationSubmit = async (data: EmailVerificationData) => {
    if (!isCodeVerified) {
      emailForm.setError("verificationCode", {
        message: "먼저 인증코드를 확인해주세요.",
      })
      return
    }

    setIsLoading(true)
    try {
      console.log("이메일 인증 데이터:", data)
      setUserEmail(data.email)

      passwordForm.reset({
        password: "",
        confirmPassword: "",
      })

      setStep(2)
    } catch {
      emailForm.setError("root", {
        message: "인증에 실패했습니다. 다시 시도해주세요.",
      })
    } finally {
      setIsLoading(false)
    }
  }

  /* 2단계 제출 */
  const onPasswordResetSubmit = async (data: PasswordResetData) => {
    setIsLoading(true)
    try {
      console.log("비밀번호 재설정:", { email: userEmail, ...data })

      await apiClient.user.resetPassword({
        passwordResetRequest: {
          email: userEmail,
          password: data.password,
          passCode: verifiedPassCode,
        },
      })

      setDialogContent({
        title: "비밀번호 변경 완료",
        description: "비밀번호가 변경되었습니다.",
        type: "success",
      })
      setShowDialog(true)
    } catch (error) {
      const message = await getApiErrorMessage(
        error,
        "비밀번호 변경에 실패했습니다. 다시 시도해주세요.",
      )
      passwordForm.setError("root", { message })
      setDialogContent({
        title: "비밀번호 변경 실패",
        description: message,
        type: "error",
      })
      setShowDialog(true)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDialogClose = () => {
    console.log("dialogContent", dialogContent)
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
            {step === 2 && (
              <button
                onClick={() => setStep(1)}
                className="absolute left-6 top-6 text-slate-400 hover:text-slate-600"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
            )}
            <CardTitle className="text-3xl font-bold text-slate-800">
              {step === 1 ? "비밀번호 찾기" : "새 비밀번호 설정"}
            </CardTitle>
            <CardDescription className="text-base text-slate-600">
              {step === 1
                ? "이메일 인증을 통해 비밀번호를 재설정하세요"
                : "새로운 비밀번호를 입력해주세요"}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {step === 1 ? (
              /* ── 1단계: 이메일 + 인증코드 ── */
              <form
                onSubmit={emailForm.handleSubmit(onEmailVerificationSubmit)}
                className="space-y-4"
              >
                {/* 전역 에러 */}
                {emailForm.formState.errors.root && (
                  <Alert className="py-3 border-red-200 bg-red-50">
                    <AlertDescription className="text-red-600 text-base">
                      {emailForm.formState.errors.root.message}
                    </AlertDescription>
                  </Alert>
                )}

                {/* 이메일 */}
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
                        {...emailForm.register("email")}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={sendVerificationCode}
                      disabled={
                        isLoading ||
                        !email ||
                        !!emailForm.formState.errors.email ||
                        !canResend
                      }
                      className="h-12 px-4 border-slate-200 hover:bg-slate-50 text-base bg-transparent whitespace-nowrap"
                    >
                      {!verifiedPassCode && !canResend && resendTimer > 0
                        ? `${formatTimer(resendTimer)}`
                        : isCodeSent
                          ? "재발송"
                          : "인증"}
                    </Button>
                  </div>
                  {emailForm.formState.errors.email && (
                    <Alert className="py-2 border-red-200 bg-red-50">
                      <AlertDescription className="text-red-600 text-base">
                        {emailForm.formState.errors.email.message}
                      </AlertDescription>
                    </Alert>
                  )}
                </div>

                {/* 인증코드 */}
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
                        autoComplete="one-time-code"
                        maxLength={6}
                        className="pl-10 h-12 border-slate-200 focus:border-blue-500 focus:ring-blue-500 text-base"
                        {...emailForm.register("verificationCode")}
                      />
                    </div>
                    <Button
                      type="button"
                      onClick={verifyCode}
                      disabled={
                        isLoading ||
                        !verificationCode ||
                        !email ||
                        isCodeVerified
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
                  {emailForm.formState.errors.verificationCode && (
                    <Alert className="py-2 border-red-200 bg-red-50">
                      <AlertDescription className="text-red-600 text-base">
                        {emailForm.formState.errors.verificationCode.message}
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

                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-medium mt-6 text-base"
                >
                  {isLoading ? "인증 중..." : "다음"}
                </Button>
              </form>
            ) : (
              /* ── 2단계: 새 비밀번호 ── */
              <form
                onSubmit={passwordForm.handleSubmit(onPasswordResetSubmit)}
                className="space-y-4"
              >
                {passwordForm.formState.errors.root && (
                  <Alert className="py-3 border-red-200 bg-red-50">
                    <AlertDescription className="text-red-600 text-base">
                      {passwordForm.formState.errors.root.message}
                    </AlertDescription>
                  </Alert>
                )}

                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <p className="text-base text-slate-600">
                    <span className="font-medium">계정:</span> {userEmail}
                  </p>
                </div>

                {/* 새 비밀번호 */}
                <div className="space-y-2">
                  <Label
                    htmlFor="password"
                    className="text-base font-medium text-slate-700"
                  >
                    새 비밀번호
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="새 비밀번호를 입력해주세요"
                      autoComplete="new-password"
                      className="pl-10 pr-10 h-12 border-slate-200 focus:border-blue-500 focus:ring-blue-500 text-base"
                      {...passwordForm.register("password")}
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
                  {passwordForm.formState.errors.password && (
                    <Alert className="py-2 border-red-200 bg-red-50">
                      <AlertDescription className="text-red-600 text-base">
                        {passwordForm.formState.errors.password.message}
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
                      {...passwordForm.register("confirmPassword")}
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setShowConfirmPassword(!showConfirmPassword)
                      }
                      className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  {passwordForm.formState.errors.confirmPassword && (
                    <Alert className="py-2 border-red-200 bg-red-50">
                      <AlertDescription className="text-red-600 text-base">
                        {passwordForm.formState.errors.confirmPassword.message}
                      </AlertDescription>
                    </Alert>
                  )}
                </div>

                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-medium mt-6 text-base"
                >
                  {isLoading ? "변경 중..." : "비밀번호 변경"}
                </Button>
              </form>
            )}

            {/* 로그인 링크 */}
            <div className="text-center pt-4 border-t border-slate-200">
              <p className="text-base text-slate-600">
                기억이 나셨나요?{" "}
                <a
                  href="/login"
                  className="text-blue-600 hover:text-blue-700 font-medium"
                >
                  로그인
                </a>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Success/Info Dialog */}
      <Dialog
        open={showDialog}
        onOpenChange={(open) => !open && handleDialogClose()}
      >
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
