import { useEffect, useState } from 'react';

// Decorative 3D scene for the home hero: a tilted, floating Sudoku board with digits rising
// off it, and spinning digit cubes. Pure CSS 3D (see .scene/.board3d/.cube in index.css), so
// it costs no JavaScript per frame and stops for prefers-reduced-motion.

const BOARD = '530070000600195000098000060800060003400803001700020006060000280000419005000080079';
/** Cells that rise off the board, with staggered timing. */
const POPS: Record<number, string> = { 2: '0s', 22: '0.9s', 40: '1.8s', 48: '2.7s', 70: '3.6s' };
const POP_DIGITS: Record<number, string> = { 2: '4', 22: '2', 40: '5', 48: '9', 70: '3' };
/** The 3×3 box drawn as "selected". */
const isHighlighted = (i: number) => Math.floor(i / 27) === 1 && Math.floor((i % 9) / 3) === 1;

function Cube({ faces, className, size, spin, delay }: { faces: string; className: string; size: string; spin: string; delay: string }) {
  return (
    <div className={`cube-float ${className}`} style={{ ['--delay' as string]: delay }}>
      <div className="cube" style={{ ['--s' as string]: size, ['--spin' as string]: spin }}>
        {[...faces].map((d, i) => (
          <span key={i}>{d}</span>
        ))}
      </div>
    </div>
  );
}

export function HeroScene() {
  // Animations start once the page is idle, so they don't compete with the first render.
  const [live, setLive] = useState(false);
  useEffect(() => {
    const start = () => setLive(true);
    if (typeof requestIdleCallback === 'function') {
      const id = requestIdleCallback(start, { timeout: 2000 });
      return () => cancelIdleCallback(id);
    }
    const id = setTimeout(start, 1200);
    return () => clearTimeout(id);
  }, []);

  return (
    <div
      aria-hidden="true"
      dir="ltr"
      className={`scene relative mx-auto aspect-square w-full max-w-[19rem] select-none sm:max-w-[30rem] ${live ? 'is-live' : ''}`}
    >
      {/* A radial gradient rather than a blur filter: blurs are costly to paint on slow devices. */}
      <div className="scene-glow absolute inset-0" />
      <div className="board3d grid grid-cols-9 overflow-visible p-2">
        {[...BOARD].map((ch, i) => {
          const pop = POPS[i];
          const digit = pop ? POP_DIGITS[i] : ch === '0' ? '' : ch;
          const r = Math.floor(i / 9);
          const c = i % 9;
          const border = `${c % 3 === 2 && c < 8 ? 'border-e-2 border-e-line-strong' : c < 8 ? 'border-e border-e-line' : ''} ${
            r % 3 === 2 && r < 8 ? 'border-b-2 border-b-line-strong' : r < 8 ? 'border-b border-b-line' : ''
          }`;
          return (
            <div
              key={i}
              className={`flex aspect-square items-center justify-center text-[clamp(0.6rem,2.4vw,1.05rem)] font-bold ${border} ${
                pop ? 'pop rounded-md bg-brand text-white' : isHighlighted(i) ? 'bg-cell-same text-entry' : 'text-given'
              }`}
              style={pop ? { ['--delay' as string]: pop } : undefined}
            >
              {digit}
            </div>
          );
        })}
      </div>
      <Cube faces="719534" className="start-[2%] top-[6%]" size="3.25rem" spin="14s" delay="0s" />
      <Cube faces="286147" className="end-[4%] top-[18%]" size="2.5rem" spin="18s" delay="1.2s" />
      <Cube faces="953861" className="bottom-[6%] end-[14%]" size="3.75rem" spin="22s" delay="2.4s" />
    </div>
  );
}
