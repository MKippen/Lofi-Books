import { useState, useEffect } from 'react'
import { NavLink, useParams } from 'react-router'
import { getBook } from '@/api/books'
import {
  BookOpen,
  LayoutDashboard,
  Users,
  StickyNote,
  Clock,
  BookText,
  ArrowLeft,
  Star,
  Settings,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react'

const navItems = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '' },
  { label: 'Characters', icon: Users, path: '/characters' },
  { label: 'Storyboard', icon: StickyNote, path: '/storyboard' },
  { label: 'Timeline', icon: Clock, path: '/timeline' },
  { label: 'Chapters', icon: BookText, path: '/chapters' },
  { label: 'Read Book', icon: BookOpen, path: '/read' },
]

interface SidebarProps {
  collapsed?: boolean
  onToggleCollapse?: () => void
}

export default function Sidebar({ collapsed = false, onToggleCollapse }: SidebarProps) {
  const { bookId } = useParams<{ bookId: string }>()
  const basePath = `/book/${bookId}`
  const [bookTitle, setBookTitle] = useState('My Book')

  useEffect(() => {
    if (!bookId) return
    getBook(bookId).then((book) => {
      if (book) setBookTitle(book.title)
    }).catch(() => { /* ignore */ })
  }, [bookId])

  return (
    <aside
      className={`relative flex min-h-screen flex-col text-white overflow-hidden transition-all duration-300 ease-in-out ${collapsed ? 'w-14' : 'w-60'}`}
      style={{
        background: 'linear-gradient(180deg, #2D3A2E 0%, #1F2B20 40%, #1A231B 100%)',
      }}
    >
      {/* Subtle wood grain texture overlay */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.04]"
        style={{
          backgroundImage: `repeating-linear-gradient(
            90deg,
            transparent 0px,
            transparent 3px,
            rgba(255,255,255,0.3) 3px,
            rgba(255,255,255,0.3) 4px
          )`,
        }}
      />

      {/* Decorative right border — warm matcha accent */}
      <div className="absolute right-0 top-0 h-full w-px bg-gradient-to-b from-primary/40 via-secondary/20 to-transparent" />

      {/* Logo area */}
      <div className={`relative flex items-center gap-2.5 pt-6 pb-1 ${collapsed ? 'justify-center px-2' : 'px-5'}`}>
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/20 flex-shrink-0">
          <BookOpen className="h-5 w-5 text-primary" />
        </div>
        {!collapsed && (
          <span className="font-heading text-lg tracking-wide" style={{ color: '#B8CFA8' }}>
            Lofi Books
          </span>
        )}
      </div>

      {/* Subtitle */}
      {!collapsed && (
        <div className="relative px-5 pb-4 pt-0.5">
          <p className="truncate text-xs font-body" style={{ color: 'rgba(184, 207, 168, 0.4)' }}>
            {bookTitle}
          </p>
        </div>
      )}

      {/* Divider with leaf motif */}
      {!collapsed && (
        <div className="relative mx-4 mb-2 flex items-center gap-2">
          <div className="flex-1 border-t border-white/[0.06]" />
          <span className="text-[10px] opacity-30">&#127811;</span>
          <div className="flex-1 border-t border-white/[0.06]" />
        </div>
      )}
      {collapsed && <div className="mx-2 mb-2 mt-2 border-t border-white/[0.06]" />}

      {/* Navigation */}
      <nav className={`relative flex flex-1 flex-col gap-0.5 py-2 ${collapsed ? 'px-1.5 items-center' : 'px-3'}`}>
        {navItems.map(({ label, icon: Icon, path }) => (
          <NavLink
            key={label}
            to={`${basePath}${path}`}
            end={path === ''}
            title={collapsed ? label : undefined}
            className={({ isActive }) =>
              `flex items-center rounded-xl text-sm transition-all duration-200 ${
                collapsed
                  ? `justify-center w-10 h-10 ${
                      isActive
                        ? 'bg-primary/15 font-semibold text-primary shadow-sm'
                        : 'text-white/50 hover:bg-white/[0.06] hover:text-white/80'
                    }`
                  : `gap-3 px-4 py-2.5 ${
                      isActive
                        ? 'bg-primary/15 font-semibold text-primary shadow-sm'
                        : 'text-white/50 hover:bg-white/[0.06] hover:text-white/80'
                    }`
              }`
            }
          >
            <Icon className="h-5 w-5 flex-shrink-0" />
            {!collapsed && <span>{label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Decorative plant — hidden when collapsed */}
      {!collapsed && (
        <div className="relative px-4">
          <div className="flex items-end justify-center gap-0.5 py-3 opacity-40">
            <svg width="60" height="65" viewBox="0 0 60 65" fill="none" xmlns="http://www.w3.org/2000/svg">
              <ellipse cx="30" cy="18" rx="6" ry="14" fill="#5A8A4A" transform="rotate(-10 30 18)" opacity="0.7"/>
              <ellipse cx="22" cy="22" rx="5" ry="12" fill="#4A7A3A" transform="rotate(-30 22 22)" opacity="0.6"/>
              <ellipse cx="38" cy="20" rx="5" ry="13" fill="#6A9A5A" transform="rotate(15 38 20)" opacity="0.65"/>
              <ellipse cx="16" cy="28" rx="4" ry="10" fill="#3A6A2A" transform="rotate(-50 16 28)" opacity="0.5"/>
              <ellipse cx="42" cy="26" rx="4.5" ry="11" fill="#5A8A4A" transform="rotate(35 42 26)" opacity="0.55"/>
              <line x1="30" y1="38" x2="30" y2="28" stroke="#4A7A3A" strokeWidth="1.5" opacity="0.4"/>
              <line x1="30" y1="38" x2="22" y2="25" stroke="#4A7A3A" strokeWidth="1" opacity="0.3"/>
              <line x1="30" y1="38" x2="38" y2="24" stroke="#4A7A3A" strokeWidth="1" opacity="0.3"/>
              <path d="M20 40 L18 55 C18 58 22 60 30 60 C38 60 42 58 42 55 L40 40 Z" fill="#8B6B52" opacity="0.6"/>
              <rect x="18" y="38" width="24" height="4" rx="1" fill="#9B7B62" opacity="0.6"/>
              <path d="M22 48 Q30 50 38 48" stroke="#7A5B42" strokeWidth="0.8" fill="none" opacity="0.3"/>
            </svg>
          </div>
        </div>
      )}

      {/* Divider with star */}
      {!collapsed && (
        <div className="relative mx-4 mb-1 flex items-center gap-2">
          <div className="flex-1 border-t border-white/[0.06]" />
          <span className="text-[10px] opacity-20">&#9734;</span>
          <div className="flex-1 border-t border-white/[0.06]" />
        </div>
      )}
      {collapsed && <div className="mx-2 mb-1 border-t border-white/[0.06]" />}

      {/* Extra nav — Wish List, Settings, Back */}
      <nav className={`relative pb-2 space-y-0.5 ${collapsed ? 'px-1.5 flex flex-col items-center' : 'px-3'}`}>
        <NavLink
          to={`${basePath}/wishlist`}
          title={collapsed ? 'Wish List' : undefined}
          className={({ isActive }) =>
            `flex items-center rounded-xl text-sm transition-all duration-200 ${
              collapsed
                ? `justify-center w-10 h-10 ${
                    isActive
                      ? 'bg-warning/15 font-semibold text-warning shadow-sm'
                      : 'text-white/40 hover:bg-white/[0.06] hover:text-white/70'
                  }`
                : `gap-3 px-4 py-2.5 ${
                    isActive
                      ? 'bg-warning/15 font-semibold text-warning shadow-sm'
                      : 'text-white/40 hover:bg-white/[0.06] hover:text-white/70'
                  }`
            }`
          }
        >
          <Star className="h-5 w-5 flex-shrink-0" />
          {!collapsed && <span>Wish List</span>}
        </NavLink>
        <NavLink
          to="/settings"
          title={collapsed ? 'Settings' : undefined}
          className={`flex items-center rounded-xl text-sm text-white/30 transition-all hover:bg-white/[0.06] hover:text-white/70 ${
            collapsed ? 'justify-center w-10 h-10' : 'gap-3 px-4 py-2.5'
          }`}
        >
          <Settings className="h-5 w-5 flex-shrink-0" />
          {!collapsed && <span>Settings</span>}
        </NavLink>
        <NavLink
          to="/"
          title={collapsed ? 'Back to Books' : undefined}
          className={`flex items-center rounded-xl text-sm text-white/30 transition-all hover:bg-white/[0.06] hover:text-white/70 ${
            collapsed ? 'justify-center w-10 h-10' : 'gap-3 px-4 py-2.5'
          }`}
        >
          <ArrowLeft className="h-5 w-5 flex-shrink-0" />
          {!collapsed && <span>Back to Books</span>}
        </NavLink>
      </nav>

      {/* Collapse toggle button — only visible on desktop */}
      {onToggleCollapse && (
        <button
          type="button"
          onClick={onToggleCollapse}
          className="relative hidden lg:flex items-center justify-center py-3 text-white/25 hover:text-white/60 transition-colors cursor-pointer border-t border-white/[0.06]"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}
        </button>
      )}
    </aside>
  )
}
