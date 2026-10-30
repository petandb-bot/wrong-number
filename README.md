# WRONG NUMBER v0.3.1 — SHORT CIRCUITS

スマートフォンで演奏する小さな電子楽器。p5.js + Web Audio API、GitHub Pages向け。

## 使い方

- **PAD**：叩く／連打／長押しで音が変わる。
- **NEW**：ビートを生成。長押しで密度の高いビート。
- **BLANK**：4拍カウント後に自由に録音。何周でも重ね録り。
- **LOOP / DUB**：再生・停止／録音のON・OFF。
- **MUTATE / UNDO**：変形／取り消し。
- **液晶**：タップでうさぎと4組のステップ表示を切替。長押しでFXの頻度を切替。
- **MEM A/B/C**：空枠タップで保存。保存済みタップで呼び出し。長押しで上書き。
- **TAPE / WAV**：演奏録音／ループ書き出し。WAV長押しでFX付き4小節。

BAD SPELLINGは短い音声チップ風の16発声です。ほかの5キットの音源は変更していません。

## 公開

ZIP内の `index.html`, `app.js`, `audio.js`, `style.css`, `icons.js`, `sw.js`, `manifest.webmanifest`, `assets/` をリポジトリ直下に配置。GitHubで **Settings → Pages → Deploy from a branch → main → /(root)** を有効化。iPhone Safariからホーム画面へ追加できます。

上書き時はフォルダの中身を配置してください。古い表示が残る場合はSafariのページを再読込し、ホーム画面アプリを再起動してください。

## テストと制限

`node tests/test-audio.cjs`, `node tests/test-app.cjs`、Playwright/Chromiumで動作確認。`tests/speech_signal_review.py` は16音の数値検査。iPhone Safari実機では未検証です。A/B/CとUNDOはブラウザ保存であり、ブラウザデータ消去時に失われます。DUBは打鍵位置・音色変化を保存しますが、即興FX自体は固定せず、TAPEで録音します。
