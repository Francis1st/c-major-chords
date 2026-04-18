# 大调顺阶三和弦 · c-major-chords

单页小工具：在浏览器里选 **十二个大调之一**，用 **顺阶三和弦**（I–vii°）做听辨与跟弹参考。钢琴采样来自 [Salamander Piano](https://github.com/tambien/Piano)（经 jsDelivr 加载），失败时回退到内置合成器。

## 功能

- **调式**：下拉选择 C、D♭ … B 任意大调，标题与七个和弦块同步更新。
- **和弦块**：和弦名 + 罗马级数与结构提示（大三 / 小三 / 减三）。
- **触屏与鼠标**：
  - **短按**：松手后播放一次钢琴和弦（有自然衰减）。
  - **长按**（约 0.2s 后）：进入单轨 loop 的「持续」听感，松手渐弱结束。
- **排声**：在 C 大调上为固定「就近」三音位置和弦；其它调整体半音平移，减少换调时音区乱跳。
- **移动端**：竖屏单行七键、安全区、`user-select: none` 等，减轻 iPhone Safari 上布局与误选文字问题。

## 运行方式

静态站点：`index.html` + `css/app.css` + `js/` 下 ES 模块，**无需构建**；因使用 `type="module"`，请通过 **本地 HTTP** 打开（`file://` 下模块脚本常被浏览器拦截）。

**本地预览**（任选其一）：

```bash
# Python 3（在仓库根目录执行）
python -m http.server 8080
```

浏览器打开 `http://localhost:8080/`。

## 部署到 GitHub Pages

1. 将本仓库推送到 GitHub。  
2. 仓库 **Settings → Pages**：Source 选 **Deploy from a branch**，分支 **`main`**，目录 **`/(root)`**。  
3. 站点地址一般为：`https://<你的用户名>.github.io/c-major-chords/`（以 Settings → Pages 显示为准）。

首次访问建议在 Wi‑Fi 下稍等片刻，以便下载钢琴采样。

## 技术说明

- **纯静态**：HTML + 外链 CSS + **ES Modules**（`app.js` 入口；`constants` 共享配置；`music-theory` / `piano-samples` / `audio-playback` / `piano-keyboard` / `custom-chords` / `chord-pointer` 各司其职），无框架。  
- **音频**：`Web Audio API`；钢琴为 `fetch` + `decodeAudioData`，带缓存与按调预加载。  
- **字体**：Outfit、JetBrains Mono（Google Fonts，需联网）。

## 许可

钢琴音源版权归 Salamander Piano 项目及其许可条款所有；页面代码以仓库内实际声明为准（若尚未添加 `LICENSE` 文件，可自行补充）。
