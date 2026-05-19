import { createRoot } from "react-dom/client"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { Router } from "./routes/Router"
import { AuthProvider } from "./hooks/useAuth"
import { AlertProvider } from "./components/ui/alert"
import { DialogProvider } from "./components/ui/alert-dialog"
import "./index.css"

// QueryClient 생성
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5분
    },
    mutations: {
      retry: false,
    },
  },
})

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AlertProvider>
          <DialogProvider>
            <Router />
          </DialogProvider>
        </AlertProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}

const rootElement = document.getElementById("root")
if (rootElement) {
  createRoot(rootElement).render(<App />)
}
