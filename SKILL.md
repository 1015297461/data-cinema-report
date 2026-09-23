---
name: data-cinema-report
description: 生成"Data Cinema"风格的浅色沉浸式单文件离线 HTML 数据分析报告（Noto Serif/Noto Sans/JetBrains Mono 字体、雾蓝白纸面主题、IntersectionObserver 滚动入场、内联 ECharts SVG 定制图表、洞察框+数据溯源+公式三件套规范、点击下钻联动）。当用户要求生成 HTML 格式的数据分析报告、研究汇报、市场分析、关键词分析、KPI 总览等"以数据图表为核心呈现"的报告时使用本 skill。不适用于纯文字散文报告、Word/PPT 文档（分别用 docx/pptx skill）。用户说"用之前的报告风格"、"用上次那个样式生成报告"时也触发本 skill。
install_method: upload
version: 2.2.0
---

# Data Cinema 数据报告生成器（浅色离线版 v2）

生成与《2026夏季关键词分析报告01.html》完全一致风格的浅色单文件 HTML 数据报告。核心特征：雾蓝白纸面主题、滚动叙事、ECharts SVG 定制图表（**库已内联，完全离线**）、图表按「章.序」编号、每图必配"一句话总结 + 数据来源 + 计算公式"三件套。

## 生成流程

1. **读模板**：读取 `assets/template.html`（约 1MB，含内联 ECharts+ZRender、浅色主题 CSS、本地化 Tailwind 类、mk() 图表封装、IntersectionObserver 交互脚本）。以它为骨架：保留 `<head>` 内联库与全部 CSS、保留脚本骨架，只替换 `{{占位符}}` 与示例块，增删章节与图表配置。**禁止再引入 ECharts/Tailwind/GSAP 等 JS CDN**。
2. **读设计规范**：读取 `references/design-system.md`，遵守主题变量、组件结构、配色语义、图表编号、内容三件套的硬性规定。
3. **按需读图表配方**：读取 `references/chart-recipes.md`，从 16 类配方（Treemap 单层与两级层级/双轴柱线/**多系列折线交互基线**/涨跌榜横纵版/同比双柱/对数轴折线/四象限散点带缩放/排名条形/渐变条形/分档双轴/占比柱/**可排序数据表**/点击下钻面板/结论卡组）中选择适配分析场景的组合，直接改造数据部分。
4. **读陷阱清单**：读取 `references/pitfalls.md`，这是多轮真实返工沉淀的坑位清单（Excel 列偏移、标签与数据错位、闭合标签丢失、动画位移压叠卡片、areaStyle 劫持悬停、配色数组越界、一个 ReferenceError 杀掉后续全部渲染等），生成时逐条规避。
5. **计算先行**：先用 Python 对源数据做聚合计算，产出精简 JSON（控制在 50KB 内）再注入 `const D = {{CHART_DATA_JSON}}`。禁止把原始明细行内嵌进 HTML。**insight 中的每个数字必须先 print 出来核对再写文案，不得凭记忆填数**。
6. **写文件**：单文件输出到 `<工作目录>/output/`。因模板含 1MB 内联库，采用**组装式写入**：正文/脚本写成独立片段文件，用 Python 拼接（head+内联库+CSS+body+script）并注入数据 JSON，避免手写大文件。
7. **验证（默认静态，不截图）**：把组装+自检写成 `build_report.py` 常驻脚本，每次改完重跑。静态自检必须全过：图表容器 id 与 `mk()` 配置一一对应、`<div>` 开闭数相等、`<script>` 开闭数相等、表格容器与 `fillTable` 调用匹配、脚本引用的 `D.xxx` 键全部存在、`node --check` 语法通过。**截图验证必须先征得用户同意**，仅在静态手段无法定位问题时才申请。

## 硬性规范（必须遵守）

- **三件套**：每个图表卡必须有 `.insight` 一句话总结（含具体数字）、`.src` 数据来源（精确到字段/筛选条件）、该图必要的计算公式。正文引用的数字必须与注入数据一致；**全部公式的完整清单另在文末附录速查表统一列出**，两处不得互相矛盾。
- **章节结构**：HERO（静态 KPI 卡片网格 2×5，含同比 pos/neg 着色）→ 01..N 分析章节 → 结论/建议章节（可选）→ **APPENDIX · METHODOLOGY（全篇最后一块，必选）**。附录内含：口径说明（精简 3 行紧凑文本：数据来源/时间口径/分组定义）+ 公式与口径速查表（三列：指标/计算公式/数据来源字段）+ 口径注意事项脚注 + 底部署名。
- **口径与公式一律收口文末**：**不再设开篇的「00 · METHODOLOGY」独立章节**，开篇只保留 HERO 的数据来源 chip 与摘要。数据口径（时间范围、分组定义、「重复累积」等多标签口径）与**全部指标公式的完整清单**统一放在文末附录；图表卡的 `.src` 行只写「该图用到的那一条公式」，不做全量罗列。
- 章节用 `sec-tag` mono 编号标签；**图表卡标题按「章.序」编号**（如 2.1、4.3）。
- **配色语义**：涨/正向 lime|cyan，跌/负向 rose，基准线 gold 虚线，上期对比系列用半透明灰 `rgba(154,167,196,.5)`；浅色底网格线统一 `rgba(24,42,63,.08)`，图表文字 #5c7a94。
- **禁止**：ECharts 默认样式、默认 tooltip、纯黑纯白背景、Arial/Times 字体、轮播/模态框等重交互、任何 JS CDN 引入（ECharts 必须用模板内联版）。
- **交互**：仅 IntersectionObserver 滚动入场（.reveal + .in 类，零依赖，**只淡入不位移**）、顶部阅读进度条、图表 resize 自适应；可选：图表点击下钻 chip 面板、散点 dataZoom 缩放、**明细表表头点击排序**（默认能力，标题加"(点击任意表头排序)"提示）。
- **季节性图**：一律自然月 1~12 排列 + 单年度柱状 + 全年月均金色虚线，峰/谷月用颜色区分；**禁止**用财年（8月~次年7月）双年对比（用户已否定为不直观）。
- **轴名从简**：`yAxis.name` 只留极简单位（如"月销量(件)"），"数值越小越好""对数轴"等说明写进图表 h3 标题，避免长轴名与刻度/图例重叠。

## 大文件写入策略

模板含 1MB 内联 ECharts，**不要整体重写模板**。推荐流程：
1. 写 `report_body.html`（正文骨架，含 HERO/章节/图表卡占位）
2. 写 `report_script.html`（`<script>` 开头、`const D = __DATA__`、各图表 IIFE 配置、表格填充、结尾 `</script>`）
3. Python 组装：`head + echarts.inline.js + css + body + script.replace('__DATA__', slim_json)`，单次写出成品
4. 若正文特别长，body 再按 `<!--__SECTION_N__-->` 占位分步 edit

## 资源

- `assets/template.html` — 完整报告骨架（内联 ECharts+ZRender / 浅色 CSS / 本地化 Tailwind / mk() 封装 / IntersectionObserver 交互），生成起点
- `assets/echarts.inline.js` — 内联 ECharts 5.5.0 库的独立副本（约 1MB，模板已含，组装式写入时可直接引用）
- `references/design-system.md` — 主题、字体、组件、图表、交互、内容规范（浅色版 v2）
- `references/chart-recipes.md` — 16 类 ECharts 图表配方代码（浅色配色 + 折线交互基线 + 可排序表 + 两级 Treemap + 下钻面板 + dataZoom）
- `references/pitfalls.md` — 实战踩坑清单与构建期静态自检断言（生成后逐条对照）
