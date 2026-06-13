import { Outlet } from "react-router"
import Header from "./Header"

export default function PageLayout() {
  return (
    <div className="grid h-screen grid-rows-[auto_1fr] bg-white">
      <Header />
      <main className="min-h-0 overflow-hidden bg-gradient-to-br from-slate-50 to-slate-100">
        <Outlet />
      </main>
    </div>
  )
}
