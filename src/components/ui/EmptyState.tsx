import type { ReactNode, ElementType } from "react";
import type { LucideProps } from "lucide-react";

interface EmptyStateProps {
  icon: ElementType<LucideProps>;
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}

export default function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className = "",
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-4 py-16 px-6 text-center ${className}`}
    >
      <Icon size={48} className="text-primary/30" strokeWidth={1.5} />
      <div className="flex flex-col gap-1">
        <h3 className="font-heading text-lg text-indigo font-semibold">
          {title}
        </h3>
        <p className="text-indigo/50 text-sm max-w-xs">
          {description}
        </p>
      </div>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
