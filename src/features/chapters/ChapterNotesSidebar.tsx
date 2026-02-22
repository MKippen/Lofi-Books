interface ChapterNotesSidebarProps {
  notes: string;
  onChange: (notes: string) => void;
}

export default function ChapterNotesSidebar({ notes, onChange }: ChapterNotesSidebarProps) {
  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-2">
        <p className="text-xs text-indigo/40">
          Private notes &ndash; won&apos;t appear in your book
        </p>
      </div>

      <textarea
        value={notes}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          // Prevent Tab from escaping to the sidebar — insert a tab instead
          if (e.key === 'Tab' && !e.shiftKey) {
            e.preventDefault();
            const ta = e.currentTarget;
            const start = ta.selectionStart;
            const end = ta.selectionEnd;
            const updated = notes.slice(0, start) + '\t' + notes.slice(end);
            onChange(updated);
            // Restore cursor position after React re-renders
            requestAnimationFrame(() => {
              ta.selectionStart = ta.selectionEnd = start + 1;
            });
          }
        }}
        placeholder="Write your notes, ideas, and reminders here..."
        className="
          flex-1 w-full px-4 py-2
          bg-transparent border-none resize-none
          focus:outline-none
          font-[Caveat] text-indigo/70 text-base leading-relaxed
          placeholder:text-indigo/30
        "
      />
    </div>
  );
}
