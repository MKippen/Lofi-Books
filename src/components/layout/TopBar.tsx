import type { ReactNode } from 'react'

interface TopBarProps {
  title: string
  children?: ReactNode
}

export default function TopBar({ title, children }: TopBarProps) {
  return (
    <header className="sticky top-0 z-10 flex items-center justify-between border-b border-primary/10 bg-surface/80 pl-14 pr-4 sm:px-8 py-4 backdrop-blur-sm lg:pl-8">
      <h1 className="font-heading text-xl sm:text-2xl text-indigo truncate">{title}</h1>
      {children && <div className="flex items-center gap-3">{children}</div>}
    </header>
  )
}
