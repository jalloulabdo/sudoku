# Sudoku Master — v1 Build Prompt

## Role & working rules

You are a senior React + TypeScript engineer. Build v1 of a mobile-first, offline-capable, multilingual Sudoku web app according to this spec.

- Work **one phase at a time** (section 10). At the end of each phase: run the tests and the build, then stop and report what was built, what was verified, and any deviations from this spec. Wait for approval before starting the next phase.
- When this spec is silent, choose the simplest option that satisfies it and list the decision in your phase report. Do not add features that are not listed.
- No placeholder or fake logic. If something cannot be done properly, say so instead of stubbing it.

---

## 1. Goal

A clean, fast Sudoku game in the spirit of sudoku.com (original design and branding — do not copy their assets or text). Playable fully offline after first load, available in **English, French, and Arabic**, with a hint system that teaches the logical technique instead of revealing the answer.

## 2. Out of scope for v1

Do not build these: backend / API server, accounts, global leaderboards, PostgreSQL, Redis, Killer Sudoku, time-attack mode, forcing chains / Swordfish hints, sound effects, analytics. The architecture should not block adding them later, but no code or dependencies for them now.

---

## 3. Stack (decided — do not substitute)

| Concern | Choice |
|---|---|
| Framework | React 18 + TypeScript (strict mode) |
| Build / prerender | Vite + `vite-react-ssg` (static prerendering of every route for SEO) |
| Routing | React Router (via `vite-react-ssg`) |
| State | Zustand (use selectors so a cell re-renders only when its own data changes) |
| Styling | Tailwind CSS, dark/light/system theme via `class` strategy; use **logical utilities** (`ms-*`, `me-*`, `ps-*`, `pe-*`, `start-*`, `end-*`) everywhere for RTL support |
| i18n | `i18next` + `react-i18next` |
| Icons | `lucide-react` |
| Animation | Framer Motion — only for modals and the puzzle-complete celebration |
| Persistence | `localStorage` behind a small typed storage module |
| PWA | `vite-plugin-pwa` (Workbox, `generateSW`) |
| Tests | Vitest + React Testing Library |
| Deploy target | Static hosting (Netlify / Cloudflare Pages / Vercel static) |

---

## 4. Internationalization (English, French, Arabic)

### 4.1 Languages
| Code | Language | Direction |
|---|---|---|
| `en` | English (default / fallback) | LTR |
| `fr` | Français | LTR |
| `ar` | العربية | **RTL** |

Adding a fourth language later must require only: a new JSON file + one entry in a `LOCALES` config array. No component changes.

### 4.2 Rules
- **No hard-coded user-facing strings** in components. Every string comes from `src/i18n/locales/{en,fr,ar}.json`. Use nested keys (`game.mistakes`, `hints.nakedSingle.title`) and interpolation for values (`"mistakes": "Mistakes: {{count}}/{{max}}"`), with i18next plural rules (Arabic has 6 plural forms — use them).
- **Language resolution order:** URL prefix → saved user setting → `navigator.language` → `en`.
- A **language switcher** in the header and in Settings. Switching language changes the URL prefix and persists the choice.
- On every route and language change set `<html lang="…" dir="ltr|rtl">`.
- **RTL:** the whole UI mirrors in Arabic (header, keypad layout, modals, icons that imply direction such as undo/redo arrows). **Exception:** the 9×9 grid itself is always rendered `dir="ltr"` so rows/columns and arrow-key navigation stay consistent; arrow keys move visually (Left always moves left).
- Grid digits are always Western `1–9`. Timer, stats, and dates are formatted with `Intl.NumberFormat` / `Intl.DateTimeFormat` for the active locale.
- Fonts: system font stack for Latin; include an Arabic-capable fallback (e.g. `"Noto Sans Arabic"`, self-hosted, precached by the service worker — no Google Fonts CDN, so it works offline).
- All locale files are **bundled and precached** so every language works offline.
- Hint explanations are translation keys with parameters (cell position, digit, unit), never English strings built in code. Cell positions are shown as `R3C5` in all languages (label key `common.cellRef`).
- Test: a unit test asserts all three locale files have exactly the same key set.

