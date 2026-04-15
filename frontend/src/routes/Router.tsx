import { ProtectedRoute } from "@/components/ProtectedRoute"
import DocumentWorkspacePage from "@/pages/DocumentWorkspacePage"
import DocumentsPage from "@/pages/DocumentsPage"
import ForgotPasswordPage from "@/pages/ForgotPasswordPage"
import LandingConceptDemoPage from "@/pages/LandingConceptDemoPage"
import LoginPage from "@/pages/LoginPage"
import PreviewFixturePage from "@/pages/PreviewFixturePage"
import SignupPage from "@/pages/SignupPage"
import { BrowserRouter, Route, Routes } from "react-router"
import PageLayout from "../layouts/PageLayout"

export const Router = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingConceptDemoPage />} />
        <Route path="/preview-fixture" element={<PreviewFixturePage />} />
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
