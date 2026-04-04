import { BrowserRouter, Route, Routes } from "react-router"
import { ProtectedRoute } from "@/components/ProtectedRoute"
import ForgotPasswordPage from "@/pages/ForgotPasswordPage"
import DocumentDetailPage from "@/pages/DocumentDetailPage"
import DocumentsPage from "@/pages/DocumentsPage"
import HomePage from "../pages/HomePage"
import LoginPage from "@/pages/LoginPage"
import MergePage from "@/pages/MergePage"
import SignupPage from "@/pages/SignupPage"
import WorkingSaveDemoPage from "@/pages/WorkingSaveDemoPage"
import LandingConceptDemoPage from "@/pages/LandingConceptDemoPage"
import PageLayout from "../layouts/PageLayout"

export const Router = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/demo/working-save-flow" element={<WorkingSaveDemoPage />} />
        <Route path="/demo/landing-concept" element={<LandingConceptDemoPage />} />
        <Route path="/" element={<PageLayout />}>
          <Route index element={<HomePage />} />
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
                <DocumentDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/merge"
            element={
              <ProtectedRoute>
                <MergePage />
              </ProtectedRoute>
            }
          />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
