import { useState } from 'react';
import { sortBadges, TIER_LABEL, type BadgeDef } from '../game/badges';
import { Sheet } from './ui';

/** バッジ1つ。レア度ごとに見た目（光り方）が変わる */
export function BadgeIcon({ b, secret, size = 'md', onClick }: { b: BadgeDef; secret?: boolean; size?: 'sm' | 'md'; onClick?: () => void }) {
  return (
    <button className={`bdg t-${b.tier} ${size}${b.luck ? ' luck' : ''}`} onClick={onClick} aria-label={secret ? '隠しバッジ' : b.name}>
      <span className="bdg-in">{secret ? '？' : b.icon}</span>
      {b.luck && <i className="bdg-luck">🍀</i>}
    </button>
  );
}

/** 一覧の上位だけを小さく並べる（フレンドの一覧用） */
export function BadgeStrip({ ids, mine, max = 6 }: { ids?: string[]; mine: Set<string>; max?: number }) {
  if (!ids?.length) return null;
  const list = sortBadges(ids);
  return (
    <div className="bdg-strip">
      {list.slice(0, max).map((b) => (
        <BadgeIcon key={b.id} b={b} secret={b.hidden && !mine.has(b.id)} size="sm" />
      ))}
      {list.length > max && <span className="bdg-more">+{list.length - max}</span>}
    </div>
  );
}

/** バッジの壁（タップで説明） */
export function BadgeWall({ ids, mine }: { ids?: string[]; mine: Set<string> }) {
  const [open, setOpen] = useState<BadgeDef | null>(null);
  const list = sortBadges(ids ?? []);
  if (!list.length) return <p className="hint">まだバッジはありません。タイトルや実績、クラブの施設などで手に入ります。</p>;
  const secret = (b: BadgeDef) => !!b.hidden && !mine.has(b.id);
  return (
    <>
      <div className="bdg-wall">
        {list.map((b) => (
          <div key={b.id} className="bdg-cell">
            <BadgeIcon b={b} secret={secret(b)} onClick={() => setOpen(b)} />
            <small>{secret(b) ? '？？？' : b.name}</small>
          </div>
        ))}
      </div>
      {open && (
        <Sheet title="バッジ" onClose={() => setOpen(null)}>
          <div className="bdg-detail">
            <BadgeIcon b={open} secret={secret(open)} />
            <div className={`bdg-tier t-${open.tier}`}>{TIER_LABEL[open.tier]}</div>
            <b>{secret(open) ? '？？？' : open.name}</b>
            <p className="small">{secret(open) ? 'あなたがまだ手に入れていない隠しバッジです。どうすれば手に入るのかは…自分で見つけよう。' : open.desc}</p>
            {open.luck && <p className="small">🍀 運も味方しないと手に入らない、珍しいバッジ</p>}
          </div>
        </Sheet>
      )}
    </>
  );
}
