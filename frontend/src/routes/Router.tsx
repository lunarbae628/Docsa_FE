import { BrowserRouter, Route, Routes } from "react-router"
import { ProtectedRoute } from "@/components/ProtectedRoute"
import ForgotPasswordPage from "@/pages/ForgotPasswordPage"
import DocumentWorkspacePage from "@/pages/DocumentWorkspacePage"
import DocumentsPage from "@/pages/DocumentsPage"
import LoginPage from "@/pages/LoginPage"
import SignupPage from "@/pages/SignupPage"
import LandingConceptDemoPage from "@/pages/LandingConceptDemoPage"
import PageLayout from "../layouts/PageLayout"

export const Router = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingConceptDemoPage />} />
        <Route path="/demo/landing-concept" element={<LandingConceptDemoPage />} />
        <Route element={<PageLayout />}>
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route
            path="/documents"
            element={
              <ProtectedRoute>
                <DocumentsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/documents/:id"
            element={
              <ProtectedRoute>
                <DocumentWorkspacePage />
              </ProtectedRoute>
            }
          />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
