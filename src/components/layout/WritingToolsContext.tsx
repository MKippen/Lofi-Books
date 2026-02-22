import { createContext, useContext } from 'react'

export interface ChapterContext {
  chapterId: string
  title: string
  content: string
  wordCount: number
}

interface WritingToolsContextValue {
  openWritingTools: (chapterContext?: ChapterContext) => void
  chapterContext: ChapterContext | null
}

export const WritingToolsContext = createContext<WritingToolsContextValue>({
  openWritingTools: () => {},
  chapterContext: null,
})

export function useWritingTools() {
  return useContext(WritingToolsContext)
}