---

## 5. Core data model

Implement these types in `src/logic/types.ts` and use them throughout.

```ts
export type Digit = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
export type CellValue = Digit | null;
export type CellIndex = number; // 0..80, row-major: index = row * 9 + col

export type Difficulty = 'easy' | 'medium' | 'hard' | 'expert' | 'master';

export interface Puzzle {
  id: string;             // deterministic: `${difficulty}-${seed}` or `daily-YYYY-MM-DD`
  givens: CellValue[];    // length 81
  solution: Digit[];      // length 81
  difficulty: Difficulty;
  seed: number;
}

export interface CellState {
  value: CellValue;
  given: boolean;
  notes: number;          // 9-bit mask, bit (d-1) set = candidate d
}

export type Move =
  | { type: 'place'; index: CellIndex; prev: CellState; next: CellState; affected: { index: CellIndex; prevNotes: number }[] }
  | { type: 'note'; index: CellIndex; prev: CellState; next: CellState }
  | { type: 'erase'; index: CellIndex; prev: CellState; next: CellState };

export interface GameState {
  puzzle: Puzzle;
  cells: CellState[];     // length 81
  selected: CellIndex | null;
  notesMode: boolean;
  history: Move[];
  future: Move[];         // redo stack
  mistakes: number;
  elapsedMs: number;
  status: 'playing' | 'paused' | 'won' | 'lost';
  hintsUsed: number;
}
```

---

## 6. Game logic (`src/logic/`, pure TS, no React)

### 6.1 Solver — `solver.ts`
- Bitmask-based candidate tracking + backtracking with MRV (fewest candidates first).
- `solve(grid)` → solution or null.
- `countSolutions(grid, limit = 2)` → stops early at `limit`; used for uniqueness checks.

### 6.2 Techniques / hint engine — `techniques.ts`
Implement these techniques, each as a pure function `(cells) => Hint | null`, tried in this order:

1. Naked Single
2. Hidden Single
3. Pointing Pair / Triple
4. Box/Line Reduction (Claiming)
5. Naked Pair
6. Hidden Pair
7. Naked Triple
8. Hidden Triple
9. X-Wing
10. XY-Wing

```ts
export interface Hint {
  technique: TechniqueId;
  focusCells: CellIndex[];            // cells to highlight as the reason
  targetCells: CellIndex[];           // cells affected
  placement?: { index: CellIndex; digit: Digit };
  eliminations?: { index: CellIndex; digit: Digit }[];
  i18nKey: string;                    // e.g. 'hints.hiddenSingle.explain'
  i18nParams: Record<string, string | number>;
}
```

- Hint flow (2 steps): 1st press highlights `focusCells` and shows the technique name + explanation; 2nd press applies it (placement or eliminations). Increments `hintsUsed`.
- Hints work from the **true candidates** (computed from placed values), not the user's possibly-wrong notes. If the user has placed a wrong digit, the hint says so and points to it instead.
- If no listed technique applies, say so honestly (translated) and offer to reveal one cell.

### 6.3 Generator — `generator.ts`
- Seeded PRNG (e.g. mulberry32) so the same seed always yields the same puzzle.
- Generate a full valid grid, then remove givens in rotationally symmetric pairs, keeping the solution **unique** (`countSolutions === 1`) after every removal.
- **Difficulty is rated by technique, not by given count.** Rate by solving with the hint engine only:

| Difficulty | Hardest technique required | Givens (guide range) |
|---|---|---|
| Easy | Singles only | 36–45 |
| Medium | Pointing / Claiming | 30–35 |
| Hard | Naked/Hidden Pairs & Triples | 28–31 |
| Expert | X-Wing / XY-Wing | 24–29 |
| Master | Solvable only with X-Wing/XY-Wing, fewest givens reachable (target ≤ 25) | ≤ 25 |

  Reject and retry puzzles that don't match the requested difficulty, or that the hint engine cannot finish.
