import { generatePuzzle } from './generator';
import type { Difficulty, Puzzle } from './types';

export interface GenerateRequest {
  requestId: number;
  difficulty: Difficulty;
  seed: number;
  id?: string;
}

export type GenerateResponse =
  | { requestId: number; ok: true; puzzle: Puzzle }
  | { requestId: number; ok: false; error: string };

self.onmessage = (event: MessageEvent<GenerateRequest>) => {
  const { requestId, difficulty, seed, id } = event.data;
  let response: GenerateResponse;
  try {
    response = { requestId, ok: true, puzzle: generatePuzzle(difficulty, seed, id) };
  } catch (err) {
    response = { requestId, ok: false, error: err instanceof Error ? err.message : String(err) };
  }
  self.postMessage(response);
};
