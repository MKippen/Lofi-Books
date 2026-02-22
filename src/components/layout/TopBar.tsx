import type { ReactNode } from 'react'
import { Wrench } from 'lucide-react'
import { useWritingTools } from './WritingToolsContext'

interface TopBarProps {
  title: string
  children?: ReactNode
}

export default function TopBar({ title, children }: TopBarProps) {
  const { openWritingTools } = useWritingTools()

  return (
    <header className="sticky top-0 z-10 flex items-center justify-between border-b border-primary/10 bg-surface/80 px-4 sm:px-6 lg:px-8 py-3 backdrop-blur-sm">
      <h1 className="font-heading text-xl sm:text-2xl text-indigo truncate">{title}</h1>
      <div className="flex items-center gap-3">
        {children}
        <button
          type="button"
          onClick={() => openWritingTools()}
          className="
            flex items-center justify-center
            w-9 h-9 rounded-lg
            text-indigo/30 hover:text-primary hover:bg-primary/10
            transition-all duration-200 cursor-pointer
            group
          "
          title="Writing Tools"
        >
          <Wrench size={16} className="group-hover:rotate-[-15deg] transition-transform duration-200" />
        </button>
      </div>
    </header>
  )
}
