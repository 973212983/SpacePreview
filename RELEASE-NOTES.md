# SpacePreview v0.10.13

## 安装包

- Windows x64：`windows-x64-setup.exe`。
- macOS Intel：`macos-x64.dmg`；Apple Silicon：`macos-arm64.dmg`。
- Linux x64：Debian/Ubuntu 使用 `.deb`，其他兼容发行版可使用 AppImage。
- 同时发布签名更新包、更新清单和 SHA-256 校验文件。

## 预览与检索

- 修复窗口按钮和目录按钮获得焦点后，空格触发按钮操作而无法关闭预览的问题。
- Markdown 大纲不再截断于 1000 个章节；Word、Markdown 目录行距更紧凑，移除点击时的位移动画。
- Ctrl/Command+F 打开文件内检索，支持文本、代码、Markdown、Word、PDF、表格、电子书等预览；目录搜索提供清空按钮。
- PDF 显示具体加载错误，区分密码保护与无效内容；PDF、Word/RTF 可重新加载，清除旧任务与资源。
- 开发环境提前准备 PDF Worker，减少首次加载时的依赖重优化。

## 平台说明

Linux 首版支持拖入文件或 Ctrl+O 选择文件进行预览，尚未接入 Linux 文件管理器的空格唤起。AppImage 需要授予执行权限；应用内更新针对 AppImage，`.deb` 用户请下载新安装包升级。Linux 包在 Ubuntu 22.04 构建，实际兼容性取决于发行版与桌面环境。

macOS 使用临时签名，尚未进行 Apple Developer ID 签名和公证。Finder 空格预览需要辅助功能与自动化授权。

PDF/Word 原始间歇性加载失败尚未稳定复现；重新加载恢复流程的实机回归仍待完成，不能保证所有文件变体已修复。
