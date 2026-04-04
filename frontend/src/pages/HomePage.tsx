import { useNavigate } from "react-router"
import Logo from "../components/Logo"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/hooks/useAuth"

export default function HomePage() {
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()

  const handleGetStarted = () => {
    if (isAuthenticated) {
      navigate("/documents")
    } else {
      navigate("/signup")
    }
  }

  const handleOpenDemo = () => {
    navigate("/demo/working-save-flow")
  }

  return (
    <div className="max-w-7xl mx-auto px-6 lg:px-8">
      <div className="grid grid-cols-1 lg:grid-cols-2 items-center min-h-[calc(100vh-5rem)] gap-12">
        <div className="space-y-8">
          <div className="space-y-6">
            <div className="w-[200px]">
              <Logo withText />
            </div>

            <div className="space-y-4">
              <h1 className="text-4xl lg:text-5xl font-bold text-black leading-tight">
                이제 문서 버전 관리도
                <br />
                <span className="text-black">Docsa 와 함께</span>
              </h1>
            </div>
          </div>

          <div className="pt-4 flex flex-wrap gap-4">
            <Button
              onClick={handleGetStarted}
              className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-8 text-lg rounded-lg font-medium transition-colors"
              size="lg"
            >
              Let's Get Started
            </Button>
            <Button
              onClick={handleOpenDemo}
              variant="outline"
              className="px-8 py-8 text-lg rounded-lg font-medium"
              size="lg"
            >
              작업장 데모 보기
            </Button>
          </div>
        </div>

        <div className="flex justify-center lg:justify-end">
          <div className="relative w-full">
            <img
              src="/home-image.png"
              alt="Artistic snake illustration"
              className="w-full h-auto object-contain"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
