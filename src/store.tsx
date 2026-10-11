import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { saveGame, type Slot } from './game/save';
import type { GameState } from './game/types';

interface Ctx {
  state: GameState;
  slot: Slot;
  /** 状態を複製して変更し、自動セーブする */
  update: <R>(fn: (draft: GameState) => R) => R;
  openPlayer: (id: string) => void;
  editPlayer: (id: string | 'new', teamId?: string | null) => void;
  toast: (msg: string) => void;
  quit: () => void;
}

const GameCtx = createContext<Ctx | null>(null);

export function useGame(): Ctx {
  const c = useContext(GameCtx);
  if (!c) throw new Error('GameProvider がありません');
  return c;
}

export function GameProvider(props: {
  initial: GameState;
  slot: Slot;
  children: ReactNode;
  openPlayer: (id: string) => void;
  editPlayer: (id: string | 'new', teamId?: string | null) => void;
  toast: (msg: string) => void;
  quit: () => void;
  onChange?: (s: GameState) => void;
}) {
  const [state, setState] = useState(props.initial);
  // 連続で update されても最新の状態を元にする
  const latest = useRef(state);
  const { slot, onChange } = props;

  const update = useCallback(
    <R,>(fn: (draft: GameState) => R): R => {
      const draft = structuredClone(latest.current);
      const r = fn(draft);
      latest.current = draft;
      setState(draft);
      try {
        saveGame(slot, draft);
      } catch (e) {
        console.error(e);
      }
      onChange?.(draft);
      return r;
    },
    [slot, onChange],
  );

  return (
    <GameCtx.Provider
      value={{ state, slot, update, openPlayer: props.openPlayer, editPlayer: props.editPlayer, toast: props.toast, quit: props.quit }}
    >
      {props.children}
    </GameCtx.Provider>
  );
}
