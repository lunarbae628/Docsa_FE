import LoginForm from "@/components/LoginForm"
import { useNavigate } from "react-router"
import { useAuth } from "@/hooks/useAuth"

export default function LoginPage() {
  const navigate = useNavigate()
  const { checkSession } = useAuth()

  const handleSuccess = async (user: { id: number; email: string }) => {
    // 로그인 성공 후 세션을 다시 체크하여 인증 상태 업데이트
    await checkSession()

    navigate("/documents", { replace: true })
  }

  return <LoginForm onSuccess={handleSuccess} />
}
