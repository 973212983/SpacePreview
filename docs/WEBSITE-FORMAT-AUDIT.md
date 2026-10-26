# 官网文件类型核对

核对日期：2026-10-26。源码版本：v0.10.14。对象：`website/index.html` 中的文件类型表格。

## 结论

列出的扩展名均能找到对应预览路由，但不能据此承诺每种文件、所有版本、所有编码和所有系统均可正常预览。已接入、部分功能、样本验证和完整兼容是不同概念。

本轮在 Windows 的 Edge 浏览器中，对当前生产构建进行了样本回归。它验证浏览器引擎的处理与显示，不等于 Windows WebView2 安装包或 macOS / Linux 实机验收；没有对所有后缀分别准备真实样本。以下“本次通过”仅指列出的样本。

## 按官网类别核对

| 官网类别             | 实现与证据                                                                                                                     | 判断与限制                                                                                                               |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| 常见图片             | 系统 WebView 图片解码；图片组件支持缩放、平移与旋转                                                                            | 已接入；APNG、AVIF 等依赖具体系统 WebView，并非本次逐个编码验收                                                          |
| TIFF                 | 独立 TIFF 解码；生产引擎样本通过                                                                                               | 有页数、像素与压缩变体限制                                                                                               |
| 专业图像             | 本次 PSD、PSB、DDS、EXR、HDR、JP2、JXL、QOI、TGA、PCX、PPM、PBM、PGM、PAM、MIFF、XBM、XPM、FITS、CUR、HEIC 样本实际显示通过    | 不能将 HEIF、J2K 等别名和 XCF 等未重测格式一起计为本轮实测；也不保证所有图层/色彩变体                                    |
| 相机 RAW             | 本次真实 Canon CR2、Kodak KDC 样本解码通过；其他相机后缀路由到 LibRaw                                                          | ARW、CR3、DNG、NEF 等尚未逐一验收；通用 `.raw` 未支持                                                                    |
| 图标与矢量           | 本次 ICNS、ANI、SVGZ 结构样本和真实 WMF、EMF 样本显示通过                                                                      | ICNS 旧 RLE 图块有限制；ANI 为帧选择；WMF/EMF 是 GDI 子集                                                                |
| PDF                  | 生产引擎文字提取与页面绘制通过                                                                                                 | 扫描件无 OCR，未实现密码输入，不保证全部 PDF 特性                                                                        |
| Word 文档与模板      | DOCX 生产引擎样本通过，`docx-preview` 页面渲染已接入；DOCM/DOTX/DOTM 共用入口                                                  | 宏不执行；复杂浮动排版、图表、公式与缺失字体可能不同；模板别名不是独立实测                                               |
| 旧版 Word            | OLE / Word 二进制文字提取器；已有单元测试和历史 Office 样本记录                                                                | 只做文字速览，不还原旧 DOC 页面和图片；本次未重跑本机 Office 生成流程                                                    |
| 富文本与开放文档     | RTF 富文本渲染与 ODT/OTT 内容解析已接入；ODT 生产引擎样本通过                                                                  | 不保证 ODF 完整原始布局；OTT 共用 ODT 入口                                                                               |
| Markdown             | Markdown 生产引擎与 MMD/MDC 内容回归通过，其余后缀共用路由                                                                     | MDX 不执行组件，QMD/RMD 不运行代码，禁止远程资源                                                                         |
| 电子书               | EPUB、FB2 生产引擎样本通过                                                                                                     | FB2 以文字为主，不保证图片、脚注与所有电子书功能                                                                         |
| 文本与日志           | 文本读取、编码检测、搜索和换行已接入                                                                                           | 全文读取会占用内存；内容和编码判断是启发式；后缀并不保证内容是文本                                                       |
| 代码与脚本           | 语言注册表、语法高亮；131 项单测含路由与折叠测试                                                                               | 只读代码，不运行脚本；大文件折叠有大小和行数限制                                                                         |
| 配置与数据文本       | JSON/XML 等文本引擎、Dockerfile 生产引擎样本通过                                                                               | SQL 为源码阅读，不执行数据库查询；不是所有配置文件都有结构化解析                                                         |
| HTML                 | HTML 生产引擎与本地静态资源相关单测通过                                                                                        | 不执行脚本、不加载网络资源；同目录及子目录资源有数量与大小预算                                                           |
| 网页存档与邮件       | 本次 MHTML 结构样本、EML 正文、真实 MSG 样本通过                                                                               | MHT 共用 MHTML 入口；不保证全部浏览器导出变体、MSG 正文编码和附件类型                                                    |
| Excel 工作簿与模板   | XLSX 生产引擎通过；本次 XLS/XLSB 样本显示通过                                                                                  | 模板别名共用解析器；不执行宏、不重新计算公式，不还原完整 Excel 版式                                                      |
| 分隔符表格与旧数据表 | CSV 生产引擎通过；本次 DBF、DIF、SLK 样本显示通过，分隔符解析单测通过                                                          | 不执行公式；TSV/TAB/PSV/SYLK 等共用解析路径，不等于每个后缀独立实测                                                      |
| OpenDocument 表格    | ODS 生产引擎样本通过；OTS 共用入口                                                                                             | 有独立表格行列限制，不保证完整布局                                                                                       |
| PowerPoint           | PPTX 生产引擎文字读取通过；Windows PowerPoint 页面转换已接入                                                                   | 原始静态页面依赖本机 PowerPoint；其他环境文字速览，不运行宏/动画；本次未重跑本机 Office 转换                             |
| OpenDocument 演示    | ODP 生产引擎样本通过；OTP 共用入口                                                                                             | 内容速览，不保证原始演示布局                                                                                             |
| ZIP 及同类容器       | ZIP/条目生产引擎通过；ZIP64 由 ZIP 目录解析器处理                                                                              | ZIP64 是容器能力而非独立后缀；别名容器仍受 ZIP 算法、密码和大小限制                                                      |
| 其他压缩包           | 本次 TAR、TGZ、TAR+BZIP2/XZ/LZIP、7Z、RAR4/5、Zstandard/LZMA 归档及独立 GZIP/BZIP2/XZ 内容通过                                 | 分卷不支持；独立 LZIP/LZMA raw 流未单独接入；RAR5 样本为二进制条目，已验证提取后可查看真实字节，不计为文本预览           |
| 应用与资源容器       | 本次 ASAR、CRX2/3、CFB、EIF、MSI/MSP、Chromium PAK、AAB、APPX 系、MSIX 系、HAP、WGT/WGTU、QLPLUGIN、AR、CPIO、XAR 结构样本通过 | 浏览文件/流不等于理解安装包；PAK 仅限 Chromium 变体；不能推广为所有同名格式可用                                          |
| 二维 CAD             | DXF 生产引擎样本通过                                                                                                           | 仅 ASCII DXF 与部分图元；DWG 未支持；不是工程精度查看器                                                                  |
| 三维模型与 CAD       | 本次 3DS、FBX、PLY、3MF、BLEND、DAE、PCD、GLB、GLTF、STEP、BREP、IGES 样本显示通过；STL/OBJ 生产引擎通过                       | BLEND 样本为 Blender 2.48，不保证新版；GLTF 需内嵌几何；外部资源和动画不加载；LWO 已接入但尚未验收，已从官网表格移除     |
| SQLite 数据库        | 本次 SQLite 中文表样本读取通过，数据库单测通过                                                                                 | DB 等后缀只支持 SQLite 内容；GPKG/MBTiles 仅看数据库表，不显示地图；加密 SQLite 不支持                                   |
| 字体                 | 本次 TTF 试排/字形与 TTC 结构样本通过                                                                                          | OTF/WOFF/WOFF2 已接入但本轮未逐个实测；WOFF2 完整元数据和字形解析有限制；不安装字体                                      |
| 技术文档与图表       | 本次 AsciiDoc、Graphviz DOT/GV、Mermaid，以及 MMD Markdown 分流通过                                                            | AsciiDoc 禁止 include；图表不加载外部资源，受大小/复杂度限制                                                             |
| Notebook             | IPYNB 生产引擎样本通过                                                                                                         | 只支持 v4 内容与保存的文本输出，不执行单元格，不还原交互输出                                                             |
| Lottie 动画          | 本次 `.lottie.json`、TGS、dotLottie 结构样本的显示及播放/暂停通过                                                              | 不执行表达式，不加载远程图像/字体，不保证全部播放器特性                                                                  |
| 设计文件预览图       | 本次 KRA、Sketch、XD、XMind、FIG、CDR、PIX/PIP、PDN 内置预览图结构样本通过                                                     | 不是完整设计解析；仅部分 ZIP 容器或 PDN3 头；缺少预览图、非 ZIP FIG、旧 CDR/PDN 等变体不支持；缺各编辑器完整真实导出样本 |
| 音频                 | 原生媒体元素播放接口已接入                                                                                                     | 本次未逐个编码实播；MP3/WAV 等容器名不保证其内部编码可播放                                                               |
| 视频                 | 原生媒体元素播放接口已接入                                                                                                     | 本次未逐个编码实播；依赖 WebView2/WebKit 的容器和编码支持                                                                |

