import type { Book } from '@/types';
import ProjectCard from './ProjectCard';

interface ProjectListProps {
  books: Book[];
}

export default function ProjectList({ books }: ProjectListProps) {
  return (
    <div className="flex flex-wrap justify-center gap-8">
      {books.map((book) => (
        <ProjectCard key={book.id} book={book} />
      ))}
    </div>
  );
}
