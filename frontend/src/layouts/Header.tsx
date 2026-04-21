import { apiClient } from "@/api/apiClient"
import DocumentSidebarQuickMenu from "@/components/DocumentSidebarQuickMenu"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/hooks/useAuth"
import { Link, useLocation, useNavigate } from "react-router"
import Logo from "../components/Logo"

export default function Header() {
  const navigate = useNavigate()
  const location = useLocation()
  const { isAuthenticated, user, logout } = useAuth()
  const currentDocumentIdMatch = location.pathname.match(/^\/documents\/(\d+)/)
  const currentDocumentId = currentDocumentIdMatch
    ? Number(currentDocumentIdMatch[1])
    : null

  const isDocumentSurface =
    location.pathname.startsWith("/documents") ||
    location.pathname.startsWith("/merge") ||
    location.pathname.startsWith("/login") ||
    location.pathname.startsWith("/signup") ||
    location.pathname.startsWith("/forgot-password")

  const handleSignUp = () => {
    navigate("/signup")
  }

  const handleLogin = () => {
    navigate("/login")
  }

  const handleLogout = () => {
    logout()
    apiClient.user.logout()
    navigate("/")
  }

  return (
    <header className="w-full border-b border-slate-200/80 bg-white/90 backdrop-blur-sm">
      <div
        className={
          isDocumentSurface
            ? "mx-auto max-w-full px-4 lg:px-6"
            : "mx-auto max-w-7xl px-6 lg:px-8"
        }
      >
        <div
          className={`flex items-center justify-between ${
            isDocumentSurface ? "h-14" : "h-16"
          }`}
        >
          <Link
            to={isAuthenticated ? "/documents" : "/"}
            className="hover:opacity-80 transition-opacity"
          >
            <div className={isDocumentSurface ? "w-[152px]" : "w-[184px]"}>
              <Logo withText />
            </div>
          </Link>

          {isAuthenticated ? (
            <div className="flex items-center gap-2.5">
              {currentDocumentId ? (
                <DocumentSidebarQuickMenu
                  currentDocumentId={currentDocumentId}
                  triggerLabel="문서"
                />
              ) : null}
              {user && (
                <span
                  className={`rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm font-medium text-slate-600 ${
                    isDocumentSurface ? "hidden sm:inline-flex" : "inline-flex"
                  }`}
                >
                  {user.name}
                </span>
              )}
              <Button
                onClick={handleLogout}
                variant="outline"
                className={`border-slate-200 bg-white text-slate-700 hover:bg-slate-50 ${
                  isDocumentSurface
                    ? "h-9 rounded-full px-4 text-sm"
                    : "h-10 rounded-full px-5 text-sm"
                }`}
              >
                로그아웃
              </Button>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2.5">
                <Button
                  onClick={handleSignUp}
                  variant="outline"
                  className={`border-slate-200 bg-white text-slate-700 hover:bg-slate-50 ${
                    isDocumentSurface
                      ? "h-9 rounded-full px-4 text-sm"
                      : "h-10 rounded-full px-5 text-sm"
                  }`}
                >
                  회원가입
                </Button>
                <Button
                  onClick={handleLogin}
                  variant="outline"
                  className={`bg-slate-900 text-white hover:bg-slate-800 ${
                    isDocumentSurface
                      ? "h-9 rounded-full px-4 text-sm"
                      : "h-10 rounded-full px-5 text-sm"
                  }`}
                >
                  로그인
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
