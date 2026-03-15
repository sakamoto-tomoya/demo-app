# スマホ向けバーコード読取機能 改善メモ

## 動作確認端末

- **iPhone 11 Pro**（Safari 推奨・カメラ対応）
- **iPhone SE**（Safari 推奨・カメラ対応。画面が小さいため手入力・写真読み取りも利用しやすい）
- **Android**（Chrome でカメラ・写真・手入力の動作確認）

※ iOS では LINE 等のアプリ内ブラウザではカメラが使えないため、カメラ利用時は Safari で開くか「写真から読み取る」「手入力」を利用してください。

---

## 1. 原因候補

- **formatsToSupport 未指定**: html5-qrcode のデフォルトは全フォーマット有効だが、明示指定しないと 1D（CODE_128 / EAN_13 等）が優先されにくい・環境差が出る可能性がある。
- **getUserMedia 失敗時のメッセージが汎用**: NotAllowedError / NotFoundError / NotReadableError / OverconstrainedError / AbortError を区別しておらず、切り分けしづらい。
- **読み取り失敗時の代替手段がない**: カメラ・写真で読めない場合に手入力で確定する UI がなかった。
- **カメラ表示の切り分けが困難**: どこで失敗しているか（HTTPS・コンテナサイズ・getUserMedia・デコード）をコンソールで追いにくい。
- **iOS / Android の差異**: Safari と Chrome でカメラ API の挙動が異なるが、ログで環境を確認する手段がなかった。

## 2. 改善方針

- **HTTPS 前提**: セキュアコンテキストでない場合は従来どおりエラー表示（変更なし）。
- **背面カメラ優先**: `facingMode: "environment"` を継続。解像度は ideal 1920x1080、min 640x480 のまま。
- **読取フォーマットの明示**: html5-qrcode の `formatsToSupport` に QR_CODE / CODE_128 / EAN_13 / EAN_8 / CODE_39 / UPC_A / UPC_E を指定し、QR と主要 1D バーコードを確実に対象にする。
- **getUserMedia 失敗時のエラー種別表示**: NotAllowedError / NotFoundError / NotReadableError / OverconstrainedError / AbortError に応じた日本語メッセージを表示。iOS の場合は「写真から読み取る」「手入力」を案内。
- **手入力 UI**: エラー画面とスキャン画面の両方で「手入力」欄と「手入力で確定」ボタンを追加。読み取り失敗時やカメラが使えない場合に番号を直接入力して確定できるようにする。
- **デバッグログ**: `NODE_ENV=development` のときのみ `[BarcodeScanner]` プレフィックスでログ出力。open 時の環境（isIOS / isAndroidChrome / secure）、コンテナ rect、scanner.start 呼び出し、getUserMedia 成功/失敗、onDetected、cleanup をログして、カメラ表示だけでもどこまで進んでいるか切り分けしやすくする。

## 3. 修正ファイル

- `src/components/BarcodeScannerModal.tsx`

## 4. 変更コード（要約）

- **定数・ヘルパー**
  - `DEBUG_BARCODE`: `process.env.NODE_ENV === "development"` で開発時のみ true。
  - `logBarcode(...)`: 開発時のみ `console.log("[BarcodeScanner]", ...)` を実行。
  - `isAndroidChrome()`: Android Chrome 判定を追加（ログ用）。

- **formatsToSupport**
  - カメラ起動時・ファイルスキャン時の両方で `Html5Qrcode` の第2引数に `formatsToSupport` を渡す。
  - 指定フォーマット: QR_CODE, CODE_128, EAN_13, EAN_8, CODE_39, UPC_A, UPC_E。

- **エラーメッセージ**
  - `err.name` と `msg` の両方を見て、NotAllowedError / NotFoundError / NotReadableError / OverconstrainedError / AbortError ごとに文言を変更。
  - iOS 時は「写真から読み取る」に加え「手入力」を案内。

