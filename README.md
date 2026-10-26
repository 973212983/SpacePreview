<div align="center">

<img src="public/app-icon.svg" alt="瞬览图标" width="88" height="88" />

# 瞬览 · SpacePreview

**不必打开，看一眼就好。**

一款本地文件预览器。选中文件，轻按空格，查看文档、图片、代码与压缩包。

[![Release](https://img.shields.io/github/v/release/likehao19/SpacePreview?label=release&color=176b55)](https://github.com/likehao19/SpacePreview/releases/latest)
![Platforms](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-567461)
![Stack](https://img.shields.io/badge/built%20with-Tauri%202%20%2B%20Rust-647c6a)
[![LinuxDo](https://img.shields.io/badge/community-LinuxDo-d4a75b)](https://linux.do/)

[下载软件](https://github.com/likehao19/SpacePreview/releases/latest) · [官网源码](website/) · [版本说明](RELEASE-NOTES.md) · [问题反馈](https://github.com/likehao19/SpacePreview/issues) · [LinuxDo 社区](https://linux.do/)

</div>

## 从文件列表，直接到内容

瞬览把临时查看文件变成一个简单的动作。在 Windows 资源管理器、桌面或 macOS Finder 中选中文件，按下 `Space` 预览，看完再按一次即可返回。Linux 当前支持拖入文件和 `Ctrl+O`，尚未接入文件管理器空格唤起。

- **本地只读**：不修改原文件，不上传文件内容。
- **多格式预览**：文档、图片、代码、表格、压缩包、音视频与部分专业格式，共用一个预览窗口。
- **专注阅读**：大纲、搜索、缩放、字体与字号调整，工具集中在「更多」菜单。
- **按需处理**：PDF 可见页与邻近页绘制，ZIP 按需读取目录和条目；切换或关闭时取消旧解析任务。
- **顺手使用**：同目录文件切换、自定义预览快捷键、明暗主题、可选开机自启动与应用内更新。

当前源码版本为 **v0.10.14**；已发布安装包以 [GitHub Releases](https://github.com/likehao19/SpacePreview/releases) 为准。最新改动包括 JSON/XML 等代码折叠、单文件大小上限、HTML 本地静态资源预览与 Word 大纲显示优化，详见 [版本说明](RELEASE-NOTES.md)。

## 能预览什么

| 内容         | 代表格式                                 | 预览方式                                                       |
| ------------ | ---------------------------------------- | -------------------------------------------------------------- |
| 文档与电子书 | PDF、DOCX、RTF、Markdown、EPUB、FB2      | 页面或阅读视图、大纲、搜索；能力因格式而异                     |
| 图片与设计   | PNG、JPEG、SVG、TIFF、PSD/PSB、HEIC 等   | 缩放、旋转；部分设计文件读取内置预览图                         |
| 代码与网页   | TypeScript、JSON、XML、HTML、配置文件    | 语法高亮、搜索、代码折叠、网页 / 阅读 / 源码切换               |
| 表格与数据库 | XLSX、XLS、CSV、TSV、ODS、SQLite         | 多工作表、虚拟滚动或记录分页；不执行宏、不重算公式             |
| 演示文稿     | PPTX、PPTM、PPT 等                       | Windows 本地借助 PowerPoint 生成静态页面；其他情况提供文字速览 |
| 压缩包与容器 | ZIP、7Z、RAR、TAR、ASAR 等               | 目录浏览、筛选、内部支持文件继续预览                           |
| CAD 与三维   | DXF、STL、OBJ、GLB、STEP 等              | 二维图纸或三维模型交互查看，支持范围因引擎而异                 |
| 媒体与更多   | 音视频、字体、EML/MSG、Mermaid、Graphviz | 本地播放、字体试排、邮件阅读与图表绘制                         |
| 未支持的格式 | 二进制文件及其他专有格式                 | 文件信息、内容签名与字节预览                                   |

完整能力、文件大小限制与实测状态见 [格式对照清单](docs/FORMAT_PARITY.md) 和 [预览使用指南](docs/PREVIEW-GUIDE.md)。支持某个扩展名不代表完整还原其所有特性；Office 复杂排版、公式、缺失字体及部分图像变体可能存在差异。

## 下载与安装

从 **[最新发布页](https://github.com/likehao19/SpacePreview/releases/latest)** 选择对应系统与架构的安装包。

| 系统            | 架构                  | 安装包                  |
| --------------- | --------------------- | ----------------------- |
| Windows 10 / 11 | x64                   | `windows-x64-setup.exe` |
| macOS           | Apple Silicon / ARM64 | `macos-arm64.dmg`       |
| macOS           | Intel / x64           | `macos-x64.dmg`         |
| Linux           | x64                   | `.AppImage` 或 `.deb`   |

以上为发布文件名中的平台后缀，完整名称包含 `SpacePreview` 与版本号。旧版与更新记录见 [全部发布](https://github.com/likehao19/SpacePreview/releases)。

### Windows

运行安装包后启动瞬览。在资源管理器或桌面选中文件，按 `Space` 即可预览。需要 Microsoft Edge WebView2 Runtime；关闭预览后应用驻留托盘，右键托盘图标可退出。开机自启动默认关闭，可在偏好设置中开启。

### macOS

打开对应架构的 DMG，将应用拖入「应用程序」。首次使用 Finder 快捷键需授予辅助功能与 Finder 自动化权限。

当前安装包使用临时签名，尚未进行 Apple Developer ID 签名和公证；原生 Finder 行为及新增预览引擎仍需 Mac 真机验收。权限设置、构建与验收说明见 [MACOS.md](MACOS.md)。

### Linux

Debian / Ubuntu 系选择 `.deb`，其他适配的发行版可选择 AppImage。AppImage 需先授予执行权限：

```sh
chmod +x SpacePreview-*.AppImage
# 然后运行下载的 AppImage，或在文件管理器中双击。
```

通过拖入文件或 `Ctrl+O` 预览。尚未接入文件管理器空格唤起；AppImage 支持应用内更新，`.deb` 用户需下载新安装包升级。

## 快速上手

1. 启动瞬览，Windows / macOS 在文件管理器中选中文件，按 `Space`。
2. 使用 `←` / `→` 切换文件，在「更多」菜单中搜索、缩放或调整阅读设置。
3. 再按 `Space` 或 `Esc` 关闭预览，回到原来的工作。

也可直接拖入文件，或使用 `Ctrl / ⌘ + O`。Windows / macOS 可分别保存自定义预览键；文件夹、Everything 与第三方文件管理器尚未接入。

| 快捷键（默认）                          | 操作                                         |
| --------------------------------------- | -------------------------------------------- |
| `Space`                                 | 文件管理器唤起预览；预览窗口内关闭           |
| `Esc`                                   | 优先关闭菜单、设置，再关闭预览               |
| `Shift + Space`                         | 请求 / 切换纯文本预览                        |
| `←` / `→`                               | 上一个 / 下一个文件                          |
| `Ctrl / ⌘ + O`                          | 选择文件                                     |
| `Ctrl / ⌘ + Shift + C`                  | 复制路径；浏览器或压缩包内部文件仅复制文件名 |
| `Ctrl / ⌘ + + / −` 或 `Ctrl / ⌘ + 滚轮` | 调整字号；Word / RTF / PDF 调整页面缩放      |
| `Enter`                                 | 默认应用打开；不启动可执行文件或脚本         |

输入框、媒体控件和聚焦按钮保留各自的按键行为。完整使用说明见 [预览使用指南](docs/PREVIEW-GUIDE.md)。

## 文件与安全边界

文件内容在本地处理；HTML 清理后展示，不执行文档脚本、不加载网络资源。本地 HTML 可在读取预算内加载同目录及子目录的 CSS、图片与字体。

单文件上限默认 **256 MB**，可在偏好设置调整为 **16–1024 MB**；压缩包内部文件同样受限，各格式仍有独立解析限制。文本、代码等部分格式会完整读取，占用内存与文件内容有关，尚未完成 GB 级真实文件性能验证。

当前 Web Worker 可取消解析，但不等于操作系统级沙箱，也不提供进程级 CPU / 内存隔离。更多实现细节见 [架构与安全边界](docs/PREVIEW-GUIDE.md#架构与安全边界)。

## 从源码运行

环境：Node.js **22.13+**、Rust stable。Windows 还需要 Visual Studio C++ Build Tools、Windows SDK 和 WebView2；macOS 需要 Xcode Command Line Tools。

```sh
git clone https://github.com/likehao19/SpacePreview.git
cd SpacePreview
npm ci
npm run desktop
```

浏览器开发模式：

```sh
npm run dev
# http://127.0.0.1:1420
```

浏览器版支持本地文件选择、拖入和内置示例，不具备文件管理器全局快捷键、真实路径与默认应用打开权限。

### 构建与验证

```sh
npm test
npm run build
npm run test:preview
cargo test --manifest-path src-tauri/Cargo.toml --lib
cargo fmt --manifest-path src-tauri/Cargo.toml --check
npm run desktop:build
```

macOS 通用构建在 Mac 上执行 `npm run desktop:build:mac`。平台构建要求与手动回归记录见 [TESTING.md](TESTING.md)、[MACOS.md](MACOS.md) 和 [应用内更新](docs/UPDATING.md)。

## 官网

官网位于 **[website/](website/)**，使用独立的 HTML、CSS 和 JavaScript，无构建步骤。直接打开 [website/index.html](website/index.html)，或运行：

```sh
python -m http.server 8080 --directory website
```

访问 `http://localhost:8080`。网站包含可切换的预览界面示意、功能介绍、格式说明、平台下载和 LinuxDo 社区入口。部署说明见 [官网 README](website/README.md)。

## 交流与贡献

欢迎通过 [GitHub Issues](https://github.com/likehao19/SpacePreview/issues) 提交可复现的问题和具体功能建议，也欢迎到 **[LinuxDo 社区](https://linux.do/)** 交流使用体验。

反馈问题时，请提供系统版本、瞬览版本、文件格式、复现步骤和相关日志；分享样本前先移除私人信息。提交代码前请运行与改动相关的测试与构建检查。所有源代码文件使用 UTF-8 无 BOM。

技术栈：Tauri 2、Rust、React 19、TypeScript，以及面向各格式的本地预览引擎。第三方组件说明见 [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md)。

历史迭代记录已移至 [历史更新](docs/HISTORY.md)，当前版本变更见 [RELEASE-NOTES.md](RELEASE-NOTES.md)。本 README 的信息组织参考 [InkNote](https://github.com/likehao19/InkNote)。
