import { useMemo, type ReactNode } from "react";

interface Sparkle {
  id: number;
  top: string;
  left: string;
  size: number;
  color: string;
  delay: string;
  duration: string;
}

const SPARKLE_COLORS = ["#D4A76A", "#B8CFA8", "#C4836A", "#8BAEC4", "#D4C4B0"];

function StarSVG({ size, color }: { size: number; color: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={color}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M12 0L14.59 8.41L23 12L14.59 15.59L12 24L9.41 15.59L1 12L9.41 8.41L12 0Z" />
    </svg>
  );
}

interface SparkleEffectProps {
  children: ReactNode;
  count?: number;
}

export default function SparkleEffect({
  children,
  count = 4,
}: SparkleEffectProps) {
  const sparkles = useMemo<Sparkle[]>(() => {
    const num = Math.max(3, Math.min(count, 5)); // clamp 3-5
    return Array.from({ length: num }, (_, i) => ({
      id: i,
      top: `${Math.random() * 80 + 5}%`,
      left: `${Math.random() * 80 + 5}%`,
      size: 8 + Math.random() * 10, // 8-18px
      color: SPARKLE_COLORS[i % SPARKLE_COLORS.length],
      delay: `${i * 0.6}s`,
      duration: `${1.5 + Math.random() * 1}s`, // 1.5-2.5s
    }));
  }, [count]);

  return (
    <div className="relative inline-block">
      {children}
      {sparkles.map((sparkle) => (
        <span
          key={sparkle.id}
          className="sparkle"
          style={{
            top: sparkle.top,
            left: sparkle.left,
            animationDelay: sparkle.delay,
            animationDuration: sparkle.duration,
          }}
        >
          <StarSVG size={sparkle.size} color={sparkle.color} />
        </span>
      ))}
    </div>
  );
}