- Run generation in a **Web Worker** (`generator.worker.ts`) so the UI never blocks. Show a small loading state if it takes more than 150 ms.
- **Daily puzzle:** seed = hash of the `YYYY-MM-DD` date (local time), difficulty rotates by weekday. Fully client-side, so it works offline.

---

## 7. Features

### 7.1 Board
- 9×9 grid with a fixed aspect-ratio container (zero layout shift). Thicker borders between 3×3 boxes.
- On selection highlight: row, column, box, and all cells with the same digit.
- Givens visually distinct from user entries (weight + color), meeting WCAG AA contrast in both themes.
- Notes render as a 3×3 mini-grid inside the cell.

### 7.2 Input
- **Keypad:** digits 1–9 (each shows remaining count; hidden/disabled when all 9 are placed), Undo, Erase, Notes toggle, Hint.
- **Keyboard:** arrow keys move, `1–9` place/note, `Backspace`/`Delete` erase, `N` toggle notes, `Ctrl/Cmd+Z` undo, `Ctrl/Cmd+Shift+Z` or `Ctrl+Y` redo, `Space` pause.
- Placing a digit auto-removes that digit from notes in the same row/column/box (setting, default on). Undo restores those notes.
- Unlimited undo/redo. Givens cannot be edited.

### 7.3 Rules & mistakes
- A **mistake** = placing a digit that differs from the solution. The cell shows in error color; mistakes counter increments.
- Mistake limit setting: 3 (default) or off. At the limit → "Game over" modal with options: continue with a second chance (resets limit once), restart, new game.
- Conflict highlighting (same digit in row/col/box) is a separate setting, default on.
- On win: celebration animation, time, mistakes, hints used, and "new game" / "next difficulty".

### 7.4 Timer
- Accurate timer based on `performance.now()` deltas, not interval counting.
- Auto-pauses when the tab is hidden (`visibilitychange`) and when the pause modal is open; board is blurred while paused.

### 7.5 Daily challenge
- Calendar view of the current month: completed days marked, today highlighted, past days playable, future days disabled.
- Current streak and best streak. A month badge shown when every day of a month is completed.

### 7.6 Stats (local)
Per difficulty: games started, games won, win rate, best time, average time. Reset stats option with confirmation.

### 7.7 Settings
Language, theme (light/dark/system), mistake limit, conflict highlighting, same-digit highlighting, auto-remove notes, timer visible.

### 7.8 Persistence
- Save the current game, stats, daily progress, and settings to `localStorage`, versioned (`schemaVersion`) with a migration hook.
- Save on every state change (debounced 300 ms) and immediately on `visibilitychange`/`pagehide`. Resume the saved game on load.
- All storage access wrapped in try/catch; the app must work (without saving) if storage is unavailable.

---

## 8. PWA & offline

- `vite-plugin-pwa` with `registerType: 'prompt'`: show a translated "Update available — reload" toast instead of reloading mid-game.
- Precache all built assets, all locale files, fonts, and the generator worker.
- Manifest: `name`/`short_name`/`description` (English base), `display: 'standalone'`, `orientation: 'any'`, theme/background colors matching the dark theme, **separate** icons with `purpose: 'any'` (192, 512) and `purpose: 'maskable'` (512). Generate the icon files.
- `useOfflineStatus` hook + a small, dismissible, translated banner when offline ("You're offline — everything still works").

---

## 9. Routes, SEO & accessibility

### 9.1 Routes (all prerendered, for each locale prefix `/en`, `/fr`, `/ar`)
| Route | Content |
|---|---|
| `/{lang}/` | Home: continue game, new game by difficulty, daily challenge |
| `/{lang}/play/:difficulty` | Game |
| `/{lang}/daily` | Daily calendar + today's puzzle |
| `/{lang}/stats` | Stats |
| `/{lang}/how-to-play` | Rules + technique explanations (reuses hint translations) |

