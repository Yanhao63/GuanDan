# 可替换音频素材

当前版本的背景音乐和游戏音效由浏览器实时生成，不使用第三方录音素材；普通话播报使用操作系统提供的中文语音，并优先选择女声。

以后替换素材时，把文件放入本目录，并在 `src/audio/gameAudio.ts` 的 `AudioAssetManifest` 中配置：

- `backgroundMusic`：循环背景音乐；
- `effects.play`、`effects.turn`、`effects.tribute`、`effects.finish`：游戏音效；
- `announcements`：以播报文字为键的预录语音文件。

推荐使用 `.ogg` 或 `.mp3`，并保留素材来源、作者与许可证记录。
