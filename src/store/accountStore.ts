import { createStore } from 'zustand/vanilla';
import type { PublicUser } from '../../server/auth';
import { ApiError, api } from '../api/client';
import { isObject, loadValue, removeValue, saveValue } from '../storage/storage';

export type { PublicUser };

const KEY = 'sudoku:account';
const VERSION = 1;

export interface AccountStore {
  /** 'unknown' until the first check; 'signedIn' may come from the saved copy while offline. */
  status: 'unknown' | 'signedOut' | 'signedIn';
  user: PublicUser | null;
  /** Asks the server who is signed in. Keeps the saved user when the network is unavailable. */
  refresh(): Promise<void>;
  setUser(user: PublicUser): void;
  signOut(): Promise<void>;
  deleteAccount(): Promise<void>;
}

const validate = (data: unknown): PublicUser | null =>
  isObject(data) && typeof data.id === 'string' && typeof data.email === 'string' ? (data as unknown as PublicUser) : null;

export const accountStore = createStore<AccountStore>()((set) => {
  const signedOut = () => {
    removeValue(KEY);
    set({ status: 'signedOut', user: null });
  };
  return {
    status: 'unknown',
    user: null,

    refresh: async () => {
      // Show the saved account immediately (also what offline play sees).
      const saved = loadValue(KEY, { version: VERSION, validate });
      if (saved) set({ status: 'signedIn', user: saved });
      try {
        const { user } = await api<{ user: PublicUser }>('/api/me');
        saveValue(KEY, VERSION, user);
        set({ status: 'signedIn', user });
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) signedOut();
        else if (!saved) set({ status: 'signedOut', user: null }); // offline, never signed in here
      }
    },

    setUser: (user) => {
      saveValue(KEY, VERSION, user);
      set({ status: 'signedIn', user });
    },

    signOut: async () => {
      await api('/api/auth/logout', { method: 'POST', body: {} }).catch(() => {});
      signedOut();
    },

    deleteAccount: async () => {
      await api('/api/me', { method: 'DELETE', body: {} });
      signedOut();
    },
  };
});