## 本轮验证结果

- `npm test`：34 个测试文件、131 项单元测试通过。
- `npm run build`：TypeScript 与生产构建通过，存在既有大块体积与 WASM 库浏览器兼容提示。
- `node scripts/smoke-preview.mjs`：21 项生产引擎检查通过，包含 PDF 文字与画布渲染。
- `node scripts/smoke-formats.mjs`：前 20 个专业图像、2 个 RAW 样本通过，随后在旧 `.archive-list` 选择器处失败；未将整份脚本计为通过。
- `node scripts/smoke-model-formats.mjs`：12 个三维/CAD 样本通过。
- `node scripts/smoke-document-formats.mjs`：旧表格、文档、图表、MMD/MDC 分流与三种动画样本通过。
- `node scripts/smoke-container-formats.mjs`：在已移除的旧 `.archive-list` 选择器失败，未计为通过；本次使用下面的新检查覆盖当前目录树。
- `node scripts/audit-format-support.mjs`：按当前目录树验证的 53 项归档、应用容器、设计缩略图、图标、数据库、字体、邮件、矢量和网页存档样本通过；另核对官网后缀路由，不把路由数量当成实测格式数量。结果写入忽略跟踪的 `test-results/format-audit.json`。

重跑之前先按 [格式清单](FORMAT_PARITY.md#可复现验证) 生成/下载样本并启动生产资源服务。新检查依赖 `create-test-fixtures.mjs`、`format-fixtures.mjs`、`download-format-fixtures.mjs` 和 `compressed-fixtures.py` 的样本，不会执行归档内脚本或安装包。网络不能访问 raw.githubusercontent.com 时，样本可通过 GitHub Contents API 读取相同源文件。

本次没有新增格式解析引擎，也没有宣称所有格式完整兼容。官网继续使用两列表格，在表格下补充支持范围，并将未验收的 LWO 从表格中移除。
