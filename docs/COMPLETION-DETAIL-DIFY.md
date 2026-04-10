# 完了詳細（Difyナレッジ連携）実装メモ

## 目的
- 修理完了案件の正解データを蓄積し、Difyの回答精度向上に使う
- 完了データをDifyナレッジへ連携しやすい構造で保存する
- メーカーはパロマ固定

---

## 追加・修正したファイル一覧

| ファイル | 内容 |
|----------|------|
| `src/lib/types.ts` | `CompletionDetail` 型、`APPLIANCE_CATEGORY_OPTIONS` / `SYMPTOM_CATEGORY_OPTIONS` / `WORK_RESULT_OPTIONS`、`CaseRecord` に `completionDetail` を追加 |
| `src/lib/completion-detail.ts` | **新規** バリデーション・Dify用テキスト整形 |
| `src/components/CompletionDetailForm.tsx` | **新規** 完了詳細入力フォームUI |
| `src/app/cases/[id]/complete/page.tsx` | 完了詳細フォームの表示・保存時の `completionDetail` 反映、「完了詳細だけ保存」ボタン |
| `src/app/cases/[id]/edit/page.tsx` | 完了案件の場合に「完了詳細を編集」リンクを表示 |

---

## 保存場所（DBスキーマ）

このアプリは **DB ではなくブラウザの localStorage** で案件を保存しています。

- **ストレージキー**: `gyoumukannri_cases`
- **案件オブジェクト** に `completionDetail` プロパティを追加しました。
- `completionDetail` が存在する場合、その案件は「完了詳細」が登録済みです。

型のイメージ:

```ts
interface CompletionDetail {
  manufacturer: string;   // 固定 "パロマ"
  category: string;      // 器具分類
  model: string;         // 型式（必須）
  inquiry_content: string;
  symptom_category: string;  // 症状分類（必須）
  confirmed_cause: string;    // 確定原因（必須）
  part_number: string;
  part_name: string;
  work_detail: string;       // 作業内容（必須）
  work_result: string;       // 作業結果
  note: string;
  solution_summary: string;  // 解決方法要約（必須）
  is_completed: boolean;     // 完了時は true
}
```

---

## バリデーション

- **必須項目**: `model`, `inquiry_content`, `symptom_category`, `confirmed_cause`, `work_detail`, `solution_summary`
- 実装: `src/lib/completion-detail.ts` の `validateCompletionDetail()`
- 完了処理ページで「保存」または「完了詳細だけ保存」を押したときに実行され、エラーがあるとフォームに表示されます。

---

## フォームUI

- **コンポーネント**: `src/components/CompletionDetailForm.tsx`
- **表示場所**:
  1. **完了処理ページ** (`/cases/[id]/complete`) … メインの保存ボタンで一緒に保存、または「完了詳細だけ保存」でだけ保存
  2. **案件編集ページ** (`/cases/[id]/edit`) … ステータスが「完了」のとき「完了詳細を編集」リンクを表示し、クリックで完了処理ページの該当ブロックへ移動

器具分類・症状分類・作業結果は選択式です（`src/lib/types.ts` の `APPLIANCE_CATEGORY_OPTIONS` / `SYMPTOM_CATEGORY_OPTIONS` / `WORK_RESULT_OPTIONS` を使用）。器具分類の候補は「ビルトインコンロ」「テーブルコンロ」「給湯器」「湯沸し器」「業務用炊飯器」「その他」です。

---

## 保存前の正規化

Difyナレッジ検索の精度向上のため、保存前に `normalizeCompletionDetail()` で表記ゆれを減らしています。

- **型式 (model)**: 前後空白削除 / 英字大文字 / 全角英数字→半角 / 全角ハイフン→半角 / 連続スペース→1つ
- **部品番号 (part_number)**: 前後空白削除 / 全角英数字→半角 / 全角ハイフン→半角 / 英字大文字
- **文章系 (inquiry_content, confirmed_cause, work_detail, note, solution_summary)**: 前後空白削除 / 連続改行整理 / 連続スペース整理

`buildCompletionDetail()` の内部で必ず `normalizeCompletionDetail()` を通すため、**保存される completionDetail は常に正規化済み**です。呼び出し側で normalize を明示的に呼ぶ必要はありません。

---

## 保存処理

1. **完了処理ページで「保存」**
   - メインの完了フォームと一緒に送信
   - 完了詳細欄に 1 つでも必須っぽい値（型式 or 解決方法要約）がある場合、バリデーション後に `updateCase(id, { ..., completionDetail })` で保存

2. **「完了詳細だけ保存」**
   - 完了詳細フォームの値だけをバリデーションし、`updateCase(id, { completionDetail })` のみ実行（他項目はそのまま）

3. **案件編集ページ**
   - 案件の更新は従来どおり `CaseForm` の保存。完了詳細の編集は「完了詳細を編集」から完了処理ページで行う想定。

---

## Dify 投入前の確認画面

**URL**: `/dify-preview`

- localStorage の `gyoumukannri_cases` から、**status が「完了」かつ completionDetail があり is_completed が true** の案件だけを抽出して一覧表示します。
- 各案件で「Dify用テキストを見る」を押すと、`formatCompletionDetailForDify(detail)` で整形したテキストを展開表示できます。Dify ナレッジに投入する前の確認用です。

---

## Dify 用テキスト整形

`src/lib/completion-detail.ts` の `formatCompletionDetailForDify(detail)` を使うと、依頼どおりの見出し付きテキストに変換できます。

```ts
import { formatCompletionDetailForDify } from "@/lib/completion-detail";

const text = formatCompletionDetailForDify(record.completionDetail);
// 【メーカー】\nパロマ\n\n【器具分類】\n...
```

Dify ナレッジへアップロードするときは、この文字列を 1 ドキュメントとして保存する想定です。

---

## 初心者向け「どのファイルをどう直したか」

1. **型と定数（`src/lib/types.ts`）**
   - 症状分類・作業結果の選択肢を定数で追加
   - 完了詳細の型 `CompletionDetail` を定義
   - 案件の型 `CaseRecord` に `completionDetail` を追加

2. **バリデーション・整形・正規化（`src/lib/completion-detail.ts`）**
   - 必須チェック、保存前の正規化（`normalizeCompletionDetail`）、Dify 用テキストへの変換を実装
   - `buildCompletionDetail()` 内で正規化を通すため、保存データは常に表記ゆれが整理された状態になる

3. **完了詳細フォーム（`src/components/CompletionDetailForm.tsx`）**
   - 新規コンポーネント
   - メーカー（パロマ固定）、型式・問合内容・症状分類・確定原因・作業内容・解決方法要約など全項目を入力
   - `ref` で親から値を取得・エラー表示できるようにしている

4. **完了処理ページ（`src/app/cases/[id]/complete/page.tsx`）**
   - フォームの下に「完了詳細」ブロックを追加
   - 保存時に `completionDetailFormRef` から値を取り、バリデーションしてから `updateCase` に `completionDetail` を渡す
   - 完了済み案件用に「完了詳細だけ保存」ボタンを追加

5. **案件編集ページ（`src/app/cases/[id]/edit/page.tsx`）**
   - ステータスが「完了」のとき、「完了詳細を編集」の説明とリンク（`/cases/[id]/complete#complete-detail-form`）を表示

以上で、完了案件の正解データを蓄積し、後から Dify 用に整形しやすい形で保存できるようになっています。
