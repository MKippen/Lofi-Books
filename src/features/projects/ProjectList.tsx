import type { Book } from '@/types';
import ProjectCard from './ProjectCard';

interface ProjectListProps {
  books: Book[];
}

export default function ProjectList({ books }: ProjectListProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {books.map((book) => (
        <ProjectCard key={book.id} book={book} />
      ))}
    </div>
  );
}