- **手入力 UI**
  - エラー画面: 写真ボタンの下に「手入力（読み取れない場合）」入力欄と「手入力で確定」ボタンを追加。
  - スキャン画面: カメラ枠の下に「番号を手入力」入力欄と「手入力で確定」、および「写真から読み取る」リンクを追加。
  - 確定時は `onDetected(manualValue.trim())` と `onClose()` を実行。

- **ログ**
  - open 時: `open`, `{ isIOS, isAndroidChrome, secure }`。
  - コンテナ: `container rect`, `rect.width`, `rect.height`。サイズ不足時は `container too small, skip start`。
  - start 前: `calling scanner.start (getUserMedia)`。
  - 成功時: `scanner.start done (camera visible)`、`onDetected`, 値。
  - 失敗時: `getUserMedia/scanner error`, `name`, `msg`。
  - クリーンアップ: `cleanup: scanner stopped`。
  - ファイルスキャン: `file scan start`, `file scan result`, `file scan error`。

- **その他**
  - 写真用 `<input type="file">` をモーダル直下に1つだけ配置し、エラー画面・初回画面・スキャン画面のいずれからも同じ ref で参照するように整理。

## 5. テスト方法

### 前提
- HTTPS で配信（または localhost）。スマホ実機の場合は ngrok / Vercel 等の https URL でアクセス。
- Android: Chrome。iOS: Safari（カメラは Safari 推奨）。

### 5.1 カメラ表示の切り分け（ログ確認）

1. 開発サーバーで起動: `npm run dev`。
2. ブラウザの開発者ツールでコンソールを開く（スマホの場合はリモートデバッグ: Chrome は `chrome://inspect`、Safari は Mac の「開発」メニューから）。
3. アプリでバーコード読み取りモーダルを開き、「読取開始」または「カメラで読む」を押す。
4. コンソールに次のログが出るか確認する:
   - `[BarcodeScanner] open` + `isIOS` / `isAndroidChrome` / `secure`
   - `[BarcodeScanner] container rect` + 幅・高さ
   - `[BarcodeScanner] calling scanner.start (getUserMedia)`
   - 成功時: `[BarcodeScanner] scanner.start done (camera visible)`
   - 失敗時: `[BarcodeScanner] getUserMedia/scanner error` + エラー名・メッセージ
5. **カメラが表示されない場合**: secure が false でないか、container rect が 80 以上あるか、getUserMedia のエラー内容を確認する。

### 5.2 Android（対象端末の一つ）

1. Android 端末で Chrome を開き、HTTPS のアプリ URL にアクセス。
2. バーコード読み取りを開く → 「読取開始」→ カメラが背面で起動し、枠内にバーコードを映すと読み取れることを確認。
3. 意図的にカメラを拒否し、エラー文言（許可されていません）と「写真から読み取る」「手入力」が使えることを確認。
4. スキャン画面で「番号を手入力」に値を入れ「手入力で確定」で閉じ、親画面に値が渡ることを確認。

### 5.3 iPhone（iPhone 11 Pro / iPhone SE 等）

1. iPhone で Safari を開き、HTTPS のアプリ URL にアクセス。
2. バーコード読み取りを開く → 「カメラで読む」→ 背面カメラが起動することを確認。
3. QR / CODE_128 / EAN_13 等のバーコードを読み取り、値が返ることを確認。
4. 「写真から読み取る」で画像を選び、読み取りできることを確認。
5. 「手入力で確定」で値が渡ることを確認。

### 5.4 読み取りフォーマット

- QR コード、CODE_128、EAN_13、EAN_8 のいずれかが印字されたバーコードを用意する。
- カメラまたは写真で読み取り、正しい文字列が `onDetected` に渡ることを確認する。

### 5.5 本番ビルドでのログ無効化

- `DEBUG_BARCODE` は `NODE_ENV === "development"` のときのみ true のため、`npm run build` 後の本番では `[BarcodeScanner]` ログは出ない。本番でログを出したい場合は `DEBUG_BARCODE` を `true` に変更する（デバッグ用に限定すること）。
