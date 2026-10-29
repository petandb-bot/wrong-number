# v0.2.4 — REAL ACCIDENTS

- 従来の別音源挿入型FXを廃止し、実際に生成したパッド音のPCMバッファを短く加工する方式へ変更。
- STUTTER / REVERSE / TAPE BEND / CRUSH を原音の置換処理として再実装。
- タイミングと音量を制御し、DUB中の自動FXを停止。前処理が間に合わない場合も通常の音を保つ。
- LCD長押しでSOFT / WILD / OFFを選択可能。UIのボタン数と配置は維持。
- ライブ、TAPE、FX付きWAVで同じ加工方法を使用。通常の2小節WAVはクリーンのまま。
- BAD SPELLINGを含む既存6キット、BLANK、NEW、MUTATE、UNDO、うさぎアニメーションの構造を維持。
- 音声・状態遷移のテストを更新。iPhone Safari実機は未検証。
