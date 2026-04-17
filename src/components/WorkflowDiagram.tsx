"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useWebAppSubmenu } from "@/components/WebAppSubmenuContext";

const TABS = [
  { id: 0, label: "導入前後比較" },
  { id: 1, label: "業務フロー" },
  { id: 2, label: "受付登録" },
  { id: 3, label: "案件管理" },
  { id: 4, label: "担当者スケジュール" },
] as const;

const DEMO_LINKS = [
  { href: "/cases/new",       label: "受付登録" },
  { href: "/dashboard",       label: "案件管理" },
  { href: "/calendar",        label: "担当者別スケジュール" },
  { href: "/history",         label: "受付履歴検索" },
  { href: "/parts",           label: "部品管理" },
  { href: "/parts/month-end", label: "月末処理" },
  { href: "/expense",         label: "経費精算" },
];

export function WorkflowDiagram() {
  const [active, setActive] = useState(0);
  const [demoOpen, setDemoOpen] = useState(false);
  const demoRef = useRef<HTMLDivElement>(null);
  const { setSubmenuOpen } = useWebAppSubmenu();

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (demoRef.current && !demoRef.current.contains(e.target as Node)) {
        setDemoOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div className="flex w-full flex-1 flex-col">
      {/* タブバー */}
      <div className="flex shrink-0 items-end flex-wrap gap-1 border-b border-[var(--border)] bg-[var(--background)] px-4 pt-3 pb-0">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActive(tab.id)}
            className={`rounded-t-lg px-4 py-2 text-2xl font-medium transition-colors whitespace-nowrap ${
              active === tab.id
                ? "border-b-2 border-[var(--foreground)] text-[var(--foreground)]"
                : "text-[var(--muted)] hover:text-[var(--foreground)]"
            }`}
          >
            {tab.label}
          </button>
        ))}

        {/* デモンストレーションボタン */}
        <div ref={demoRef} className="relative ml-auto mb-1">
          <button
            type="button"
            onClick={() => setDemoOpen(v => !v)}
            className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-2 text-xl font-semibold text-white shadow transition hover:opacity-90"
          >
            デモンストレーション
            <svg className={`h-4 w-4 transition-transform ${demoOpen ? "rotate-180" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
          </button>
          {demoOpen && (
            <div className="absolute right-0 top-full z-50 mt-1 w-52 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--background)] shadow-lg">
              {DEMO_LINKS.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => { setDemoOpen(false); setSubmenuOpen(true); }}
                  className="block px-4 py-3 text-base text-[var(--foreground)] no-underline transition hover:bg-[var(--muted)]/10"
                >
                  {label}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* SVGエリア */}
      <div className="flex flex-1 overflow-y-auto">
        <div className="w-full px-2 py-2">
          {active === 0 && <Svg01 />}
          {active === 1 && <Svg02 />}
          {active === 2 && <Svg03 />}
          {active === 3 && <Svg04 />}
          {active === 4 && <Svg05 />}
        </div>
      </div>
    </div>
  );
}

/* ── SVG 01: 導入前後比較 ─────────────────────────────── */
function Svg01() {
  return (
    <svg width="100%" viewBox="0 0 680 600" role="img" xmlns="http://www.w3.org/2000/svg">
      <title>業務管理システム導入前後の比較図</title>
      <defs>
        <marker id="a1" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M2 1L8 5L2 9" fill="none" stroke="context-stroke" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </marker>
      </defs>
      <style>{svgStyle}</style>

      <g className="c-coral"><rect x="40" y="30" width="280" height="50" rx="8" strokeWidth="0.5"/>
        <text className="th" x="180" y="55" textAnchor="middle" dominantBaseline="central">現状の課題</text>
        <text className="ts" x="180" y="70" textAnchor="middle" dominantBaseline="central">紙ベースでの管理</text>
      </g>
      <g className="c-teal"><rect x="360" y="30" width="280" height="50" rx="8" strokeWidth="0.5"/>
        <text className="th" x="500" y="55" textAnchor="middle" dominantBaseline="central">システム導入後</text>
        <text className="ts" x="500" y="70" textAnchor="middle" dominantBaseline="central">一元管理で効率化</text>
      </g>

      <g className="c-coral"><rect x="40" y="100" width="280" height="90" rx="8" strokeWidth="0.5"/>
        <text className="th" x="180" y="130" textAnchor="middle" dominantBaseline="central">情報が散在</text>
        <text className="ts" x="180" y="152" textAnchor="middle" dominantBaseline="central">受付票・作業指示書・部品伝票</text>
        <text className="ts" x="180" y="170" textAnchor="middle" dominantBaseline="central">それぞれ別の場所に保管</text>
      </g>
      <g className="c-green"><rect x="360" y="100" width="280" height="90" rx="8" strokeWidth="0.5"/>
        <text className="th" x="500" y="130" textAnchor="middle" dominantBaseline="central">全情報を一元管理</text>
        <text className="ts" x="500" y="152" textAnchor="middle" dominantBaseline="central">受付から完了まで</text>
        <text className="ts" x="500" y="170" textAnchor="middle" dominantBaseline="central">1つのシステムで管理</text>
      </g>
      <line x1="320" y1="145" x2="360" y2="145" className="arr" markerEnd="url(#a1)" strokeWidth="2"/>
      <text className="ts" x="340" y="135" textAnchor="middle" fill="#888780">導入後</text>

      <g className="c-coral"><rect x="40" y="210" width="280" height="90" rx="8" strokeWidth="0.5"/>
        <text className="th" x="180" y="240" textAnchor="middle" dominantBaseline="central">過去の履歴を探せない</text>
        <text className="ts" x="180" y="262" textAnchor="middle" dominantBaseline="central">顧客対応履歴を探すのに</text>
        <text className="ts" x="180" y="280" textAnchor="middle" dominantBaseline="central">平均15分かかる</text>
      </g>
      <g className="c-green"><rect x="360" y="210" width="280" height="90" rx="8" strokeWidth="0.5"/>
        <text className="th" x="500" y="240" textAnchor="middle" dominantBaseline="central">瞬時に履歴検索</text>
        <text className="ts" x="500" y="262" textAnchor="middle" dominantBaseline="central">顧客名や案件番号で</text>
        <text className="ts" x="500" y="280" textAnchor="middle" dominantBaseline="central">3秒で過去データ表示</text>
      </g>
      <line x1="320" y1="255" x2="360" y2="255" className="arr" markerEnd="url(#a1)" strokeWidth="2"/>

      <g className="c-coral"><rect x="40" y="320" width="280" height="90" rx="8" strokeWidth="0.5"/>
        <text className="th" x="180" y="350" textAnchor="middle" dominantBaseline="central">部品在庫がわからない</text>
        <text className="ts" x="180" y="372" textAnchor="middle" dominantBaseline="central">倉庫に確認しに行く必要</text>
        <text className="ts" x="180" y="390" textAnchor="middle" dominantBaseline="central">時間ロスで作業遅延</text>
      </g>
      <g className="c-green"><rect x="360" y="320" width="280" height="90" rx="8" strokeWidth="0.5"/>
        <text className="th" x="500" y="350" textAnchor="middle" dominantBaseline="central">リアルタイム在庫管理</text>
        <text className="ts" x="500" y="372" textAnchor="middle" dominantBaseline="central">画面で即座に在庫確認</text>
        <text className="ts" x="500" y="390" textAnchor="middle" dominantBaseline="central">自動アラートで欠品防止</text>
      </g>
      <line x1="320" y1="365" x2="360" y2="365" className="arr" markerEnd="url(#a1)" strokeWidth="2"/>

      <g className="c-coral"><rect x="40" y="430" width="280" height="90" rx="8" strokeWidth="0.5"/>
        <text className="th" x="180" y="460" textAnchor="middle" dominantBaseline="central">担当者の進捗が見えない</text>
        <text className="ts" x="180" y="482" textAnchor="middle" dominantBaseline="central">電話や口頭で確認</text>
        <text className="ts" x="180" y="500" textAnchor="middle" dominantBaseline="central">対応漏れのリスク</text>
      </g>
      <g className="c-green"><rect x="360" y="430" width="280" height="90" rx="8" strokeWidth="0.5"/>
        <text className="th" x="500" y="460" textAnchor="middle" dominantBaseline="central">進捗状況を可視化</text>
        <text className="ts" x="500" y="482" textAnchor="middle" dominantBaseline="central">ダッシュボードで一目で把握</text>
        <text className="ts" x="500" y="500" textAnchor="middle" dominantBaseline="central">対応漏れゼロ</text>
      </g>
      <line x1="320" y1="475" x2="360" y2="475" className="arr" markerEnd="url(#a1)" strokeWidth="2"/>

      <g className="c-blue"><rect x="40" y="540" width="600" height="50" rx="8" strokeWidth="0.5"/>
        <text className="th" x="340" y="560" textAnchor="middle" dominantBaseline="central">作業時間を大幅削減</text>
        <text className="ts" x="340" y="578" textAnchor="middle" dominantBaseline="central">情報検索 15分 → 3秒 | 在庫確認の移動時間ゼロ | 対応漏れゼロ</text>
      </g>
    </svg>
  );
}

/* ── SVG 02: 業務フロー ───────────────────────────────── */
function Svg02() {
  return (
    <svg width="100%" viewBox="0 0 680 580" role="img" xmlns="http://www.w3.org/2000/svg">
      <title>業務管理システムの全体フロー</title>
      <defs>
        <marker id="a2" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M2 1L8 5L2 9" fill="none" stroke="context-stroke" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </marker>
      </defs>
      <style>{svgStyle}</style>

      <g className="c-blue"><rect x="240" y="40" width="200" height="56" rx="8" strokeWidth="0.5"/>
        <text className="th" x="340" y="58" textAnchor="middle" dominantBaseline="central">1. 受付登録</text>
        <text className="ts" x="340" y="76" textAnchor="middle" dominantBaseline="central">顧客情報・依頼内容を記録</text>
      </g>
      <line x1="340" y1="96" x2="340" y2="120" className="arr" markerEnd="url(#a2)"/>

      <g className="c-purple"><rect x="240" y="120" width="200" height="56" rx="8" strokeWidth="0.5"/>
        <text className="th" x="340" y="138" textAnchor="middle" dominantBaseline="central">2. 案件管理</text>
        <text className="ts" x="340" y="156" textAnchor="middle" dominantBaseline="central">優先度・ステータスを設定</text>
      </g>
      <line x1="340" y1="176" x2="340" y2="200" className="arr" markerEnd="url(#a2)"/>

      <g className="c-teal"><rect x="240" y="200" width="200" height="56" rx="8" strokeWidth="0.5"/>
        <text className="th" x="340" y="218" textAnchor="middle" dominantBaseline="central">3. 担当者割り当て</text>
        <text className="ts" x="340" y="236" textAnchor="middle" dominantBaseline="central">スケジュール調整・自動通知</text>
      </g>
      <line x1="340" y1="256" x2="340" y2="280" className="arr" markerEnd="url(#a2)"/>

      <g className="c-amber"><rect x="240" y="280" width="200" height="56" rx="8" strokeWidth="0.5"/>
        <text className="th" x="340" y="298" textAnchor="middle" dominantBaseline="central">4. 作業実施</text>
        <text className="ts" x="340" y="316" textAnchor="middle" dominantBaseline="central">部品使用を記録・在庫自動更新</text>
      </g>
      <line x1="340" y1="336" x2="340" y2="360" className="arr" markerEnd="url(#a2)"/>

      <g className="c-coral"><rect x="240" y="360" width="200" height="56" rx="8" strokeWidth="0.5"/>
        <text className="th" x="340" y="378" textAnchor="middle" dominantBaseline="central">5. 経費精算</text>
        <text className="ts" x="340" y="396" textAnchor="middle" dominantBaseline="central">作業費・部品代を自動集計</text>
      </g>
      <line x1="340" y1="416" x2="340" y2="440" className="arr" markerEnd="url(#a2)"/>

      <g className="c-green"><rect x="240" y="440" width="200" height="56" rx="8" strokeWidth="0.5"/>
        <text className="th" x="340" y="458" textAnchor="middle" dominantBaseline="central">6. 完了・月次処理</text>
        <text className="ts" x="340" y="476" textAnchor="middle" dominantBaseline="central">売上集計・レポート自動生成</text>
      </g>

      <g className="c-gray"><rect x="480" y="200" width="160" height="70" rx="8" strokeWidth="0.5"/>
        <text className="th" x="560" y="225" textAnchor="middle" dominantBaseline="central">受付履歴検索</text>
        <text className="ts" x="560" y="243" textAnchor="middle" dominantBaseline="central">いつでも過去の</text>
        <text className="ts" x="560" y="258" textAnchor="middle" dominantBaseline="central">対応履歴を確認可能</text>
      </g>

      <g className="c-gray"><rect x="40" y="280" width="160" height="70" rx="8" strokeWidth="0.5"/>
        <text className="th" x="120" y="305" textAnchor="middle" dominantBaseline="central">部品管理</text>
        <text className="ts" x="120" y="323" textAnchor="middle" dominantBaseline="central">在庫数・使用履歴</text>
        <text className="ts" x="120" y="338" textAnchor="middle" dominantBaseline="central">をリアルタイム管理</text>
      </g>
      <line x1="240" y1="308" x2="200" y2="315" className="arr" markerEnd="url(#a2)"/>
      <line x1="200" y1="315" x2="240" y2="308" className="arr" markerEnd="url(#a2)"/>

      <g className="c-green"><rect x="40" y="520" width="600" height="44" rx="8" strokeWidth="0.5"/>
        <text className="th" x="340" y="542" textAnchor="middle" dominantBaseline="central">作業時間を大幅削減：情報検索 15分 → 3秒、在庫確認の移動時間ゼロ</text>
      </g>
    </svg>
  );
}

/* ── SVG 03: 受付登録詳細 ─────────────────────────────── */
function Svg03() {
  return (
    <svg width="100%" viewBox="0 0 680 620" role="img" xmlns="http://www.w3.org/2000/svg">
      <title>受付登録機能の詳細</title>
      <defs>
        <marker id="a3" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M2 1L8 5L2 9" fill="none" stroke="context-stroke" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </marker>
      </defs>
      <style>{svgStyle}</style>

      <g className="c-blue"><rect x="40" y="30" width="600" height="50" rx="8" strokeWidth="0.5"/>
        <text className="th" x="340" y="55" textAnchor="middle" dominantBaseline="central" style={{fontSize:"16px"}}>受付登録機能</text>
      </g>

      <text className="th" x="40" y="110">入力内容</text>

      <g className="c-teal"><rect x="40" y="120" width="280" height="100" rx="8" strokeWidth="0.5"/>
        <text className="th" x="180" y="145" textAnchor="middle" dominantBaseline="central">顧客情報</text>
        <text className="ts" x="60" y="170">• 顧客名</text>
        <text className="ts" x="60" y="188">• 連絡先（電話・メール）</text>
        <text className="ts" x="60" y="206">• 住所</text>
      </g>

      <g className="c-purple"><rect x="40" y="240" width="280" height="120" rx="8" strokeWidth="0.5"/>
        <text className="th" x="180" y="265" textAnchor="middle" dominantBaseline="central">依頼内容</text>
        <text className="ts" x="60" y="290">• 問い合わせ種別</text>
        <text className="ts" x="60" y="308">• 症状・不具合の詳細</text>
        <text className="ts" x="60" y="326">• 希望日時</text>
        <text className="ts" x="60" y="344">• 緊急度</text>
      </g>

      <g className="c-amber"><rect x="40" y="380" width="280" height="80" rx="8" strokeWidth="0.5"/>
        <text className="th" x="180" y="405" textAnchor="middle" dominantBaseline="central">自動記録項目</text>
        <text className="ts" x="60" y="430">• 受付日時</text>
        <text className="ts" x="60" y="448">• 受付担当者</text>
      </g>

      <line x1="320" y1="300" x2="350" y2="300" className="arr" markerEnd="url(#a3)"/>

      <text className="th" x="360" y="110">機能とメリット</text>

      <g className="c-green"><rect x="360" y="120" width="280" height="80" rx="8" strokeWidth="0.5"/>
        <text className="th" x="500" y="145" textAnchor="middle" dominantBaseline="central">既存顧客の自動検索</text>
        <text className="ts" x="380" y="168">電話番号を入力すると</text>
        <text className="ts" x="380" y="186">過去の情報が自動表示</text>
      </g>

      <g className="c-green"><rect x="360" y="220" width="280" height="80" rx="8" strokeWidth="0.5"/>
        <text className="th" x="500" y="245" textAnchor="middle" dominantBaseline="central">案件の自動作成</text>
        <text className="ts" x="380" y="268">受付登録と同時に</text>
        <text className="ts" x="380" y="286">案件番号が自動発行</text>
      </g>

      <g className="c-green"><rect x="360" y="320" width="280" height="80" rx="8" strokeWidth="0.5"/>
        <text className="th" x="500" y="345" textAnchor="middle" dominantBaseline="central">担当者への自動通知</text>
        <text className="ts" x="380" y="368">緊急案件は即座に</text>
        <text className="ts" x="380" y="386">担当者に通知メール送信</text>
      </g>

      <g className="c-green"><rect x="360" y="420" width="280" height="80" rx="8" strokeWidth="0.5"/>
        <text className="th" x="500" y="445" textAnchor="middle" dominantBaseline="central">過去履歴の即時参照</text>
        <text className="ts" x="380" y="468">同一顧客の過去対応を</text>
        <text className="ts" x="380" y="486">すぐに確認可能</text>
      </g>

      <g className="c-blue"><rect x="40" y="530" width="600" height="70" rx="8" strokeWidth="0.5"/>
        <text className="th" x="340" y="555" textAnchor="middle" dominantBaseline="central">導入効果</text>
        <text className="ts" x="340" y="575" textAnchor="middle" dominantBaseline="central">受付作業時間：10分 → 3分（70%削減）</text>
        <text className="ts" x="340" y="593" textAnchor="middle" dominantBaseline="central">顧客情報の重複入力ゼロ・過去トラブルの即時把握で対応品質向上</text>
      </g>
    </svg>
  );
}

/* ── SVG 04: 案件管理詳細 ─────────────────────────────── */
function Svg04() {
  return (
    <svg width="100%" viewBox="0 0 680 640" role="img" xmlns="http://www.w3.org/2000/svg">
      <title>案件管理機能の詳細</title>
      <defs>
        <marker id="a4" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M2 1L8 5L2 9" fill="none" stroke="context-stroke" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </marker>
      </defs>
      <style>{svgStyle}</style>

      <g className="c-purple"><rect x="40" y="30" width="600" height="50" rx="8" strokeWidth="0.5"/>
        <text className="th" x="340" y="55" textAnchor="middle" dominantBaseline="central" style={{fontSize:"16px"}}>案件管理機能</text>
      </g>

      <text className="th" x="40" y="110">ステータス管理</text>

      <g className="c-blue"><rect x="40" y="120" width="180" height="60" rx="8" strokeWidth="0.5"/>
        <text className="th" x="130" y="145" textAnchor="middle" dominantBaseline="central">受付</text>
        <text className="ts" x="130" y="163" textAnchor="middle" dominantBaseline="central">新規登録された案件</text>
      </g>
      <line x1="130" y1="180" x2="130" y2="200" className="arr" markerEnd="url(#a4)"/>

      <g className="c-amber"><rect x="40" y="200" width="180" height="60" rx="8" strokeWidth="0.5"/>
        <text className="th" x="130" y="225" textAnchor="middle" dominantBaseline="central">対応中</text>
        <text className="ts" x="130" y="243" textAnchor="middle" dominantBaseline="central">担当者が作業実施中</text>
      </g>
      <line x1="130" y1="260" x2="130" y2="280" className="arr" markerEnd="url(#a4)"/>

      <g className="c-green"><rect x="40" y="280" width="180" height="60" rx="8" strokeWidth="0.5"/>
        <text className="th" x="130" y="305" textAnchor="middle" dominantBaseline="central">完了</text>
        <text className="ts" x="130" y="323" textAnchor="middle" dominantBaseline="central">作業終了・請求済み</text>
      </g>

      <g className="c-gray"><rect x="40" y="360" width="180" height="60" rx="8" strokeWidth="0.5"/>
        <text className="th" x="130" y="385" textAnchor="middle" dominantBaseline="central">保留</text>
        <text className="ts" x="130" y="403" textAnchor="middle" dominantBaseline="central">部品待ち・顧客確認待ち</text>
      </g>

      <text className="th" x="260" y="110">優先度管理</text>

      <g className="c-red"><rect x="260" y="120" width="160" height="50" rx="8" strokeWidth="0.5"/>
        <text className="th" x="340" y="143" textAnchor="middle" dominantBaseline="central">緊急（高）</text>
        <text className="ts" x="340" y="161" textAnchor="middle" dominantBaseline="central">即日対応必須</text>
      </g>

      <g className="c-blue"><rect x="260" y="190" width="160" height="50" rx="8" strokeWidth="0.5"/>
        <text className="th" x="340" y="213" textAnchor="middle" dominantBaseline="central">通常（中）</text>
        <text className="ts" x="340" y="231" textAnchor="middle" dominantBaseline="central">3日以内対応</text>
      </g>

      <g className="c-gray"><rect x="260" y="260" width="160" height="50" rx="8" strokeWidth="0.5"/>
        <text className="th" x="340" y="283" textAnchor="middle" dominantBaseline="central">低優先度（低）</text>
        <text className="ts" x="340" y="301" textAnchor="middle" dominantBaseline="central">1週間以内対応</text>
      </g>

      <text className="th" x="460" y="110">主要機能</text>

      <g className="c-teal"><rect x="460" y="120" width="180" height="70" rx="8" strokeWidth="0.5"/>
        <text className="th" x="550" y="145" textAnchor="middle" dominantBaseline="central">案件一覧表示</text>
        <text className="ts" x="480" y="168">• ステータス別フィルタ</text>
        <text className="ts" x="480" y="183">• 優先度でソート</text>
      </g>

      <g className="c-teal"><rect x="460" y="210" width="180" height="70" rx="8" strokeWidth="0.5"/>
        <text className="th" x="550" y="235" textAnchor="middle" dominantBaseline="central">詳細編集</text>
        <text className="ts" x="480" y="258">• 内容の更新</text>
        <text className="ts" x="480" y="273">• ステータス変更</text>
      </g>

      <g className="c-teal"><rect x="460" y="300" width="180" height="70" rx="8" strokeWidth="0.5"/>
        <text className="th" x="550" y="325" textAnchor="middle" dominantBaseline="central">進捗管理</text>
        <text className="ts" x="480" y="348">• 作業履歴の記録</text>
        <text className="ts" x="480" y="363">• タイムライン表示</text>
      </g>

      <text className="th" x="40" y="450">管理画面の表示項目</text>

      <g className="c-purple"><rect x="40" y="460" width="600" height="140" rx="8" strokeWidth="0.5"/>
        <text className="th" x="340" y="485" textAnchor="middle" dominantBaseline="central">案件管理ダッシュボード</text>

        <text className="ts" x="60" y="515">案件No.</text>
        <text className="ts" x="160" y="515">顧客名</text>
        <text className="ts" x="260" y="515">案件タイトル</text>
        <text className="ts" x="400" y="515">優先度</text>
        <text className="ts" x="480" y="515">ステータス</text>
        <text className="ts" x="580" y="515">担当者</text>

        <line x1="60" y1="522" x2="620" y2="522" stroke="#888780" strokeWidth="0.5" opacity="0.3"/>

        <text className="ts" x="60" y="545">C-2026-001</text>
        <text className="ts" x="160" y="545">山田商店</text>
        <text className="ts" x="260" y="545">エアコン修理</text>
        <g className="c-red"><rect x="400" y="535" width="50" height="18" rx="4" strokeWidth="0.5"/><text className="ts" x="425" y="547" textAnchor="middle">緊急</text></g>
        <g className="c-amber"><rect x="480" y="535" width="60" height="18" rx="4" strokeWidth="0.5"/><text className="ts" x="510" y="547" textAnchor="middle">対応中</text></g>
        <text className="ts" x="580" y="545">田中</text>

        <text className="ts" x="60" y="572">C-2026-002</text>
        <text className="ts" x="160" y="572">佐藤工業</text>
        <text className="ts" x="260" y="572">定期点検</text>
        <g className="c-blue"><rect x="400" y="562" width="50" height="18" rx="4" strokeWidth="0.5"/><text className="ts" x="425" y="574" textAnchor="middle">通常</text></g>
        <g className="c-blue"><rect x="480" y="562" width="60" height="18" rx="4" strokeWidth="0.5"/><text className="ts" x="510" y="574" textAnchor="middle">受付</text></g>
        <text className="ts" x="580" y="572">鈴木</text>
      </g>

      <g className="c-purple"><rect x="40" y="615" width="600" height="20" rx="4" strokeWidth="0.5"/>
        <text className="ts" x="340" y="629" textAnchor="middle" dominantBaseline="central">案件の優先順位を一目で把握・対応漏れゼロ・作業効率30%向上</text>
      </g>
    </svg>
  );
}

/* ── SVG 05: 担当者スケジュール ──────────────────────── */
function Svg05() {
  return (
    <svg width="100%" viewBox="0 0 680 680" role="img" xmlns="http://www.w3.org/2000/svg">
      <title>担当者割り当てスケジュール機能の詳細</title>
      <defs>
        <marker id="a5" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M2 1L8 5L2 9" fill="none" stroke="context-stroke" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </marker>
      </defs>
      <style>{svgStyle}</style>

      <g className="c-teal"><rect x="40" y="30" width="600" height="50" rx="8" strokeWidth="0.5"/>
        <text className="th" x="340" y="55" textAnchor="middle" dominantBaseline="central" style={{fontSize:"16px"}}>担当者割り当てスケジュール機能</text>
      </g>

      <text className="th" x="40" y="110">割り当て方法</text>

      <g className="c-blue"><rect x="40" y="120" width="180" height="80" rx="8" strokeWidth="0.5"/>
        <text className="th" x="130" y="145" textAnchor="middle" dominantBaseline="central">手動割り当て</text>
        <text className="ts" x="60" y="168">• ドラッグ&ドロップ</text>
        <text className="ts" x="60" y="186">• 担当者を選択して割当</text>
      </g>

      <g className="c-purple"><rect x="40" y="220" width="180" height="80" rx="8" strokeWidth="0.5"/>
        <text className="th" x="130" y="245" textAnchor="middle" dominantBaseline="central">自動提案</text>
        <text className="ts" x="60" y="268">• 負荷が少ない担当者</text>
        <text className="ts" x="60" y="286">• スキルマッチング</text>
      </g>

      <g className="c-amber"><rect x="40" y="320" width="180" height="80" rx="8" strokeWidth="0.5"/>
        <text className="th" x="130" y="345" textAnchor="middle" dominantBaseline="central">スケジュール調整</text>
        <text className="ts" x="60" y="368">• 希望日時を考慮</text>
        <text className="ts" x="60" y="386">• 移動時間を計算</text>
      </g>

      <text className="th" x="260" y="110">担当者の可視化</text>

      <g className="c-green"><rect x="260" y="120" width="170" height="90" rx="8" strokeWidth="0.5"/>
        <text className="th" x="345" y="143" textAnchor="middle" dominantBaseline="central">田中太郎</text>
        <text className="ts" x="280" y="163">本日の案件: 3件</text>
        <text className="ts" x="280" y="180">今週の案件: 8件</text>
        <text className="ts" x="280" y="197">ステータス: 対応可能</text>
      </g>

      <g className="c-amber"><rect x="260" y="230" width="170" height="90" rx="8" strokeWidth="0.5"/>
        <text className="th" x="345" y="253" textAnchor="middle" dominantBaseline="central">佐藤花子</text>
        <text className="ts" x="280" y="273">本日の案件: 5件</text>
        <text className="ts" x="280" y="290">今週の案件: 12件</text>
        <text className="ts" x="280" y="307">ステータス: やや多忙</text>
      </g>

      <g className="c-red"><rect x="260" y="340" width="170" height="90" rx="8" strokeWidth="0.5"/>
        <text className="th" x="345" y="363" textAnchor="middle" dominantBaseline="central">鈴木一郎</text>
        <text className="ts" x="280" y="383">本日の案件: 7件</text>
        <text className="ts" x="280" y="400">今週の案件: 18件</text>
        <text className="ts" x="280" y="417">ステータス: 満杯</text>
      </g>

      <text className="th" x="460" y="110">自動通知機能</text>

      <g className="c-teal"><rect x="460" y="120" width="180" height="70" rx="8" strokeWidth="0.5"/>
        <text className="th" x="550" y="145" textAnchor="middle" dominantBaseline="central">メール通知</text>
        <text className="ts" x="480" y="168">割り当て時に自動送信</text>
        <text className="ts" x="480" y="183">案件詳細を記載</text>
      </g>

      <g className="c-teal"><rect x="460" y="210" width="180" height="70" rx="8" strokeWidth="0.5"/>
        <text className="th" x="550" y="235" textAnchor="middle" dominantBaseline="central">リマインダー</text>
        <text className="ts" x="480" y="258">訪問予定日の前日</text>
        <text className="ts" x="480" y="273">自動リマインド送信</text>
      </g>

      <g className="c-teal"><rect x="460" y="300" width="180" height="70" rx="8" strokeWidth="0.5"/>
        <text className="th" x="550" y="325" textAnchor="middle" dominantBaseline="central">変更通知</text>
        <text className="ts" x="480" y="348">スケジュール変更時</text>
        <text className="ts" x="480" y="363">即座に通知</text>
      </g>

      <text className="th" x="40" y="460">カレンダー表示イメージ</text>

      <g className="c-gray"><rect x="40" y="470" width="600" height="170" rx="8" strokeWidth="0.5"/>
        <text className="th" x="340" y="495" textAnchor="middle" dominantBaseline="central">2026年4月 スケジュールカレンダー</text>

        <text className="ts" x="80" y="525">月</text>
        <text className="ts" x="160" y="525">火</text>
        <text className="ts" x="240" y="525">水</text>
        <text className="ts" x="320" y="525">木</text>
        <text className="ts" x="400" y="525">金</text>
        <text className="ts" x="480" y="525">土</text>
        <text className="ts" x="560" y="525">日</text>

        <line x1="60" y1="532" x2="620" y2="532" stroke="#888780" strokeWidth="0.5" opacity="0.3"/>

        <text className="ts" x="80" y="550">14</text>
        <g className="c-blue"><rect x="60" y="555" width="70" height="16" rx="3" strokeWidth="0.5"/><text className="ts" x="95" y="566" textAnchor="middle" style={{fontSize:"10px"}}>田中 2件</text></g>

        <text className="ts" x="160" y="550">15</text>
        <g className="c-amber"><rect x="140" y="555" width="70" height="16" rx="3" strokeWidth="0.5"/><text className="ts" x="175" y="566" textAnchor="middle" style={{fontSize:"10px"}}>佐藤 3件</text></g>

        <text className="ts" x="240" y="550">16</text>
        <g className="c-red"><rect x="220" y="555" width="70" height="16" rx="3" strokeWidth="0.5"/><text className="ts" x="255" y="566" textAnchor="middle" style={{fontSize:"10px"}}>鈴木 5件</text></g>
        <g className="c-blue"><rect x="220" y="573" width="70" height="16" rx="3" strokeWidth="0.5"/><text className="ts" x="255" y="584" textAnchor="middle" style={{fontSize:"10px"}}>田中 1件</text></g>

        <text className="ts" x="320" y="550">17</text>
        <g className="c-green"><rect x="300" y="555" width="70" height="16" rx="3" strokeWidth="0.5"/><text className="ts" x="335" y="566" textAnchor="middle" style={{fontSize:"10px"}}>田中 1件</text></g>

        <text className="ts" x="400" y="550">18</text>
        <g className="c-blue"><rect x="380" y="555" width="70" height="16" rx="3" strokeWidth="0.5"/><text className="ts" x="415" y="566" textAnchor="middle" style={{fontSize:"10px"}}>佐藤 2件</text></g>

        <text className="ts" x="480" y="550">19</text>
        <text className="ts" x="560" y="550">20</text>

        <g className="c-purple"><rect x="360" y="595" width="250" height="35" rx="6" strokeWidth="0.5"/>
          <text className="ts" x="375" y="611">クリックで詳細表示</text>
          <text className="ts" x="375" y="625" style={{fontSize:"10px"}}>案件番号・顧客名・訪問時間など</text>
        </g>
      </g>

      <g className="c-teal"><rect x="40" y="655" width="600" height="20" rx="4" strokeWidth="0.5"/>
        <text className="ts" x="340" y="669" textAnchor="middle" dominantBaseline="central">負荷の偏り解消・スケジュール調整時間80%削減・対応スピード向上</text>
      </g>
    </svg>
  );
}

/* ── 共通スタイル ─────────────────────────────────────── */
const svgStyle = `
  .c-coral rect { fill: #FAECE7; stroke: #993C1D; }
  .c-coral .th { fill: #4A1B0C; font-weight: 500; }
  .c-coral .ts { fill: #712B13; }
  .c-teal rect { fill: #E1F5EE; stroke: #0F6E56; }
  .c-teal .th { fill: #04342C; font-weight: 500; }
  .c-teal .ts { fill: #085041; }
  .c-green rect { fill: #EAF3DE; stroke: #3B6D11; }
  .c-green .th { fill: #173404; font-weight: 500; }
  .c-green .ts { fill: #27500A; }
  .c-blue rect { fill: #E6F1FB; stroke: #185FA5; }
  .c-blue .th { fill: #042C53; font-weight: 500; }
  .c-blue .ts { fill: #0C447C; }
  .c-purple rect { fill: #EEEDFE; stroke: #534AB7; }
  .c-purple .th { fill: #26215C; font-weight: 500; }
  .c-purple .ts { fill: #3C3489; }
  .c-amber rect { fill: #FAEEDA; stroke: #854F0B; }
  .c-amber .th { fill: #412402; font-weight: 500; }
  .c-amber .ts { fill: #633806; }
  .c-gray rect { fill: #F1EFE8; stroke: #5F5E5A; }
  .c-gray .th { fill: #2C2C2A; font-weight: 500; }
  .c-gray .ts { fill: #444441; }
  .c-red rect { fill: #FCEBEB; stroke: #A32D2D; }
  .c-red .th { fill: #501313; font-weight: 500; }
  .c-red .ts { fill: #791F1F; }
  .th { font-family: sans-serif; font-size: 14px; font-weight: 500; }
  .ts { font-family: sans-serif; font-size: 12px; }
  .arr { stroke: #888780; stroke-width: 1.5; fill: none; }
`;
