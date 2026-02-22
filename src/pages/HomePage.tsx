import { useState } from 'react';
import { BookOpen, Plus, LogOut, Shield, Cloud, Settings } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useBooks } from '@/hooks/useProjects';
import { useAuth } from '@/hooks/useAuth';
import SakuraParticles from '@/components/anime/SakuraParticles';
import SparkleEffect from '@/components/anime/SparkleEffect';
import Button from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import ProjectList from '@/features/projects/ProjectList';
import CreateProjectModal from '@/features/projects/CreateProjectModal';

function SkeletonBook() {
  return (
    <div className="flex flex-col items-center">
      <div className="book-3d book-3d-skeleton">
        <div className="book-3d-inner">
          <div className="book-cover" />
          <div className="book-spine" />
          <div className="book-pages" />
          <div className="book-bottom" />
        </div>
      </div>
      <div className="mt-3 space-y-1.5 flex flex-col items-center">
        <div className="h-4 bg-gray-200 rounded w-24 animate-pulse" />
        <div className="h-3 bg-gray-100 rounded-full w-14 animate-pulse" />
      </div>
    </div>
  );
}

export default function HomePage() {
  const { books, loading } = useBooks();
  const { displayName, email, isAdmin, logout } = useAuth();
  const navigate = useNavigate();
  const [showCreateModal, setShowCreateModal] = useState(false);

  const createButton = (
    <Button variant="primary" size="lg" onClick={() => setShowCreateModal(true)}>
      <Plus size={20} />
      Create New Book
    </Button>
  );

  return (
    <div className="relative min-h-screen bookshop-bg">
      <SakuraParticles />

      {/* User bar */}
      <div className="relative z-10 flex items-center justify-end gap-3 px-6 pt-4">
        <div className="flex items-center gap-2 bg-surface/80 backdrop-blur-sm rounded-full px-4 py-2 shadow-sm border border-primary/10">
          <Cloud size={14} className="text-green-500" />
          <span className="text-xs text-indigo/40 hidden sm:inline">OneDrive connected</span>
          <div className="w-px h-4 bg-indigo/10 mx-1" />
          {isAdmin && <Shield size={12} className="text-primary" />}
          <span className="text-sm font-medium text-indigo/70">{displayName}</span>
          <span className="text-xs text-indigo/30 hidden md:inline">({email})</span>
          <button
            type="button"
            onClick={() => navigate('/settings')}
            className="ml-1 p-1.5 rounded-full text-indigo/20 hover:text-indigo/60 hover:bg-indigo/5 transition-colors cursor-pointer"
            title="Settings"
          >
            <Settings size={14} />
          </button>
          <button
            type="button"
            onClick={logout}
            className="p-1.5 rounded-full text-indigo/20 hover:text-indigo/60 hover:bg-indigo/5 transition-colors cursor-pointer"
            title="Sign out"
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>

      <div className="relative z-10 flex flex-col items-center px-6 py-8">
        {/* Header */}
        <div className="text-center mb-10">
          <SparkleEffect>
            <h1 className="font-heading text-4xl text-primary">Lofi Books</h1>
          </SparkleEffect>
          <p className="text-secondary font-medium mt-2">Your Cozy Story Studio</p>
          <p className="text-xs mt-1 opacity-40 font-handwriting text-lg">&#9749; chill vibes, great stories</p>
        </div>

        {/* Content */}
        <div className="w-full max-w-5xl">
          {loading ? (
            <div className="flex flex-wrap justify-center gap-8">
              <SkeletonBook />
              <SkeletonBook />
              <SkeletonBook />
            </div>
          ) : books.length === 0 ? (
            <EmptyState
              icon={BookOpen}
              title="No Books Yet!"
              description="Start your first story adventure!"
              action={createButton}
            />
          ) : (
            <>
              <ProjectList books={books} />
              <div className="flex justify-center mt-10">{createButton}</div>
            </>
          )}
        </div>
      </div>

      <CreateProjectModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
      />
    </div>
  );
}
