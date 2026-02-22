import { useState, useEffect, useMemo, useCallback } from 'react'
import { Outlet, useLocation } from 'react-router'
import { Menu, X } from 'lucide-react'
import Sidebar from './Sidebar'
import WritingToolsPanel from '@/features/tools/WritingToolsPanel'
import { WritingToolsContext } from './WritingToolsContext'
import type { ChapterContext } from './WritingToolsContext'

const COLLAPSED_KEY = 'sidebar-collapsed'

export default function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [toolsOpen, setToolsOpen] = useState(false)
  const [chapterCtx, setChapterCtx] = useState<ChapterContext | null>(null)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try { return localStorage.getItem(COLLAPSED_KEY) === 'true' } catch { return false }
  })
  const location = useLocation()

  // Hide sidebar entirely on the reader page (full-screen reading experience)
  const isReaderPage = location.pathname.includes('/read')

  // Close sidebar when navigating on mobile/tablet
  useEffect(() => {
    setSidebarOpen(false)
  }, [location.pathname])

  const toggleCollapse = useCallback(() => {
    setSidebarCollapsed((prev) => {
      const next = !prev
      try { localStorage.setItem(COLLAPSED_KEY, String(next)) } catch { /* ignore */ }
      return next
    })
  }, [])

  const writingToolsCtx = useMemo(() => ({
    openWritingTools: (ctx?: ChapterContext) => {
      setChapterCtx(ctx ?? null)
      setToolsOpen(true)
    },
    chapterContext: chapterCtx,
  }), [chapterCtx])

  return (
    <WritingToolsContext.Provider value={writingToolsCtx}>
      <div className="flex min-h-screen relative">
        {/* Hamburger button — visible on screens < 1024px, hidden on reader */}
        {!isReaderPage && (
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
        )}

        {/* Backdrop overlay — visible when sidebar open on < 1024px */}
        {sidebarOpen && !isReaderPage && (
          <div
            className="fixed inset-0 z-[45] bg-black/30 backdrop-blur-sm lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar — always visible on lg+, hidden on reader page */}
        {!isReaderPage && (
          <div
            className={`
              fixed top-0 left-0 h-full z-[50]
              transition-transform duration-300 ease-in-out
              lg:relative lg:translate-x-0 lg:transition-none
              ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
            `}
          >
            <Sidebar collapsed={sidebarCollapsed} onToggleCollapse={toggleCollapse} />
          </div>
        )}

        {/* Main content */}
        <main className="flex-1 overflow-auto bookshop-bg min-w-0 h-screen">
          <Outlet />
        </main>

        {/* Writing Tools slide-out panel */}
        <WritingToolsPanel open={toolsOpen} onClose={() => setToolsOpen(false)} chapterContext={chapterCtx} />
      </div>
    </WritingToolsContext.Provider>
  )
}
