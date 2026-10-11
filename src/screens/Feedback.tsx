import { useState } from 'react';
import { Seg, Sheet } from '../components/ui';
import { teamById, today } from '../game/season';
import { useGame } from '../store';
import { APP_VERSION } from '../version';

type Kind = 'bug' | 'idea' | 'balance' | 'other';
const KIND_LABEL: Record<Kind, string> = { bug: '不具合', idea: '要望', balance: 'バランス', other: 'その他' };

/** テストプレイの感想・不具合を、LINE などで送れる文章にまとめる */
export function Feedback({ onClose }: { onClose: () => void }) {
  const { state, toast } = useGame();
  const [kind, setKind] = useState<Kind>('bug');
  const [text, setText] = useState('');
  const team = teamById(state, state.userTeamId);
  const day = today(state);
  const body = `【マスターリーグ ${KIND_LABEL[kind]}】\n${text.trim()}\n\n---\nv${APP_VERSION} / ${team.name} / シーズン${state.season} ${day?.label ?? 'シーズン終了'}\n${navigator.userAgent.match(/OS [\d_]+/)?.[0]?.replace(/_/g, '.') ?? ''}`;

  const send = async () => {
    if (!text.trim()) return toast('内容を書いてください');
    try {
      if (navigator.share) {
        await navigator.share({ text: body });
        return;
      }
    } catch {
      // キャンセルされた
      return;
    }
    try {
      await navigator.clipboard.writeText(body);
      toast('コピーしました。LINE などに貼り付けて送ってください');
    } catch {
      toast('コピーできませんでした');
    }
  };

  return (
    <Sheet title="感想・不具合を送る" onClose={onClose}>
      <p className="hint">気づいたことを書いて「送る」を押すと、LINE などで送れます。バージョンや進行状況は自動で付きます。</p>
      <Seg value={kind} onChange={setKind} options={(Object.keys(KIND_LABEL) as Kind[]).map((k) => ({ v: k, label: KIND_LABEL[k] }))} />
      <textarea
        className="feedback-text"
        rows={7}
        value={text}
        placeholder={kind === 'bug' ? '例：試合中に交代しようとしたら、選手が2人表示された' : kind === 'idea' ? '例：選手の練習メニューを決められるようにしてほしい' : kind === 'balance' ? '例：移籍金が安すぎる気がする' : '自由に書いてください'}
        onChange={(e) => setText(e.target.value)}
      />
      <button className="btn primary big" onClick={send}>
        送る（LINE などで共有）
      </button>
      <button
        className="btn ghost"
        onClick={() => {
          navigator.clipboard?.writeText(body).then(
            () => toast('コピーしました'),
            () => toast('コピーできませんでした'),
          );
        }}
      >
        コピーだけする
      </button>
    </Sheet>
  );
}
