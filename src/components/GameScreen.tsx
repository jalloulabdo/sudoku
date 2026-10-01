import { Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useKeyboardControls } from '../hooks/useKeyboardControls';
import { useTimer } from '../hooks/useTimer';
import { uiStore } from '../store/uiStore';
import { Board } from './Board';
import { GameBar } from './GameBar';
import { HintPanel } from './HintPanel';
import { Keypad } from './Keypad';
import { LiveAnnouncer } from './LiveAnnouncer';
import { GameOverModal, NewGameModal, PauseModal, WinModal } from './modals/GameModals';

interface Props {
  /** The page's <h1>; visually hidden, the board is the visual focus. */
  heading: string;
  /** Landing-page text shown below the game. */
  intro?: string;
}

export function GameScreen({ heading, intro }: Props) {
  const { t } = useTranslation();
  useTimer();
  useKeyboardControls();

  return (
    <>
    <h1 className="sr-only">{heading}</h1>
    <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-4 px-4 py-4 lg:flex-row lg:items-start lg:justify-center lg:gap-10 lg:py-8">
      <div className="flex w-full max-w-[560px] flex-col gap-1">
        <GameBar />
        <Board />
      </div>
      <div className="flex w-full max-w-[560px] flex-col gap-4 lg:mt-11 lg:max-w-xs">
        <HintPanel />
        <Keypad />
        <button
          type="button"
          onClick={() => uiStore.setState({ newGameOpen: true })}
          className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-line font-medium hover:bg-surface-2"
        >
          <Plus className="size-5" aria-hidden="true" />
          {t('game.newGame')}
        </button>
      </div>
      <PauseModal />
      <GameOverModal />
      <WinModal />
      <NewGameModal />
      <LiveAnnouncer />
    </div>
    {intro && (
      <section className="mx-auto w-full max-w-3xl px-4 pb-4">
        <p className="leading-relaxed text-muted">{intro}</p>
      </section>
    )}
    </>
  );
}
