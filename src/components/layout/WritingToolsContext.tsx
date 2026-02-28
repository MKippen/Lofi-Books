import { createContext, useContext, type RefObject } from 'react'
import type { Editor } from '@tiptap/react'

export interface ChapterContext {
  chapterId: string
  title: string
  content: string
  wordCount: number
}

export type WritingToolsTab = 'dictionary' | 'thesaurus' | 'hanako' | 'proofread'

interface WritingToolsContextValue {
  openWritingTools: (chapterContext?: ChapterContext, tab?: WritingToolsTab) => void
  chapterContext: ChapterContext | null
  editorRef: RefObject<Editor | null>
}

export const WritingToolsContext = createContext<WritingToolsContextValue>({
  openWritingTools: () => {},
  chapterContext: null,
  editorRef: { current: null },
})

export function useWritingTools() {
  return useContext(WritingToolsContext)
}
