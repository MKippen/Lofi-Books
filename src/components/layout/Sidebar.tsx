import { useState, useEffect } from 'react'
import { NavLink, useParams } from 'react-router'
import { db } from '@/db/database'
import { useAuth } from '@/hooks/useAuth'
import { useBackupContext } from '@/providers/BackupProvider'
import BackupStatus from '@/components/ui/BackupStatus'
import {
  BookOpen,
  LayoutDashboard,
  Users,
  StickyNote,
  Clock,
  BookText,
  ArrowLeft,
  Star,
  LogOut,
  Shield,
} from 'lucide-react'

const navItems = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '' },
  { label: 'Characters', icon: Users, path: '/characters' },
  { label: 'Storyboard', icon: StickyNote, path: '/storyboard' },
  { label: 'Timeline', icon: Clock, path: '/timeline' },
  { label: 'Chapters', icon: BookText, path: '/chapters' },
  { label: 'Read Book', icon: BookOpen, path: '/read' },
]

const extraNavItems = [
  { label: 'Wish List', icon: Star, path: '/wishlist' },
]

export default function Sidebar() {
  const { bookId } = useParams<{ bookId: string }>()
  const basePath = `/book/${bookId}`
  const [bookTitle, setBookTitle] = useState('My Book')
  const { displayName, isAdmin, logout } = useAuth()
  const { state: backupState, manualBackup } = useBackupContext()

  useEffect(() => {
    if (!bookId) return
    db.books.get(bookId).then((book) => {
      if (book) setBookTitle(book.title)
    })
  }, [bookId])

  return (
    <aside className="relative flex w-60 min-h-screen flex-col text-white overflow-hidden"
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
      <div className="relative flex items-center gap-2.5 px-5 pt-6 pb-1">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/20">
          <BookOpen className="h-5 w-5 text-primary" />
        </div>
        <span className="font-heading text-lg tracking-wide" style={{ color: '#B8CFA8' }}>
          Lofi Books
        </span>
      </div>

      {/* Subtitle */}
      <div className="relative px-5 pb-4 pt-0.5">
        <p className="truncate text-xs font-body" style={{ color: 'rgba(184, 207, 168, 0.4)' }}>
          {bookTitle}
        </p>
      </div>

      {/* Divider with leaf motif */}
      <div className="relative mx-4 mb-2 flex items-center gap-2">
        <div className="flex-1 border-t border-white/[0.06]" />
        <span className="text-[10px] opacity-30">&#127811;</span>
        <div className="flex-1 border-t border-white/[0.06]" />
      </div>

      {/* Navigation */}
      <nav className="relative flex flex-1 flex-col gap-0.5 px-3 py-2">
        {navItems.map(({ label, icon: Icon, path }) => (
          <NavLink
            key={label}
            to={`${basePath}${path}`}
            end={path === ''}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm transition-all duration-200 ${
                isActive
                  ? 'bg-primary/15 font-semibold text-primary shadow-sm'
                  : 'text-white/50 hover:bg-white/[0.06] hover:text-white/80'
              }`
            }
          >
            <Icon className="h-5 w-5" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Extra nav — Wish List */}
      <div className="relative mx-4 mb-1 mt-1 flex items-center gap-2">
        <div className="flex-1 border-t border-white/[0.06]" />
        <span className="text-[10px] opacity-20">&#9734;</span>
        <div className="flex-1 border-t border-white/[0.06]" />
      </div>
      <nav className="relative px-3 pb-2">
        {extraNavItems.map(({ label, icon: Icon, path }) => (
          <NavLink
            key={label}
            to={`${basePath}${path}`}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm transition-all duration-200 ${
                isActive
                  ? 'bg-warning/15 font-semibold text-warning shadow-sm'
                  : 'text-white/40 hover:bg-white/[0.06] hover:text-white/70'
              }`
            }
          >
            <Icon className="h-5 w-5" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Decorative plant at the bottom */}
      <div className="relative px-4 pb-2">
        <div className="flex items-end justify-center gap-0.5 py-3 opacity-40">
          {/* Plant pot */}
          <svg width="60" height="65" viewBox="0 0 60 65" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Leaves */}
            <ellipse cx="30" cy="18" rx="6" ry="14" fill="#5A8A4A" transform="rotate(-10 30 18)" opacity="0.7"/>
            <ellipse cx="22" cy="22" rx="5" ry="12" fill="#4A7A3A" transform="rotate(-30 22 22)" opacity="0.6"/>
            <ellipse cx="38" cy="20" rx="5" ry="13" fill="#6A9A5A" transform="rotate(15 38 20)" opacity="0.65"/>
            <ellipse cx="16" cy="28" rx="4" ry="10" fill="#3A6A2A" transform="rotate(-50 16 28)" opacity="0.5"/>
            <ellipse cx="42" cy="26" rx="4.5" ry="11" fill="#5A8A4A" transform="rotate(35 42 26)" opacity="0.55"/>
            {/* Stem lines */}
            <line x1="30" y1="38" x2="30" y2="28" stroke="#4A7A3A" strokeWidth="1.5" opacity="0.4"/>
            <line x1="30" y1="38" x2="22" y2="25" stroke="#4A7A3A" strokeWidth="1" opacity="0.3"/>
            <line x1="30" y1="38" x2="38" y2="24" stroke="#4A7A3A" strokeWidth="1" opacity="0.3"/>
            {/* Pot */}
            <path d="M20 40 L18 55 C18 58 22 60 30 60 C38 60 42 58 42 55 L40 40 Z" fill="#8B6B52" opacity="0.6"/>
            <rect x="18" y="38" width="24" height="4" rx="1" fill="#9B7B62" opacity="0.6"/>
            {/* Pot detail line */}
            <path d="M22 48 Q30 50 38 48" stroke="#7A5B42" strokeWidth="0.8" fill="none" opacity="0.3"/>
          </svg>
        </div>
      </div>

      {/* User info + sign out */}
      <div className="relative px-3 pb-1">
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-white/50 truncate flex items-center gap-1">
              {isAdmin && <Shield size={10} className="text-primary flex-shrink-0" />}
              {displayName}
            </p>
          </div>
          <button
            type="button"
            onClick={logout}
            className="p-1.5 rounded-lg text-white/20 hover:text-white/60 hover:bg-white/[0.06] transition-colors cursor-pointer"
            title="Sign out"
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>

      {/* OneDrive backup status */}
      <div className="relative px-3 pb-2">
        <BackupStatus state={backupState} onManualBackup={manualBackup} variant="sidebar" />
      </div>

      {/* Back to books */}
      <div className="relative px-3 pb-6">
        <NavLink
          to="/"
          className="flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm text-white/30 transition-all hover:bg-white/[0.06] hover:text-white/70"
        >
          <ArrowLeft className="h-5 w-5" />
          <span>Back to Books</span>
        </NavLink>
      </div>
    </aside>
  )
}
