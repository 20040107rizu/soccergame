import { useState } from 'react';
import { CondArrow, PosTag, Seg, Sheet } from '../components/ui';
import { SKILL_CAT_LABEL, SKILLS, STAT_DESC, STAT_GROUPS, STAT_LABEL, STYLES, TRAIT_DESC, type SkillCat } from '../game/stats';
import { POSITIONS, type Condition } from '../game/types';
import { APP_VERSION } from '../version';

type Tab = 'stats' | 'styles' | 'skills' | 'other';

const POS_DESC: Record<string, string> = {
  GK: 'ゴールキーパー',
  LSB: '左サイドバック',
  CB: 'センターバック',
  RSB: '右サイドバック',
  DMF: 'ディフェンシブミッドフィルダー',
  CMF: 'センターミッドフィルダー',
  OMF: 'オフェンシブミッドフィルダー',
  LMF: '左サイドミッドフィルダー',
  RMF: '右サイドミッドフィルダー',
  LWG: '左ウイング',
  RWG: '右ウイング',
  ST: 'セカンドトップ',
  CF: 'センターフォワード',
};

/** ヘルプ：能力値・プレースタイル・特殊スキル・その他の説明 */
export function Help({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<Tab>('stats');
  return (
    <Sheet title="ヘルプ" onClose={onClose} full>
      <Seg
        value={tab}
        onChange={setTab}
        options={[
          { v: 'stats', label: '能力' },
          { v: 'styles', label: 'プレースタイル' },
          { v: 'skills', label: 'スキル' },
          { v: 'other', label: 'その他' },
        ]}
      />

      {tab === 'stats' && (
        <div className="help">
          <p className="hint">選手の能力は様々なパラメータで表現されます。プレーの精度や運動能力などに影響します。</p>
          {STAT_GROUPS.map((g) => (
            <section key={g.label}>
              <h3>{g.label}</h3>
              {g.keys.map((k) => (
                <div key={k} className="help-item">
                  <b>{STAT_LABEL[k]}</b>
                  <p>{STAT_DESC[k]}</p>
                </div>
              ))}
            </section>
          ))}
          <section>
            <h3>特性</h3>
            {TRAIT_DESC.map((t) => (
              <div key={t.label} className="help-item">
                <b>{t.label}</b>
                <p>{t.desc}</p>
              </div>
            ))}
          </section>
        </div>
      )}

      {tab === 'styles' && (
        <div className="help">
          <p className="hint">
            プレースタイルは、有効なポジションで起用した時だけ効果を発揮します。有効でないポジションで使うと「無印」となり、プレースタイルに縛られない比較的自由度の高い動きになります（ピッチ上に「無印」と表示されます）。
          </p>
          <section>
            <h3>プレースタイル一覧</h3>
            {Object.entries(STYLES).map(([k, s]) => (
              <div key={k} className="help-item">
                <b>{s.label}</b>
                <p>{s.desc}</p>
                <div className="help-pos">
                  有効なポジション：
                  {s.pos.map((p) => (
                    <PosTag key={p} pos={p} />
                  ))}
                </div>
              </div>
            ))}
          </section>
          <section>
            <h3>ポジションごとに有効なプレースタイル</h3>
            {POSITIONS.map((pos) => (
              <div key={pos} className="help-item">
                <b>
                  <PosTag pos={pos} /> {POS_DESC[pos]}
                </b>
                <p>
                  {Object.values(STYLES)
                    .filter((s) => s.pos.includes(pos))
                    .map((s) => s.label)
                    .join(' / ')}
                </p>
              </div>
            ))}
          </section>
        </div>
      )}

      {tab === 'skills' && (
        <div className="help">
          <p className="hint">スキルを所持している選手は、特定のプレーの精度が上がったり、特殊な動作(モーション)ができるようになります。</p>
          {(Object.keys(SKILL_CAT_LABEL) as SkillCat[]).map((cat) => (
            <section key={cat}>
              <h3>{SKILL_CAT_LABEL[cat]}</h3>
              {SKILLS.filter((s) => s.cat === cat).map((s) => (
                <div key={s.id} className="help-item">
                  <b>{s.label}</b>
                  <p>{s.desc}</p>
                </div>
              ))}
            </section>
          ))}
        </div>
      )}

      {tab === 'other' && (
        <div className="help">
          <section>
            <h3>総合値と伸びしろ</h3>
            <div className="help-item">
              <p>総合値は、そのポジションに関係する能力値（エディットで ★ が付いた能力）から計算されます。関係する能力が上がるほど総合値も上がり、全ての能力値が 99 になると最大の 109 になります。</p>
              <p>伸びしろ（成長の上限）は、選手が試合や練習で成長した時に総合値がどこまで伸びるかの上限です。伸びる速さは年齢と成長タイプで決まり、若いほど早く伸びます。ピークを過ぎると少しずつ衰えます。</p>
            </div>
          </section>
          <section>
            <h3>身長</h3>
            <div className="help-item">
              <p>身長は空中戦に影響します。背が高い選手ほどヘディングシュートの場面で狙われやすく、決まりやすくなります。相手のセンターバックやゴールキーパーの背が高いと、ヘディングは決まりにくくなります。</p>
            </div>
          </section>
          <section>
            <h3>チームスピリット</h3>
            <div className="help-item">
              <p>
                チームの連携がスムーズになる重要な数値です。選手と監督の相性を示す値で、高ければ高いほどチームの連携がスムーズになります。最大「99」まであり、パスの精度や、選手のポジショニング、相手のパスへの反応など、あらゆる場面に影響します。
              </p>
              <p>
                適性ポジションでしっかりと選手を使い続けていれば、約1シーズンかけて最大近くになります。スタメンを入れ替えると多少下がり、適性のないポジションで起用すると下がっていきます。
              </p>
            </div>
          </section>
          <section>
            <h3>調子（コンディション）</h3>
            <div className="help-item">
              {([5, 4, 3, 2, 1] as Condition[]).map((c) => (
                <p key={c} className="row gap">
                  <CondArrow c={c} /> {['', '絶不調：能力が大きく下がる', '不調：能力が下がる', '普通', '好調：能力が上がる', '絶好調：能力が大きく上がる'][c]}
                </p>
              ))}
              <p>調子は試合ごとに変化します。コンディション安定度が高い選手ほど変化しにくくなります。</p>
            </div>
          </section>
          <section>
            <h3>ポジション</h3>
            {POSITIONS.map((p) => (
              <p key={p} className="row gap">
                <PosTag pos={p} /> {POS_DESC[p]}
              </p>
            ))}
            <div className="help-item">
              <p>
                選手をタップすると、ピッチ上に適性ポジション（赤：メイン / 橙：適性 / 緑：可）と、そこに置いた場合の総合値が表示されます。もう一度タップで解除。長押しで選手詳細を開きます。
              </p>
              <p>
                少し押さえてからスライドすると、ピッチ上の好きな位置に配置できます（置いた位置でポジションが決まります）。他の選手に重ねて離すと、その選手と位置を入れ替えます。押してすぐ縦にスライドした場合は画面のスクロールになります。
              </p>
              <p>適性のないポジションで起用を続けると、そのポジションの適性が身につくことがあります。</p>
            </div>
          </section>
          <section>
            <h3>移籍市場</h3>
            <div className="help-item">
              <p>自クラブの選手にオファーが届いたら「交渉する」で希望額を提示できます。吹っかけすぎると相手が手を引くこともあります。</p>
              <p>移籍は夏（開幕〜第4節前）と冬（第20〜23節前）の移籍期間中のみ行えます。まずクラブと移籍金を交渉し、合意したら選手と契約条件（年俸・年数）を交渉します。</p>
              <p>選手は、クラブの格・チャンピオンズリーグ出場・出場機会・現クラブへの愛着などで移籍への興味が変わります。3回断られると、その移籍期間は交渉できなくなります。</p>
            </div>
          </section>
          <section>
            <h3>🔮 隠し要素</h3>
            <div className="help-item">
              <p>このゲームには、条件を満たすと起きる隠しイベントがあります。メールに注目してください。</p>
              <p>⚡ 覚醒：一部の若手は、大舞台での活躍をきっかけに一段階化けることがあります。コーチからの「予兆」メールがヒントです。</p>
              <p>🤝 師弟関係：ベテランと若手を一緒に起用し続けると…。引退する師匠が背番号を託すことも。</p>
              <p>🔥 因縁：同じ相手に負け続けると因縁の相手に。古巣と対戦する選手は燃えます。</p>
              <p>🔍 隠し特性：選手には見えない性格があり、試合で発揮されると判明します。</p>
              <p>💎 掘り出し物・🎓 黄金世代・👔 監督オファー・📣 選手の直談判・🏆 実績と殿堂…ほかにも、まだ誰も見たことのないイベントがあるかもしれません。</p>
            </div>
          </section>
          <section>
            <h3>🌟 レジェンド</h3>
            <div className="help-item">
              <p>ごく稀に、代理人から「急成長期待」や「規格外」の選手の極秘情報が届きます。厳しい条件を承諾すると、低い確率で入団してくれます。回答期限を過ぎると二度と現れません。</p>
              <p>急成長期待の選手は試合に出るたびにとんでもない速さで成長し、規格外の選手は試合で圧倒的な活躍を見せます。</p>
            </div>
          </section>
          <section>
            <h3>フレンドランキング</h3>
            <div className="help-item">
              <p>このテスト版では、プレー状況（監督名・クラブ・成績・資金など）がフレンドランキングに自動で送られ、「大会」→「フレンド」でみんなの状況を見られます。名前や連絡先などの個人情報は送られません。</p>
            </div>
          </section>
          <section>
            <h3>試合</h3>
            <div className="help-item">
              <p>前半・後半とも、キックオフボタンを押すと試合が始まります。ハーフタイムには交代や配置の変更ができます。交代は1試合5人まで。スーパーサブを持つ選手は後半から出場すると能力が上がります。</p>
            </div>
          </section>
        </div>
      )}
      <p className="app-version">マスターリーグ v{APP_VERSION}</p>
    </Sheet>
  );
}
