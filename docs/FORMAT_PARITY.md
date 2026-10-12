# 格式支持对照与验收状态

当前开发版本：v0.10.0。此清单记录实际预览能力，避免把“增加后缀”当成完成格式支持。

对照来源：[QuickLook 官网](https://quicklookapp.vercel.app/) 与
[SUPPORTED_FORMATS.md](https://github.com/QL-Win/QuickLook/blob/d72d0d24cda6aa4d90b36aa7d414aab4bb3fdf81/SUPPORTED_FORMATS.md)。
该源码文档包含 376 个去重条目，混合后缀、别名、内置能力及特殊格式；文件自身注明清单尚未更新完毕。这不是 376 个独立解析器，也不等于每种变体都能原样显示。

## 本轮已接入

“实测”指 Windows Edge 中，在桌面正式 CSP 下打开真实文件或注明来源的结构样本。
纯 JS/WASM 引擎可用于 Windows/macOS，但本轮没有 Mac 真机验收。

Windows 打包后的 WebView2 已额外验证 HEIC 解码、7Z 目录、独立 BZIP2/XZ 内的中文内容、STEP 几何、SQLite 中文表记录及 MSG 中文正文；这些测试等待实际内容加载完成。旧版 PPT 另通过原生 PowerPoint 转换、缓存复用及原文件字节不变检查。

| 分类        | 接入能力                                                                                                                                     | 验证与边界                                                                                                                                                                                                                                 |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 专业图片    | PSD/PSB、HEIC/HEIF、DDS、EXR/HDR、JP2/J2K/JPC/JPF/JPX、JXL、QOI、TGA、PCX、PBM/PGM/PNM/PPM/PAM、MIFF、XBM/XPM、FITS/FIT、DCM/DICOM、XCF、CUR | 已实测 PSD、PSB、HEIC、DDS、EXR、HDR、JP2、JXL、QOI、TGA、PCX、PPM、PBM、PGM、PAM、MIFF、XBM、XPM、FITS、CUR；其余别名/变体已接入但未单独验收。每页最多 1 亿像素、4096 页/图层；内存限额 512 MB、解析 120 秒。                             |
| 相机 RAW    | ARW、CR2、CR3、CRW、DCR、DNG、ERF、FFF、IIQ、K25、KDC、MDC、MEF、MOS、MRW、NEF、NRW、ORF、PEF、RAF、RW2、RWL、SR2、SRF、SRW、X3F             | 真实 Kodak KDC 和 Canon CR2 已实测。依赖 LibRaw，其他相机变体尚需样本验证；通用 RAW 缺少尺寸/位深信息时无法可靠解码。MDC 根据内容区分相机文件与 Cursor Markdown。                                                                          |
| 图标、矢量  | ICNS、ANI、SVGZ、WMF、EMF                                                                                                                    | ICNS PNG 图块、ANI 两帧、中文 SVGZ 已通过结构样本验证；真实 WMF/EMF 已实测。ICNS 支持 PNG/JP2 图块，不含旧 RLE 图块；ANI 为帧选择而非自动播放；WMF/EMF 为 GDI 子集，16 MB/10 万记录，可能缺少 EMF+ 效果。                                  |
| 压缩包      | RAR、7Z、TAR、TGZ、GZ、BZ2、XZ、LZ、LZMA、ZST/ZSTD、CB7/CBR/CBT、AR、CPIO、XAR、ISO、DEB/DDEB                                                | RAR4/5、7Z、TAR、TGZ、TAR+BZIP2/XZ/LZIP/LZMA/Zstandard、独立 GZIP/BZIP2/XZ、AR/CPIO/XAR 已验证。ISO、DEB/DDEB 已注册但尚无独立真实样本验收。分卷未支持；独立 LZIP/LZMA raw 流尚未单独接入。                                                |
| 应用容器    | ASAR、CRX2/3、CFB、EIF、Chromium PAK v4/v5、MSI/MSP；APPX/APPXBUNDLE、MSIX/MSIXBUNDLE、AAB、HAP、WGT/WGTU、QLPLUGIN                          | 目录、中文文本/图片、返回选择通过结构样本验证。ASAR/PAK 按范围读取，不读取完整资源包；ASAR 不读取外置 unpacked 文件及链接；CFB/MSI 是流列表，不执行安装、不解析 MSI 数据库语义；PAK 不涵盖游戏专用同名格式。                               |
| 三维 / CAD  | PLY、3DS、FBX、3MF、BLEND、GLB/GLTF、DAE、LWO、PCD、STEP/STP、IGES/IGS、BREP                                                                 | 除 LWO 外已用真实或结构样本验证几何显示、旋转。BLEND 测试版本为 Blender 2.48；不能保证所有新版。GLTF 必须内嵌几何；不加载外部贴图/动画。新增引擎最多 100 万三角面；STL/OBJ 原有上限保留。                                                  |
| SQLite      | SQLITE/SQLITE3、DB/DB3、SDB/S3DB、SL3、SQLITEDB、GPKG、MBTILES                                                                               | 405 条记录/3 页、末尾数据、Unicode 表名、视图、NULL/BLOB、结构均验证。只读，不修改原文件；GPKG/MBTiles 显示数据库表，不绘制地图。不支持加密 SQLite、DuckDB 或 LiteDB。                                                                     |
| 字体        | TTF、OTF、WOFF、WOFF2、TTC                                                                                                                   | TTF 与双字体 TTC 切换实测；浏览器实际 FontFace 试排。WOFF2 显示样本文字，完整元数据/字形解析不保证。原字体不安装到系统，关闭预览释放。                                                                                                     |
| 邮件        | EML、MSG                                                                                                                                     | 真实 CJK MSG、MIME 中文/旧编码正文、附件预览和返回已验证；MSG 补读二进制 HTML 正文。压缩 RTF 正文未单独还原；不加载远程图片。                                                                                                              |
| 网页存档    | MHT、MHTML                                                                                                                                   | MIME 中文解码、内嵌图片、内嵌 CSS 已实测。Content-Location/CID 映射为本地 data URI，不执行脚本/表单，不访问远程资源。不保证嵌套框架或每种浏览器导出变体。                                                                                  |
| 旧版 Office | DOC/DOT、PPT/PPS/POT                                                                                                                         | 本机 Office 生成的 DOC/PPT 中文样本与两页内容实测。DOC 为文字速览，不保留页面、图片、样式或标题层级；Word 97 以前/加密文档未支持。PPT 在 Windows 本地可复用 PowerPoint 页面转换；其他环境为文本内容。DOT 按内容区分 Word 模板与 Graphviz。 |
| 旧版表格    | XLS、XLSB、XLT、XLW、DBF、DIF、SLK/SYLK、PSV                                                                                                 | XLS/XLSB 多表、3102 行、中文 GBK DBF、DIF/SYLK 中文均测试；完整读取，无本轮新增行数截断。显示保存值，不计算公式、不执行宏，版式不模拟 Excel。PSV 使用竖线分隔，支持引号内竖线/换行。                                                       |
| 文档 / 图表 | AsciiDoc ADOC/ASCIIDOC/AD、Mermaid/MMD、Graphviz DOT/GV                                                                                      | 中文、大纲、加粗、图表标签通过正式 CSP 实测；MMD 按内容判断 MultiMarkdown。AsciiDoc 禁止 include；Graphviz 在可终止 Worker 绘制；Mermaid 限 20 万字符/2500 条边，不加载外部图像。                                                          |
| 动画        | LOTTIE、TGS、LOTTIE.JSON                                                                                                                     | JSON/TGS/dotLottie 显示与播放/暂停实测；多动画和本地资产有单测。使用无表达式执行的播放器，不加载远程图像/字体。                                                                                                                            |
| 设计文件    | KRA、Sketch、XD、XMind、FIG、CDR、PIX/PIP、PDN3                                                                                              | 通过符合格式容器结构的预览图样本验证。ZIP 类型设计文件读取内置 PNG；PDN3 从 XML 头读取 PNG。未获取每种编辑器的真实导出样本；没有内置预览图、旧 RIFF CDR/旧 PDN 或非 ZIP FIG 变体会明确报错。不是设计编辑器。                               |

## 压缩包、大文件和生命周期

- ZIP/ZIP64 保留按范围读取目录及条目、CRC 校验；Stored/Deflate，目录最多 16 MB/10 万条目，单项压缩与展开均 32 MB，不支持 ZIP 密码。
- RAR/7Z/TAR 等由可终止 WASM Worker 处理，目录最多 10 万项，单项最多 256 MB；密码位于更多菜单。条目路径用于展示，不写磁盘、不执行内部文件。
- ASAR/PAK/CRX/XAR 使用范围读取；CFB 与普通非 ZIP 归档读取完整容器后解析。不是所有压缩包都具有同样的大文件内存表现。
- GZIP/Zstandard/BZIP2/XZ 解码输出最多 256 MB；先判断 TAR 目录，否则展示一个内部文件。加载动画后显示完整内容，不拆分为文本片段。
- 关闭/切换终止旧 Worker；解压与主要 WASM 解析设有超时。数据库查询可通过关闭预览终止；Word/RTF/WMF/EMF 最终 DOM 绘制仍在主线程。
- 表格虚拟滚动只减少绘制行数，解析数据仍在内存；数据库每页 200 条可访问所有记录。没有宣称 GB 级文档都能流畅预览。

## 仍需开发的格式

这次开发没有完成下列缺口，不能把它们归入“已支持”：

| 分类          | 尚未接入内容引擎 / 未实现能力                                                                                 |
| ------------- | ------------------------------------------------------------------------------------------------------------- |
| Office        | VSD/VSDX、旧 DOC 原始排版、DOC/PPT 密码；ODF 的完整原始布局                                                   |
| 文档 / 电子书 | RST 正式渲染（当前为源码）、CHM、MOBI、DjVu、XPS、网络 URL 页面预览                                           |
| 专业图像      | JXR/WDP、CLIP、Greenfish GFI/GFIE、SVGA、通用 RAW、更多相机格式、旧 ICNS 图块                                 |
| 图表 / 设计   | DrawIO、Excalidraw、PlantUML；设计文档完整画布和更多非 ZIP 变体                                               |
| 工程 / 地理   | DWG/DWT/DWS、SolidWorks SLDPRT/SLDASM、MAX、PLT/CGM、SHP 地图                                                 |
| 数据          | Parquet/Arrow/Feather、Avro、DuckDB、LiteDB、HDF5                                                             |
| 系统文件      | ELF/Mach-O/PE 深度结构、证书、Prefetch、Minidump、DS_Store、Thumbs.db 缩略图语义；目前多数为文件信息/字节查看 |
| 专用安装包    | DMG、AppImage、RPM 的专用元数据/资源解析；ZIP/OLE 容器支持不等于完整安装包语义支持                            |
| 音视频        | MKV/AVI/WMV/FLV 等容器和更多编码的独立媒体引擎；当前系统媒体播放能力不能当作全格式支持                        |
| 外部插件格式  | Torrent、HWP、MIDI、PAG、NIfTI/NRRD、XDF、SNP/PBP、VRM 等尚未接入，需分别确认格式规范与可用引擎               |

## 可复现验证

```sh
npm test
npm run build
node scripts/format-fixtures.mjs
node scripts/download-format-fixtures.mjs
python scripts/compressed-fixtures.py
# Windows 且安装 Office 时生成旧版 Office 测试文件：
pwsh -File scripts/create-legacy-office-fixtures.ps1
# 启动生产资源服务，测试脚本默认 http://127.0.0.1:1423：
npm run preview -- --port 1423 --strictPort
node scripts/smoke-formats.mjs
node scripts/smoke-model-formats.mjs
node scripts/smoke-document-formats.mjs
node scripts/smoke-container-formats.mjs
node scripts/smoke-legacy-formats.mjs
# Windows 打包后，可使用临时本机 WebView2 调试端口验收包内资源：
node scripts/smoke-native-formats.mjs
```

旧版 Office fixture 脚本含中文且采用 UTF-8 无 BOM；Windows PowerShell 5.1 需先以 UTF-8 读取脚本文本，或使用 PowerShell 7 直接运行。其他平台不运行 Office COM 脚本，纯解析单测不依赖 Office。UI 测试使用 Edge；真实 Mac 验收仍未完成。

公开样本来源见 `scripts/download-format-fixtures.mjs`。压缩包/字体集合/设计预览图的结构样本由测试脚本生成；它们验证目录和读取流程，不能替代所有真实导出变体的兼容性测试。
