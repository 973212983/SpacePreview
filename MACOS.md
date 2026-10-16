# macOS 构建与使用（v0.9.12）

代码现已接入 Finder 空格预览和 macOS 应用生命周期。目标系统为 macOS 12.3+（WebKit/Safari 15.4+），通用构建包含 Apple Silicon 与 Intel 两种架构。前端以 Safari 15.4 为编译目标，PDF 使用 PDF.js legacy 主程序和 Worker，并为两处补齐旧 WebKit 缺少的 Promise.withResolvers；保留无法启动独立 Worker 时的内置回退。

Windows 本机已完成代码与预览回归；Mac 原生编译和安装包检查由 GitHub Actions 执行，Finder 权限交互仍须按下方清单进行实机验收。下面的本机命令需要在 Mac 上执行。

## 在 Mac 上构建

准备 Xcode Command Line Tools、Node.js 22.13+、Rust stable。在终端进入项目目录，运行：

```sh
xcode-select --install
rustup target add aarch64-apple-darwin x86_64-apple-darwin
npm ci
npm test
cargo test --manifest-path src-tauri/Cargo.toml --lib --locked
npm run desktop:build:mac
```

已安装 Xcode Command Line Tools 时跳过第一条命令。产物目录：

```text
src-tauri/target/universal-apple-darwin/release/bundle/macos/SpacePreview.app
src-tauri/target/universal-apple-darwin/release/bundle/dmg/
```

需要单一架构时，改用：

```sh
# Apple Silicon
npm run tauri -- build --target aarch64-apple-darwin --bundles app,dmg
# Intel
npm run tauri -- build --target x86_64-apple-darwin --bundles app,dmg
```

Tauri 在 Mac 上自动合并 `src-tauri/tauri.macos.conf.json`，使用 ICNS 图标、权限说明及 Apple Events entitlement。Windows 仍使用原有 NSIS 配置。

仓库附带 `.github/workflows/macos.yml`，可手动运行或由 PR 触发，生成通用 DMG artifact。

正式发布使用 `.github/workflows/release.yml`：推送与源码版本一致的 `v*` 标签后，分别在 `macos-15-intel` / `macos-15` 原生构建 Intel / Apple Silicon 包，并验证架构、临时签名完整性、DMG 与应用启动。所有平台成功后，发布包含 Windows x64、Mac Intel、Mac ARM 三个安装包及 SHA-256 清单的 Release。手动重跑时也需选择版本标签。

## 授权与使用

1. 将构建后的 SpacePreview.app 放到「应用程序」并运行。
2. 打开瞬览的「偏好设置」，点击「授权 Finder 预览」。
3. 在系统设置 → 隐私与安全性 → 辅助功能中启用瞬览；在自动化中允许瞬览控制 Finder。若键盘监听仍未就绪，检查输入监控权限并重启应用。
4. 待欢迎页显示「Space 预览已就绪」，在 Finder 中选中普通文件，按一次 Space；Shift + Space 使用纯文本模式。
5. 在预览中用 Space/Esc 或关闭按钮隐藏窗口；应用继续驻留菜单栏。点击 Dock 图标可重新打开，⌘Q 或菜单栏「退出瞬览」退出。

应用不会在启动时反复请求权限；未授权或关闭监听时，Finder 原有 Quick Look 保持可用。也可用 ⌘O、拖入窗口、拖入 Dock 图标或 Finder「打开方式」打开文件，无需空格监听权限。

此实现是主程序中的 Finder 监听，不是 Finder Quick Look Extension。只有瞬览运行且用户完成授权后，才接管符合条件的 Finder 空格按键；不改变系统文件默认打开方式。

## macOS 窗口与菜单

Mac 使用系统原生标题栏和左上角红黄绿窗口按钮，内容区工具栏保留文件导航和预览选项。红色按钮或 ⌘W 关闭预览并隐藏窗口，应用继续驻留；绿色按钮使用系统全屏行为。

屏幕顶部提供「瞬览」「文件」「编辑」「窗口」「帮助」菜单：⌘O 打开文件，⌘, 打开设置，⌘Q 退出；编辑菜单提供系统剪切、复制、粘贴、撤销和全选。菜单栏使用随系统明暗自动着色的单色图标，点击可打开窗口、选择文件、进入设置或关于页面及退出。

Mac 页面使用系统字体、蓝色侧边栏选中状态和圆角设置项；主题选择同时同步到原生窗口。浏览器预览仅展示内容区样式，红黄绿按钮和系统菜单需启动桌面版验收。

验收新增项目：

- 分别从系统菜单和菜单栏图标打开设置、关于、文件选择；窗口隐藏后重复操作。
- 验证 ⌘O、⌘,、⌘W、⌘Q，以及输入框中的 ⌘C/V/A/Z；取消文件选择后仍可继续预览。
- 验证红黄绿按钮、全屏进出、Dock 重新打开，以及浅色／深色／跟随系统的窗口外观。
- 在 640 × 480 和正常窗口尺寸检查设置滚动、预览工具栏、更多菜单和文件导航。

## Mac 实机验收清单

- 无权限时可以选择/拖入 TXT、Word、MD、PDF、ZIP、DXF、STL/OBJ、TIFF，且 Finder 自带 Space 预览仍正常。
- 授权后测试 Finder 图标/列表/分栏视图及桌面；每次选择新文件按一次 Space，分别用 Space、Esc、鼠标关闭，连续至少 10 次。
- Finder 搜索、重命名、路径输入、侧边栏，以及其他应用内的空格保持正常；Control/Option/Command 组合键不接管。
- Shift + Space 进入文本模式，长按 Space 不重复开关；关闭监听和撤销权限后恢复 Finder 默认行为。
- 关闭时回到原 Finder；开启失焦关闭后，切换其他应用不被抢回焦点。
- 「打开方式」和拖入 Dock 在冷启动/已有窗口时均显示正确文件；关闭窗口后点击 Dock 恢复。
- ZIP 内部预览与返回列表、Word/HTML iframe 中 Space、⌘O、⌘C/V/A、最大化/恢复及媒体播放实际验证。
- Apple Silicon 和 Intel 分别启动并检查，记录 macOS 版本、原生 WebKit 差异及缺失字体回退。

代码包含按键松开提交、丢失 key-up 后新按键恢复、监听中断重置、Finder 前台检查和选择读取超时。Finder 不同视图的辅助功能结构及系统权限行为仍须按上述清单验证。

## 签名与分发

当前没有 Developer ID 证书或 Apple 公证配置。发布流程设置 `APPLE_SIGNING_IDENTITY=-` 进行临时签名，并在 Release 中说明未公证。面向正式可信分发，需要使用自己的 Apple Developer ID 证书和公证凭据；Tauri 支持 `APPLE_SIGNING_IDENTITY` 及对应公证参数，不把凭据写进源码。
