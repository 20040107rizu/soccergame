import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { saveGame, type Slot } from './game/save';
import type { GameState } from './game/types';

export interface UiActions {
  openPlayer: (id: string) => void;
  openNegotiation: (id: string) => void;
  editPlayer: (id: string | 'new') => void;
  toast: (msg: string) => void;
  quit: () => void;
}

interface Ctx extends UiActions {
  state: GameState;
  slot: Slot;
  /** 状態を複製して変更し、自動セーブする */
  update: <R>(fn: (draft: GameState) => R) => R;
}

const GameCtx = createContext<Ctx | null>(null);

export function useGame(): Ctx {
  const c = useContext(GameCtx);
  if (!c) throw new Error('GameProvider がありません');
  return c;
}

export function GameProvider(props: { initial: GameState; slot: Slot; actions: UiActions; children: ReactNode }) {
  const [state, setState] = useState(props.initial);
  // 連続で update されても最新の状態を元にする
  const latest = useRef(state);
  const { slot } = props;

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
        props.actions.toast('セーブに失敗しました（端末の容量を確認してください）');
      }
      return r;
    },
    [slot, props.actions],
  );

  return <GameCtx.Provider value={{ state, slot, update, ...props.actions }}>{props.children}</GameCtx.Provider>;
}
