import React, { Suspense } from 'react'
import { Routes, Route } from 'react-router'
import AuthGate from './auth/AuthGate'
import BackupProvider from './providers/BackupProvider'
import AppShell from './components/layout/AppShell'

const HomePage = React.lazy(() => import('./pages/HomePage'))
const BookDashboard = React.lazy(() => import('./pages/BookDashboard'))
const CharactersPage = React.lazy(() => import('./pages/CharactersPage'))
const CharacterFullPage = React.lazy(() => import('./pages/CharacterFullPage'))
const StoryboardPage = React.lazy(() => import('./pages/StoryboardPage'))
const TimelinePage = React.lazy(() => import('./pages/TimelinePage'))
const ChaptersPage = React.lazy(() => import('./pages/ChaptersPage'))
const ChapterEditor = React.lazy(() => import('./pages/ChapterEditor'))
const ReaderPage = React.lazy(() => import('./pages/ReaderPage'))
const WishlistPage = React.lazy(() => import('./pages/WishlistPage'))
const WritingToolsPage = React.lazy(() => import('./pages/WritingToolsPage'))
const SettingsPage = React.lazy(() => import('./pages/SettingsPage'))

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-cream">
      <div className="h-12 w-12 rounded-full border-4 border-primary/30 border-t-primary animate-spin" />
    </div>
  )
}

export default function App() {
  return (
    <AuthGate>
      <BackupProvider>
        <Suspense fallback={<LoadingSpinner />}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/settings" element={<SettingsPage />} />

            <Route path="/book/:bookId" element={<AppShell />}>
              <Route index element={<BookDashboard />} />
              <Route path="characters" element={<CharactersPage />} />
              <Route path="characters/:characterId" element={<CharacterFullPage />} />
              <Route path="storyboard" element={<StoryboardPage />} />
              <Route path="timeline" element={<TimelinePage />} />
              <Route path="chapters" element={<ChaptersPage />} />
              <Route path="chapters/:chapterId" element={<ChapterEditor />} />
              <Route path="read" element={<ReaderPage />} />
              <Route path="wishlist" element={<WishlistPage />} />
              <Route path="tools" element={<WritingToolsPage />} />
            </Route>
          </Routes>
        </Suspense>
      </BackupProvider>
    </AuthGate>
  )
}
