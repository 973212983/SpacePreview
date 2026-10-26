# 瞬览官网

原生 HTML、CSS 和 JavaScript，无框架、无构建步骤、无外部字体或脚本依赖。以白底、深色标题、蓝色按钮和真实软件截图呈现产品，样式参考 [InkNote 官网](https://inknote.likh.cn/)。

## 本地预览

直接用浏览器打开 `index.html` 即可，也可在项目根目录运行：

```sh
python -m http.server 8080 --directory website
```

然后访问 <http://localhost:8080>。

## 文件与截图

- `index.html`：产品介绍、真实截图展示、功能、文件类型表格、四个平台下载入口和常见问题。
- `styles.css`：白底蓝色响应式布局，适配手机与桌面，支持减少动态效果的系统设置。
- `script.js`：七张截图的切换、方向键导航、图片放大与关闭。不读取本地文件，也不请求外部接口。
- `assets/app-icon.svg`：来自项目 `public/app-icon.svg` 的软件图标。
- `assets/preview-*.png`：用户提供的 Windows 版真实截图，按原图复制，未裁剪或重绘软件界面。

截图来自用户提供的 `帖子.md` 中引用的图片。选择的文件对应如下，便于以后更新：

| 本地文件               | 原图片文件名                                     | 内容                |
| ---------------------- | ------------------------------------------------ | ------------------- |
| `preview-archive.png`  | `image-235a2943-8548-49df-9dd5-e71dfc9f7a23.png` | ZIP 目录与内部图片  |
| `preview-code.png`     | `image-e2d5526a-e1b6-48a1-b508-bc7a367ae2f7.png` | JSON 代码高亮与折叠 |
| `preview-word.png`     | `image-cec7023e-3d4a-4682-a84d-5093ffee3554.png` | Word 页面与大纲     |
| `preview-pdf.png`      | `image-a37219f7-edda-4efb-871c-7dcd0a5de3c4.png` | PDF 阅读            |
| `preview-tar.png`      | `image-a96763fd-8ea3-4adf-82d3-aff88c91a388.png` | TAR 目录与内部源码  |
| `preview-html.png`     | `image-9c5f6682-e9ba-4387-a06d-a57b63ad76c0.png` | 本地 HTML 网页      |
| `preview-settings.png` | `image-178a51b4-78cc-48f2-b3bd-e1ef7012e90c.png` | 通用设置            |

截图按需加载；点击后可放大，支持 Esc、关闭按钮和点击遮罩关闭。不支持 dialog 的浏览器或禁用脚本时，点击图片仍可直接打开原图。所有图片在本文件夹内，不依赖帖子文件或其他本机路径。

## 下载与部署

下载入口指向 GitHub 最新发布页，由用户选择系统与架构，避免固定版本文件名失效。macOS Intel 与 Apple Silicon 分开列出，Linux 为 x64 的 AppImage / DEB。

将本文件夹的内容上传到静态网站托管服务，以 `index.html` 为首页即可，支持子目录部署。当前改动保存在本地，未部署到线上。

## 更新与检查

发布新版时同步更新版本、格式与平台说明。更换截图时同步调整 `script.js` 中的说明、`index.html` 中的默认截图与图片尺寸；更换图标时从 `public/app-icon.svg` 复制到 `assets/`。

安装项目依赖后，在项目根目录运行：

```sh
node scripts/smoke-website.mjs
```

需要本机 Microsoft Edge。检查覆盖离线打开、截图切换与键盘操作、放大与关闭、格式表格、FAQ、下载和导航链接、六种视口宽度、禁用脚本后的内容，以及 Markdown 本地链接。桌面和手机截图保存到忽略跟踪的 `test-results/`。
