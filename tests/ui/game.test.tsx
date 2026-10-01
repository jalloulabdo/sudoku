// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { routes } from '../../src/App';
import '../../src/i18n';
import { gameStore } from '../../src/store/gameStore';
import { settingsStore } from '../../src/store/settingsStore';
import { EMPTY_CELLS, classicPuzzle, resetStores, solutionAt, wrongAt } from '../store/helpers';

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  return router;
}

const cells = () => screen.getAllByRole('gridcell');
const g = () => gameStore.getState().game!;
const key = (k: string, init: Partial<KeyboardEventInit> = {}) => act(() => void fireEvent.keyDown(window, { key: k, ...init }));
const select = (i: number) => act(() => gameStore.getState().select(i));

beforeEach(() => {
  resetStores();
  gameStore.getState().newGame(classicPuzzle());
});
afterEach(cleanup);

describe('playing by touch / mouse', () => {
  it('renders an 81-cell grid that continues the saved game', () => {
    renderAt('/en/play/easy');
    expect(screen.getByRole('grid', { name: 'Sudoku grid' })).toBeTruthy();
    expect(cells()).toHaveLength(81);
    expect(cells()[0].getAttribute('aria-label')).toBe('Row 1, column 1: 5, given');
  });

  it('selects a cell and places a digit from the keypad', () => {
    renderAt('/en/play/easy');
    fireEvent.click(cells()[2]);
    expect(cells()[2].getAttribute('aria-selected')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: /^4, \d left$/ }));
    expect(cells()[2].getAttribute('aria-label')).toBe('Row 1, column 3: 4');
  });

  it('notes mode, erase and undo buttons work', () => {
    renderAt('/en/play/easy');
    fireEvent.click(cells()[2]);
    fireEvent.click(screen.getByRole('button', { name: /^Notes/ }));
    fireEvent.click(screen.getByRole('button', { name: /^1, / }));
    fireEvent.click(screen.getByRole('button', { name: /^2, / }));
    expect(cells()[2].getAttribute('aria-label')).toBe('Row 1, column 3: empty, notes 1 2');
    fireEvent.click(screen.getByRole('button', { name: 'Erase' }));
    expect(cells()[2].getAttribute('aria-label')).toBe('Row 1, column 3: empty');
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(cells()[2].getAttribute('aria-label')).toBe('Row 1, column 3: empty, notes 1 2');
  });

  it('shows a hint with its technique, then applies it', () => {
    renderAt('/en/play/easy');
    fireEvent.click(screen.getByRole('button', { name: 'Hint' }));
    const active = gameStore.getState().activeHint;
    expect(active?.kind).toBe('step');
    if (active?.kind !== 'step') return;
    expect(screen.getByRole('heading', { name: /Single/ })).toBeTruthy();
    const { index, digit } = active.hint.placement!;
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(g().cells[index].value).toBe(digit);
  });
});

describe('playing by keyboard', () => {
  it('arrows, digits, notes, erase and undo/redo', () => {
    renderAt('/en/play/easy');
    key('ArrowUp'); // nothing selected → centre cell
    expect(g().selected).toBe(40);
    select(2);
    key('ArrowRight');
    expect(g().selected).toBe(3);
    key('ArrowLeft');
    key('ArrowLeft');
    key('ArrowLeft');
    key('ArrowLeft'); // clamps at the edge
    expect(g().selected).toBe(0);

    select(2);
    key('4');
    expect(g().cells[2].value).toBe(4);
    key('z', { ctrlKey: true });
    expect(g().cells[2].value).toBeNull();
    key('z', { ctrlKey: true, shiftKey: true });
    expect(g().cells[2].value).toBe(4);
    key('z', { ctrlKey: true });

    key('n');
    expect(g().notesMode).toBe(true);
    key('&', { code: 'Digit1' }); // AZERTY: unshifted top-row key
    expect(g().cells[2].notes).toBe(1);
    key('Backspace');
    expect(g().cells[2].notes).toBe(0);
  });

  it('Space pauses and resumes, blurring the board', async () => {
    renderAt('/en/play/easy');
    key(' ');
    expect(g().status).toBe('paused');
    expect(await screen.findByRole('dialog', { name: 'Paused' })).toBeTruthy();
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Resume' }));
    expect(g().status).toBe('playing');
  });
});

describe('end of game', () => {
  it('shows the win dialog after the last digit', async () => {
    renderAt('/en/play/easy');
    act(() => {
      for (const i of EMPTY_CELLS) {
        gameStore.getState().select(i);
        gameStore.getState().place(solutionAt(i));
      }
    });
    expect(await screen.findByRole('dialog', { name: 'Puzzle solved!' })).toBeTruthy();
  });

  it('shows game over after three mistakes, with a second chance', async () => {
    renderAt('/en/play/easy');
    act(() => {
      for (const i of EMPTY_CELLS.slice(0, 3)) {
        gameStore.getState().select(i);
        gameStore.getState().place(wrongAt(i));
      }
    });
    const dialog = await screen.findByRole('dialog', { name: 'Game over' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Second chance' }));
    expect(g().status).toBe('playing');
  });
});

describe('languages', () => {
  it('French translates the interface', () => {
    renderAt('/fr/play/easy');
    expect(document.documentElement.lang).toBe('fr');
    expect(document.documentElement.dir).toBe('ltr');
    expect(screen.getByRole('grid', { name: 'Grille de Sudoku' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Effacer' })).toBeTruthy();
    expect(cells()[0].getAttribute('aria-label')).toBe('Ligne 1, colonne 1 : 5, donné');
  });

  it('Arabic switches the page to RTL but keeps the grid LTR', () => {
    renderAt('/ar/play/easy');
    expect(document.documentElement.lang).toBe('ar');
    expect(document.documentElement.dir).toBe('rtl');
    const grid = screen.getByRole('grid', { name: 'شبكة السودوكو' });
    expect(grid.closest('[dir]')?.getAttribute('dir')).toBe('ltr');
    expect(screen.getByRole('button', { name: 'تراجع' })).toBeTruthy();
    // Arrow keys still move visually: Right goes to the next column.
    select(2);
    key('ArrowRight');
    expect(g().selected).toBe(3);
  });

  it('the language switcher keeps the page and remembers the choice', async () => {
    const router = renderAt('/en/stats');
    fireEvent.change((await screen.findAllByRole('combobox'))[0], { target: { value: 'ar' } });
    await waitFor(() => expect(router.state.location.pathname).toBe('/ar/stats'));
    expect(settingsStore.getState().language).toBe('ar');
    expect(await screen.findByRole('heading', { name: 'الإحصائيات', level: 1 })).toBeTruthy();
  });

  it('/ redirects to the saved language, unknown prefixes are corrected', async () => {
    settingsStore.getState().update({ language: 'fr' });
    let router = renderAt('/');
    await waitFor(() => expect(router.state.location.pathname).toBe('/fr'));
    cleanup();
    router = renderAt('/xx/stats');
    await waitFor(() => expect(router.state.location.pathname).toBe('/fr'));
  });

  it('Arabic plural forms are used for streaks', async () => {
    renderAt('/ar/daily');
    expect((await screen.findAllByText('0 يوم')).length).toBeGreaterThan(0);
  });
});
