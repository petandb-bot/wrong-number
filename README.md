# WRONG NUMBER v0.1.2 — SOFT HARDWARE

**A small instrument that remembers your mistakes.**

p5.js 1.11.13（画面）と Web Audio API（音響）で動作する16パッドのポケット楽器。GitHub Pagesに置いて、iPhone Safariの「ホーム画面に追加」から利用することを想定しています。操作画面内の **MANUAL / HOW TO PLAY はすべて英語**です。

## v0.1.2 の変更点

- **筐体デザイン**：クリーム／ピンクのモールド筐体、ラベンダーの液晶ベゼル、4色パッド。配置・基本の操作方法は以前と同じです。
- **SOUND BANK**：SYNTH（従来の16音色）と SAMPLE（録音・取り込み音を自動分割した16音色）の切替。初期状態はSYNTHです。
- **● MIC**：マイク録音の開始／停止。最大12秒で自動終了、音声を自動解析して16個のパッドに割り当てます。マイクの許可が必要です。録音中のマイクトラックは停止時に閉じます。
- **↑ FILE**：端末の音声ファイルを読み込んで同じ16パッドへ展開。対応形式はそのブラウザの `decodeAudioData()` 実装によります（WAV/MP3/M4Aなど）。最大25MB、最初の12秒を使用します。
- **変異・書き出し**：SAMPLEモードでもLOOP / MUTATE / KEEP / RESTORE / TAPE / MAKE WAVを利用できます。SYNTHパッドと元の音響エンジン（`audio.js`）は変更していません。
- **端末内保存**：サンプルバンクはIndexedDBへ保存を試みます。アクセス不能ならそのセッション内に限って利用できます。アップロード／サーバー送信は行いません。ブラウザのサイトデータ削除で消える場合があります。
- `sw.js` のキャッシュ名を `wrong-number-v0.1.2` に変更しました。上書き配置でも新しい画面とコードが取得されます。

## ファイル構成

- `index.html` — UI・英語MANUAL
- `style.css` — パステル筐体デザイン
- `app.js` — 演奏／シーケンサー／録音・ファイル取り込み／書き出し
- `audio.js` — 従来のSYNTH音響エンジン（v0.1.1から無変更）
- `sample.js` — NEW: 自動16スライス、SAMPLE再生と端末内保存
- `manifest.webmanifest`, `sw.js`, `assets/` — PWA
- `tests/smoke.py` — 従来機能 + ファイル取り込みとSAMPLE書き出し
- `tests/mic_mock.py` — モックの録音APIを使った開始・停止・取り込み処理テスト

## 操作

1. **SYNTH**のままパッドを叩くと、従来どおり16種類の合成音を演奏できます。素早い連打・長押しも従来どおりです。
2. **MIC**でマイクを録音（タップ開始／再タップ停止、最大12秒）。**FILE**で端末の音声を読み込むこともできます。読み込みが完了すると自動で**SAMPLE**に切り替わります。
3. **SOUND BANK**をタップすると、SYNTH / SAMPLE を切り替えられます。1つのサンプル素材から16種類の断片／ピッチ／フィルター／逆再生バリエーションを構成します。GUIに波形編集や複雑なパラメータを追加していません。
4. **LOOP**は直前のパッド演奏から2小節ループを生成します。**MUTATE**はそのパターンを変異。長押しで強い変異。**KEEP**はスナップショット、**RESTORE**の短押しはKEEPへ戻す、長押しは直前の変異の取消です。
5. **TAPE**は最大30秒の演奏をWAVとして書き出します。**MAKE WAV**は2小節のシームレスループを書き出します。どちらも44.1kHz / 16-bit PCM / stereoです。
6. MANUALの **CLEAR SAMPLE BANK** は保存済みバンクを削除してSYNTHに戻します。元のSYNTH音色・パターンは削除しません。

**音声録音の注意**：HTTPS上、またはlocalhostのようなセキュアコンテキストで開く必要があります。iPhoneのSafari／PWAのマイク権限・M4Aデコード・録音中の画面遷移・バックグラウンド制約は端末実機で確認してください。ヘッドフォンでハウリングを避け、音量を抑えて開始してください。サンプルとシーケンスの保存は別です（SYNTH/SAMPLE切替は全パターン共通）。

## GitHub Pagesへの配置

1. ZIPを展開し、**中のファイル・フォルダ全体**を既存リポジトリのルートへアップロードします。`index.html`・`audio.js`・`sample.js`・`app.js`・`style.css`・`sw.js`・`manifest.webmanifest`・`assets/` がリポジトリ直下に必要です。
2. GitHubの `Settings → Pages` で `Deploy from a branch`、`main`、`/(root)` を設定します。既存のPages設定があれば変更不要です。
3. iPhone Safariで公開URLを開き、「共有」→「ホーム画面に追加」で登録します。
4. 旧画面が残る場合はSafariのページを再読み込みしてください。旧Service Workerキャッシュは更新時に削除する実装です。

### ローカル確認

プロジェクトのフォルダで `python -m http.server 8000` を実行し、`http://localhost:8000` へアクセスします。自分のPCのIPアドレスで開いた `http://192.168...:8000` は一般にセキュアコンテキスト扱いとならず、マイクが使えないことがあります。

## 実装・テスト上の区別

- `tests/smoke.py`: Chromium（Playwright）で従来のパッド／MUTATE／KEEP／LOOP／TAPEとファイル取り込み／SAMPLE音声書き出しをテスト。
- `tests/mic_mock.py`: MediaRecorderとマイク許可APIをモックして録音開始・停止・サンプル化処理をテスト。**実機の録音テストではありません**。
- iPhone Safariおよびホーム画面PWAでの実機検証はまだ行っていません。
- 大きな音声ファイルのデコードはブラウザで処理するため、古いiPhoneではメモリ不足が起きる可能性があります。12秒程度までの短いファイルを推奨します。
- `audio.js` 内の既存の16合成音源／効果音処理に変更はありません。
