# OCR 段階表示・計測・タイムアウト

## どの段階に何 ms かかっているか

実機で PDF をアップロードし、以下を確認してください。

### サーバーログ（ターミナル）

| ログプレフィックス | 内容 | 計測 |
|-------------------|------|------|
| `[ocr/extract-multipage] 開始` | マルチページ解析 開始 | phase, ページ数 |
| `[ocr/extract-multipage] 終了 成功 Xms` | マルチページ解析 成功 | **X ms** |
| `[ocr/extract-multipage] 失敗 Xms:` | マルチページ解析 失敗 | **X ms** |
| `[ocr/extract-fields] 開始` | テンプレート抽出 開始 | templateId, 画像数 |
| `[ocr/extract-fields] 終了 成功 Xms` | テンプレート抽出 成功 | **X ms** |
| `[ocr/extract-fields] 失敗 Xms:` | テンプレート抽出 失敗 | **X ms** |
| `[api/ocr] OCR 開始` | Azure OCR 開始 | - |
| `[api/ocr] OCR 終了 成功 Xms` | Azure OCR 成功 | **X ms** |
| `[api/ocr] OCR 失敗 Xms:` | Azure OCR 失敗 | **X ms** |
| `[azure-doc-intelligence] OCR 開始` | Azure Analyze 開始 | - |
| `[azure-doc-intelligence] OCR 終了 成功 Xms` | Azure Analyze 成功 | **X ms** |
| `[azure-doc-intelligence] 失敗/タイムアウト/例外 Xms` | Azure 失敗 | **X ms** |

### クライアント（ブラウザコンソール）

| ログ | 内容 | 計測 |
|------|------|------|
| `[CaseForm OCR] マルチページ解析 開始` | マルチページ開始 | - |
| `[CaseForm OCR] マルチページ Phase1 終了 Xms` | Phase1 まで | **X ms** |
| `[CaseForm OCR] マルチページ解析 終了 Xms (Phase2: Yms)` | 全体・Phase2 | **X ms, Y ms** |
| `[CaseForm OCR] テンプレート抽出 開始` | テンプレート開始 | - |
| `[CaseForm OCR] テンプレート抽出 終了 Xms` | テンプレート終了 | **X ms** |
| `[runPdfOcr] Azure OCR 開始` | Azure 開始 | - |
| `[runPdfOcr] Azure OCR 終了 成功 Xms` | Azure 成功 | **X ms** |
| `[runPdfOcr] フォールバック 終了 Xms (合計 Yms)` | フォールバック | **X ms, Y ms** |

## どこが主犯か

- **体感が遅い場合**  
  上記ログで **どの段階の ms が大きいか** を確認してください。
- **一般的に重くなりやすい箇所**
  - **extract-multipage**: ページ数 ×（テンプレート判定 + 座標切り出し + Tesseract 並列）。ページが多いと時間が伸びやすい。
  - **extract-fields**: テンプレートの項目数 × Tesseract。項目数が多いと伸びやすい。
  - **Azure (/api/ocr)**: ネットワーク＋Azure の分析時間。大きな PDF は時間がかかることがある。
  - **フォールバック（Tesseract）**: 1 ページ分の画像をクライアントで OCR。環境によっては数秒〜数十秒。

## どこにタイムアウトを入れたか

| 処理 | タイムアウト | 超過時の挙動 |
|------|-------------|--------------|
| マルチページ画像化 `getMultipageBlobs` | **25 s** | 次の段階（テンプレート）へ |
| マルチページ Phase1 `extract-multipage` | **45 s** | テンプレートへ |
| マルチページ Phase2 `extract-multipage` | **45 s** | Phase2 はスキップし Phase1 の結果で完了 |
| 座標抽出 高速（主要項目のみ）`extract-fields` | **10 s** | タイムアウト時は Azure OCR へ |
| 座標抽出 残り（補助・長文）`extract-fields` | **8 s** | スキップして高速分の結果で完了 |
| 全体 `runPdfOcr`（Azure + フォールバック） | **100 s** | エラー表示、無限待ち防止 |

定数は `CaseForm.tsx` の `OCR_MULTIPAGE_BLOBS_MS`, `OCR_MULTIPAGE_PHASE_MS`, `OCR_EXTRACT_FIELDS_MS`, `OCR_RUN_PDF_OCR_MS` で変更可能。

## 追加・修正したファイル一覧

| ファイル | 変更内容 |
|----------|----------|
| `src/components/CaseForm.tsx` | 段階 state `ocrStage`、段階表示ラベル、`withTimeout` / `fetchWithTimeout`、各段階のタイムアウト・クライアント計測ログ |
| `src/lib/ocr.ts` | `runPdfOcr` に開始/終了/フォールバックのログ（ms）、`onFallback` オプション |
| `src/app/api/ocr/route.ts` | 開始・成功/失敗時の処理時間（ms）ログ |
| `src/app/api/ocr/extract-multipage/route.ts` | 開始・成功/失敗と処理時間（ms）ログ |
| `src/app/api/ocr/extract-fields/route.ts` | 開始・成功/失敗と処理時間（ms）ログ |
| `src/lib/ocr/providers/azureDocumentIntelligence.ts` | 成功/失敗/タイムアウト/例外時の処理時間（ms）ログ |
| `docs/OCR_TIMING_AND_STAGES.md` | 本ドキュメント（新規） |

## 無限待ちにしないための対応

- 各ネットワーク呼び出し（`getMultipageBlobs` を除く）は `fetchWithTimeout` でラップし、超過時に reject。
- `getMultipageBlobs` は `withTimeout` でラップし、超過時に reject。
- `runPdfOcr` 全体を `withTimeout(..., OCR_RUN_PDF_OCR_MS)` でラップし、Azure 未応答やクライアント Tesseract の固まりでも最大 100 秒で reject。
- `finally` で必ず `setUploading(false)` と `setOcrStage(null)` を実行し、成功・失敗・タイムアウトいずれでも「OCR処理中」表示が残らないようにしている。
