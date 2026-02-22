import type { ReactNode, HTMLAttributes } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  hover?: boolean;
}

export default function Card({
  children,
  className = "",
  onClick,
  hover = false,
  ...rest
}: CardProps) {
  return (
    <div
      onClick={onClick}
      className={`
        rounded-2xl bg-surface shadow-md
        border border-primary/10
        ${hover ? "hover:-translate-y-1 hover:shadow-xl hover:border-primary/30 transition-all duration-200" : ""}
        ${onClick ? "cursor-pointer" : ""}
        ${className}
      `}
      {...rest}
    >
      {children}
    </div>
  );
}
