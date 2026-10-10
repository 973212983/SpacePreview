# SpacePreview v0.9.12

瞬览是本地文件预览工具。在 Windows 资源管理器或 macOS Finder 中选中文件，按一次空格即可预览。

## 安装包

- **Windows x64**：`SpacePreview-0.9.12-windows-x64-setup.exe`，适用于 Windows 10/11，需要 Microsoft Edge WebView2 Runtime。
- **Mac Intel**：`SpacePreview-0.9.12-macos-x64.dmg`，适用于 Intel Mac，macOS 12.3 及以上。
- **Mac Apple Silicon**：`SpacePreview-0.9.12-macos-arm64.dmg`，适用于 M 系列芯片 Mac，macOS 12.3 及以上。
- `SHA256SUMS.txt` 提供三个安装包的 SHA-256 校验值。

Mac 包使用临时签名，未进行 Apple Developer ID 签名和公证。首次使用 Finder 空格预览，需要在瞬览设置中授权辅助功能和 Finder 自动化；选择文件和拖入预览不需要空格监听权限。Mac 安装包经过原生编译、架构、签名完整性、DMG 校验和启动检查，Finder 授权交互仍需实机验证。

## 主要功能与本版修复

- 图片、文本、代码、Markdown、Word、PDF、表格、ZIP、电子书、HTML、DXF、STL/OBJ、TIFF 等本地预览。
- 简洁头部，操作集中在更多菜单；Word/Markdown 大纲、细滚动条、ZIP 内部预览与返回列表。
- PDF 连续显示全部页面，支持选择和复制已有文字；扫描图片中的文字需要 OCR，本版未包含 OCR。
- Windows 本地 PowerPoint 文稿生成原始静态页面，保留图片、字体和布局，支持全页滚动、缩放、文字选择与缓存；修复文字速览中的空格、换行和字段顺序。

PowerPoint 原始页面预览需本机已安装并激活 Microsoft PowerPoint。Mac、浏览器和压缩包内无本地路径的 PPT 提供文字速览。动画和嵌入视频不播放，预览不执行文档宏。
