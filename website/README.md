# 瞬览官网

使用原生 HTML、CSS 和 JavaScript，无框架、无构建步骤、无外部字体或脚本依赖。

## 本地预览

直接用浏览器打开 `index.html` 即可。也可在项目根目录运行：

```sh
python -m http.server 8080 --directory website
```

然后访问 <http://localhost:8080>。

## 文件

- `index.html`：官网内容，包含功能、格式、下载、常见问题和社区入口。
- `styles.css`：蓝绿色响应式样式，适配桌面和手机。
- `script.js`：Markdown、代码、压缩包三个内置界面示意的切换。
- `assets/app-icon.svg`：来自项目 `public/app-icon.svg` 的软件图标。

演示不读取用户文件。下载入口统一指向 GitHub 最新发布页，用户按系统与架构选择安装包，避免固定版本下载链接失效。LinuxDo 使用 <https://linux.do/>，未冒用某个项目讨论帖。

## 部署和更新

将本文件夹的内容上传到任意静态网站托管服务，以 `index.html` 为首页即可；支持部署到子目录。当前仅创建本地文件，未发布到线上。

发布新版时同步更新 `index.html` 的版本标签、功能和平台说明。图标更新后，从 `public/app-icon.svg` 复制到 `website/assets/`。修改交互后检查三个演示按钮、键盘操作、FAQ 展开以及手机布局。

自动检查可在项目根目录安装项目依赖后运行 `node scripts/smoke-website.mjs`，需要本机 Microsoft Edge。覆盖离线打开、交互、六种视口宽度和文档本地链接，并将桌面与手机截图保存到忽略跟踪的 `test-results/`。
