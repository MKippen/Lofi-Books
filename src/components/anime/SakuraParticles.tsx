import { useMemo } from "react";

interface Petal {
  id: number;
  left: string;
  width: number;
  height: number;
  animationDelay: string;
  animationDuration: string;
  opacity: number;
  color: string;
}

// Lofi palette — muted greens, warm terracotta, dusty pink
const PETAL_COLORS = [
  'linear-gradient(135deg, #B8CFA8 0%, #7C9A6E 50%, #A8C49A 100%)', // matcha leaf
  'linear-gradient(135deg, #D4B5A0 0%, #C4836A 50%, #D9A890 100%)', // terracotta
  'linear-gradient(135deg, #E8D5C4 0%, #D4C4B0 50%, #E0D0C0 100%)', // warm paper
  'linear-gradient(135deg, #C4D4B8 0%, #8DB580 50%, #B0C8A0 100%)', // sage
  'linear-gradient(135deg, #B8C8D8 0%, #8BAEC4 50%, #A0BCD0 100%)', // dusty blue
];

export default function SakuraParticles() {
  const petals = useMemo<Petal[]>(() => {
    const count = 12 + Math.floor(Math.random() * 5); // 12-16 petals (slightly fewer for chill vibe)
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      width: 6 + Math.random() * 7, // 6-13px (slightly smaller)
      height: 5 + Math.random() * 5, // 5-10px
      animationDelay: `${Math.random() * 12}s`,
      animationDuration: `${10 + Math.random() * 8}s`, // 10-18s (slower, more chill)
      opacity: 0.3 + Math.random() * 0.25, // more subtle
      color: PETAL_COLORS[Math.floor(Math.random() * PETAL_COLORS.length)],
    }));
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      {petals.map((petal) => (
        <div
          key={petal.id}
          className="sakura-petal"
          style={{
            left: petal.left,
            top: "-10%",
            width: `${petal.width}px`,
            height: `${petal.height}px`,
            background: petal.color,
            borderRadius: "50% 0 50% 50%",
            opacity: petal.opacity,
            animationDelay: petal.animationDelay,
            animationDuration: petal.animationDuration,
          }}
        />
      ))}
    </div>
  );
}
