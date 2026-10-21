"use client";

import { useEffect, useState } from "react";

interface Piece {
  left: number; // % across the screen
  size: number; // px
  delay: number; // s
  duration: number; // s
  drift: number; // px sideways
  color: string;
  round: boolean;
}

// The RCCG green, gold and red, plus white and a light blue, so it fits the poster.
const COLORS = ["#028A2C", "#E8B04A", "#D61812", "#FFFFFF", "#7E6EB8", "#F2D283"];

/**
 * Falling confetti for a winning moment. It is pure CSS (no library), is made after the
 * page loads so it never mismatches the server render, stops by itself after `seconds`,
 * and is hidden for people who ask their device for less motion.
 */
export default function Confetti({ count = 80, seconds = 14 }: { count?: number; seconds?: number }) {
  const [pieces, setPieces] = useState<Piece[]>([]);

  useEffect(() => {
    setPieces(
      Array.from({ length: count }, () => ({
        left: Math.random() * 100,
        size: 7 + Math.random() * 9,
        delay: Math.random() * 3,
        duration: 3.5 + Math.random() * 3.5,
        drift: (Math.random() - 0.5) * 160,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        round: Math.random() < 0.3,
      }))
    );
    const stop = setTimeout(() => setPieces([]), seconds * 1000);
    return () => clearTimeout(stop);
  }, [count, seconds]);

  return (
    <div className="pointer-events-none fixed inset-0 z-[70] overflow-hidden" aria-hidden="true">
      {pieces.map((p, i) => (
        <span
          key={i}
          className="confetti-piece"
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.round ? p.size : p.size * 0.5,
            background: p.color,
            borderRadius: p.round ? "9999px" : "2px",
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            ["--drift" as string]: `${p.drift}px`,
          }}
        />
      ))}
    </div>
  );
}
