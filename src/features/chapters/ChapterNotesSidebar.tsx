interface ChapterNotesSidebarProps {
  notes: string;
  onChange: (notes: string) => void;
}

export default function ChapterNotesSidebar({ notes, onChange }: ChapterNotesSidebarProps) {
  return (
    <div className="w-72 bg-warning/5 border-l border-warning/20 h-full flex flex-col">
      <div className="px-3 pt-2 pb-0">
        <p className="text-xs text-indigo/40">
          Private notes &ndash; won't appear in your book
        </p>
      </div>

      <textarea
        value={notes}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Write your notes, ideas, and reminders here..."
        className="
          flex-1 w-full px-4 py-3
          bg-transparent border-none resize-none
          focus:outline-none
          font-[Caveat] text-indigo/70 text-base leading-relaxed
          placeholder:text-indigo/30
        "
      />
    </div>
  );
}