`/` redirects to the resolved language. Difficulty landing pages (`/{lang}/play/easy`, etc.) have unique translated `<title>`, meta description, and a short translated intro paragraph.

### 9.2 SEO
- `hreflang` alternates (`en`, `fr`, `ar`, `x-default`) and canonical URL on every page.
- JSON-LD `WebApplication` (category `GameApplication`) on every page, localized name/description.
- `sitemap.xml` and `robots.txt` generated at build, including all locale routes.

### 9.3 Accessibility
- Grid uses `role="grid"` / `row` / `gridcell`, roving `tabindex`, and an `aria-label` per cell (translated, e.g. "Row 3, column 5, empty, notes 2 4 7").
- Placement results, mistakes, and hints announced via an `aria-live` region.
- All controls reachable by keyboard; visible focus rings; touch targets ≥ 44 px.
- Respect `prefers-reduced-motion`.

### 9.4 Performance targets (mobile, Lighthouse)
LCP < 1.5 s, CLS = 0, INP < 100 ms, Lighthouse Performance/Accessibility/SEO/Best Practices ≥ 95. Initial JS < 150 KB gzipped.

---

## 10. Phases & acceptance criteria

### Phase 1 — Logic engine
`types.ts`, `solver.ts`, `techniques.ts`, `generator.ts`, worker, seeded PRNG, daily seed.
**Done when:** Vitest tests pass for: solver on known puzzles (incl. a 17-clue puzzle); `countSolutions` detects multiple solutions; each of the 10 techniques on a hand-made fixture where it's the next step; generator yields unique puzzles matching each difficulty for 20 seeds; same seed → same puzzle; generation for Expert averages < 1 s in Node.

### Phase 2 — State & persistence
Zustand store (actions: select, place, note, erase, undo, redo, hint, pause, newGame), timer, storage module with versioning.
**Done when:** store tests cover place/undo/redo (including restored auto-removed notes), mistake limit → lost, win detection, save/restore round-trip.

### Phase 3 — UI + i18n
Board, Cell, Keypad, Header, modals, settings, stats, daily calendar, theme, language switcher, en/fr/ar locale files, RTL.
**Done when:** full game playable by touch and keyboard in all 3 languages; Arabic mirrors correctly with the grid still LTR; locale key-parity test passes; no hard-coded strings (grep check); dark/light both meet AA contrast.

### Phase 4 — PWA & offline
Plugin config, icons, update toast, offline banner.
**Done when:** after one online visit, the production build (`vite preview`) loads, generates puzzles, and switches between all 3 languages with the network disabled in DevTools.

### Phase 5 — Routes, SEO, a11y polish
Prerendered locale routes, meta/hreflang/JSON-LD, sitemap, How-to-play page, accessibility pass.
**Done when:** `vite build` outputs static HTML for every route × locale with correct `lang`/`dir`, titles, and hreflang; Lighthouse targets in 9.4 are met (report the scores).

---

## 11. Folder structure

```
src/
├── logic/          types.ts, solver.ts, techniques.ts, generator.ts, generator.worker.ts, prng.ts, daily.ts
├── store/          gameStore.ts, settingsStore.ts, statsStore.ts
├── storage/        storage.ts (versioned, safe localStorage wrapper)
├── i18n/           index.ts, locales.ts (LOCALES config), locales/en.json, fr.json, ar.json
├── hooks/          useTimer.ts, useOfflineStatus.ts, useKeyboardControls.ts, useLocaleRoute.ts
├── components/     Board.tsx, Cell.tsx, Keypad.tsx, Header.tsx, LanguageSwitcher.tsx,
│                   HintPanel.tsx, OfflineBanner.tsx, UpdateToast.tsx, DailyCalendar.tsx, modals/
├── pages/          Home.tsx, Play.tsx, Daily.tsx, Stats.tsx, HowToPlay.tsx
├── seo/            Seo.tsx (title, meta, hreflang, JSON-LD)
└── main.tsx
tests/              mirrors src/logic and src/store; fixtures/ for technique puzzles
```

Start with **Phase 1** now.
