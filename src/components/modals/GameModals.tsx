import { m } from 'framer-motion';
import { Pause, Trophy, XCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useLocale, useLocalePath } from '../../hooks/useLocaleRoute';
import { formatTime } from '../../i18n/format';
import { DIFFICULTIES, type Difficulty } from '../../logic/types';
import { gameStore } from '../../store/gameStore';
import { useGame, useSettings, useUi } from '../../store/hooks';
import { startNewGame } from '../../store/puzzleSource';
import { uiStore } from '../../store/uiStore';
import { Modal, ModalButton } from './Modal';

/** Starts a new puzzle of `difficulty` and moves to its page. */
export function useNewGame(): (difficulty: Difficulty) => void {
  const navigate = useNavigate();
  const path = useLocalePath();
  return (difficulty) => {
    uiStore.setState({ newGameOpen: false });
    const g = gameStore.getState().game;
    if (g && (g.status === 'won' || g.status === 'lost')) gameStore.setState({ game: null, activeHint: null });
    void startNewGame(difficulty);
    navigate(path(`/play/${difficulty}`));
  };
}

export function PauseModal() {
  const { t } = useTranslation();
  const paused = useGame((s) => s.game?.status === 'paused');
  const resume = () => gameStore.getState().resume();
  return (
    <Modal open={paused} title={t('pause.title')} onClose={resume} icon={<Pause className="size-10 text-accent" aria-hidden="true" />}>
      <p className="text-muted">{t('pause.text')}</p>
      <div className="mt-5">
        <ModalButton variant="primary" onClick={resume}>
          {t('game.resume')}
        </ModalButton>
      </div>
    </Modal>
  );
}

export function GameOverModal() {
  const { t } = useTranslation();
  const lost = useGame((s) => s.game?.status === 'lost');
  const secondChanceUsed = useGame((s) => s.game?.secondChanceUsed ?? true);
  const difficulty = useGame((s) => s.game?.puzzle.difficulty ?? 'easy');
  const limit = useSettings((s) => s.mistakeLimit);
  const newGame = useNewGame();
  const s = gameStore.getState;

  return (
    <Modal open={lost} title={t('gameOver.title')} icon={<XCircle className="size-10 text-error" aria-hidden="true" />}>
      <p className="text-muted">{t('gameOver.text', { max: limit ?? 0 })}</p>
      <div className="mt-5 flex flex-col gap-2">
        {!secondChanceUsed && (
          <>
            <ModalButton variant="primary" onClick={() => s().secondChance()}>
              {t('gameOver.secondChance')}
            </ModalButton>
            <p className="mb-2 text-center text-xs text-muted">{t('gameOver.secondChanceText')}</p>
          </>
        )}
        <ModalButton onClick={() => s().restart()}>{t('gameOver.restart')}</ModalButton>
        <ModalButton onClick={() => newGame(difficulty)}>{t('gameOver.newGame')}</ModalButton>
      </div>
    </Modal>
  );
}

export function WinModal() {
  const { t } = useTranslation();
  const locale = useLocale();
  const path = useLocalePath();
  const navigate = useNavigate();
  const game = useGame((s) => (s.game?.status === 'won' ? s.game : null));
  const newGame = useNewGame();
  if (!game) return null;

  const { difficulty, id } = game.puzzle;
  const daily = id.startsWith('daily-');
  const next: Difficulty | undefined = DIFFICULTIES[DIFFICULTIES.indexOf(difficulty) + 1];
  const close = () => gameStore.setState({ game: null });

  const stats: [string, string][] = [
    [t('win.time'), formatTime(game.elapsedMs, locale)],
    [t('win.mistakes'), String(game.mistakes)],
    [t('win.hints'), String(game.hintsUsed)],
  ];

  return (
    <Modal
      open
      title={t('win.title')}
      icon={
        <m.div initial={{ scale: 0, rotate: -20 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 14 }}>
          <Trophy className="size-14 text-accent" aria-hidden="true" />
        </m.div>
      }
    >
      <dl className="grid grid-cols-3 gap-2 text-center">
        {stats.map(([label, value]) => (
          <div key={label} className="rounded-xl bg-surface-2 p-3">
            <dt className="text-xs text-muted">{label}</dt>
            <dd className="mt-1 text-lg font-semibold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-5 flex flex-col gap-2">
        {daily ? (
          <ModalButton
            variant="primary"
            onClick={() => {
              close();
              navigate(path('/daily'));
            }}
          >
            {t('win.backToCalendar')}
          </ModalButton>
        ) : (
          <>
            <ModalButton variant="primary" onClick={() => newGame(difficulty)}>
              {t('win.newGame')}
            </ModalButton>
            {next && (
              <ModalButton onClick={() => newGame(next)}>
                {t('win.nextDifficulty', { difficulty: t(`difficulty.${next}`) })}
              </ModalButton>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}

export function NewGameModal() {
  const { t } = useTranslation();
  const open = useUi((s) => s.newGameOpen);
  const newGame = useNewGame();
  return (
    <Modal open={open} title={t('newGame.title')} onClose={() => uiStore.setState({ newGameOpen: false })}>
      <p className="text-muted">{t('newGame.text')}</p>
      <div className="mt-4 flex flex-col gap-2">
        {DIFFICULTIES.map((d) => (
          <ModalButton key={d} onClick={() => newGame(d)}>
            {t(`difficulty.${d}`)}
          </ModalButton>
        ))}
      </div>
    </Modal>
  );
}
