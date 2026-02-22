import { useState, useEffect } from 'react'
import { Outlet, useLocation } from 'react-router'
import { Menu, X } from 'lucide-react'
import Sidebar from './Sidebar'

export default function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const location = useLocation()

  // Close sidebar when navigating on mobile/tablet
  useEffect(() => {
    setSidebarOpen(false)
  }, [location.pathname])

  return (
    <div className="flex min-h-screen relative">
      {/* Hamburger button — visible on screens < 1024px */}
      <button
        type="button"
        onClick={() => setSidebarOpen((v) => !v)}
        className="
          fixed top-3 left-3 z-[60]
          lg:hidden
          flex items-center justify-center
          w-11 h-11 rounded-xl
          bg-surface/90 backdrop-blur shadow-md border border-primary/20
          text-indigo/60 hover:text-indigo
          transition-colors cursor-pointer
        "
        aria-label="Toggle menu"
      >
        {sidebarOpen ? <X size={22} /> : <Menu size={22} />}
      </button>

      {/* Backdrop overlay — visible when sidebar open on < 1024px */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-[45] bg-black/30 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar — always visible on lg+, slide-in drawer on smaller screens */}
      <div
        className={`
          fixed top-0 left-0 h-full z-[50]
          transition-transform duration-300 ease-in-out
          lg:relative lg:translate-x-0 lg:transition-none
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <Sidebar />
      </div>

      {/* Main content */}
      <main className="flex-1 overflow-auto bookshop-bg min-w-0">
        <Outlet />
      </main>
    </div>
  )
}
