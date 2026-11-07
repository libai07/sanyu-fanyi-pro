# 三语翻译 · Pro

## 使用方法

1. 将本项目的 `public/`、`functions/` 和 `wrangler.toml` 上传到 GitHub 仓库。
2. 在 Cloudflare Pages 中连接该仓库，设置：
   - Build command：留空
   - Build output directory：`public`
   - Root directory：留空
3. 部署完成后，进入 **Settings → Variables and Secrets → Production**，添加：
   - `GEMINI_API_KEY`：你的 Google AI Studio API Key
4. 重新部署项目，打开 Pages 提供的域名即可使用。
5. 输入或粘贴文本，停止输入 0.75 秒后自动翻译。

如需排查错误，可在 Cloudflare 的 Pages Functions Logs / Workers Logs 中查看运行日志。
