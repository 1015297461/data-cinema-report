# Data Cinema Report

一个用于生成 **「Data Cinema」风格浅色沉浸式单文件离线 HTML 数据分析报告** 的 WorkBuddy / Claude Skill。

核心特征：雾蓝白纸面主题、滚动叙事（IntersectionObserver 淡入）、内联 ECharts SVG 定制图表、图表按「章.序」编号，且**每图必配三件套**——一句话总结 + 数据来源 + 计算公式。

## 适用场景

- 以数据图表为核心呈现的 HTML 报告：数据分析、研究汇报、市场分析、关键词分析、KPI 总览
- 用户说「用之前的报告风格」「用上次那个样式生成报告」时

**不适用**：纯文字散文报告、Word / PPT 文档（分别用 docx / pptx skill）。

## 安装

把本仓库内容放到 skills 目录下即可：

```bash
git clone https://github.com/1015297461/data-cinema-report.git \
  ~/.workbuddy/skills/data-cinema-report
```

（项目级安装则放到 `<项目>/.workbuddy/skills/data-cinema-report`。）

## 目录结构

```
data-cinema-report/
├── SKILL.md                    # Skill 主入口：生成流程与硬性规范
├── assets/
│   ├── template.html           # 完整报告骨架（内联 ECharts+ZRender / 浅色 CSS / 本地化 Tailwind / mk() 封装 / 交互脚本）
│   └── echarts.inline.js       # 内联 ECharts 5.5.0 独立副本（约 1MB，供组装式写入引用）
└── references/
    ├── design-system.md        # 主题、字体、组件、图表、交互、内容规范（浅色版 v2）
    ├── chart-recipes.md        # 16 类 ECharts 图表配方代码
    └── pitfalls.md             # 实战踩坑清单与构建期静态自检断言
```

## 设计要点

- **完全离线**：模板已内联 ECharts + ZRender，禁止再引入任何 JS CDN。
- **三件套**：每个图表卡必须有 `.insight` 一句话总结（含具体数字）、`.src` 数据来源（精确到字段/筛选条件）、计算公式说明。
- **章节结构**：HERO（KPI 卡片网格）→ 01..N 分析章节 → 结论/建议（可选）→ 文末 `APPENDIX · METHODOLOGY`（精简口径说明 + 公式速查表）。口径与公式统一收口在全篇最后一块，开篇不设独立章节。
- **配色语义**：涨/正向 lime|cyan，跌/负向 rose，基准线 gold 虚线，上期对比系列用半透明灰。
- **交互克制**：仅滚动淡入、顶部阅读进度条、图表 resize 自适应；可选点击下钻、dataZoom、表头排序。
- **生成流程**：计算先行（Python 聚合出精简 JSON 注入）+ 组装式写入（避免手写 1MB 大文件）+ 构建期静态自检。

详细规范见 `SKILL.md` 与 `references/`。
