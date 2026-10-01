import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useParams } from 'react-router-dom';
import { GameScreen } from '../components/GameScreen';
import { useLocale, useLocalePath } from '../hooks/useLocaleRoute';
import { formatDate } from '../i18n/format';
import { dailyPuzzleId, dateKey } from '../logic/daily';
import { DIFFICULTIES, type Difficulty } from '../logic/types';
import { useSeo } from '../seo/useSeo';
import { gameStore } from '../store/gameStore';
import { startDailyGame, startNewGame } from '../store/puzzleSource';

const isDifficulty = (v: unknown): v is Difficulty => DIFFICULTIES.includes(v as Difficulty);
const unfinished = (status: string) => status === 'playing' || status === 'paused';

/** /:lang/play/:difficulty — the difficulty's landing page; continues a saved game of that difficulty or starts one. */
export function PlayPage() {
  const { difficulty } = useParams();
  const { t } = useTranslation();
  const path = useLocalePath();
  const valid = isDifficulty(difficulty);
  const d = valid ? difficulty : 'easy';
  useSeo({ title: t(`landing.${d}.title`), description: t(`landing.${d}.description`) });

  useEffect(() => {
    if (!valid) return;
    const g = gameStore.getState().game;
    const current = g && unfinished(g.status) && !g.puzzle.id.startsWith('daily-') && g.puzzle.difficulty === difficulty;
    if (!current) void startNewGame(difficulty);
  }, [valid, difficulty]);

  if (!valid) return <Navigate to={path()} replace />;
  return <GameScreen heading={t(`landing.${d}.heading`)} intro={t(`landing.${d}.intro`)} />;
}

/** /:lang/daily/:date — the puzzle of a given (past or current) day. */
export function DailyPlayPage() {
  const { date } = useParams();
  const { t } = useTranslation();
  const locale = useLocale();
  const path = useLocalePath();
  const valid = typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) && date <= dateKey();
  const label = valid ? formatDate(new Date(`${date}T12:00:00`), locale, { day: 'numeric', month: 'long', year: 'numeric' }) : '';
  // One page per day would flood search results; the calendar page is the indexed one.
  useSeo({ title: t('seo.dailyPlay.title', { date: label }), description: t('seo.daily.description'), noindex: true });

  useEffect(() => {
    if (!valid) return;
    if (gameStore.getState().game?.puzzle.id !== dailyPuzzleId(date)) void startDailyGame(date);
  }, [valid, date]);

  if (!valid) return <Navigate to={path('/daily')} replace />;
  return <GameScreen heading={t('seo.dailyPlay.title', { date: label })} />;
}
