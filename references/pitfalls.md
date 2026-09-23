# Data Cinema 报告陷阱清单（实战踩坑，生成与自检时逐条对照）

本清单来自多轮真实返工，每条都是**曾经出错并被用户指出**的问题。生成后按「自检命令」段落逐条跑一遍。

## A. 数据摄取层

**A1 Excel 列偏移——表头必须逐列核对，不能按列数推算**
- 症状：销量/销售额整体翻倍或错位。
- 原因：表头月份列数量与预期不符时（如实际 24 个月却按 25 列切片），把销售额首列当成了销量末列。
- 做法：先打印 `hdr[0:N]` 与首行数据对齐核对，确认「销量起止列」「销售额起止列」「月份顺序（升序/降序）」三件事再计算。
- 尤其注意：源表常是**降序月份**（2026-09 → 2024-09），做趋势图前必须 `reversed()`。

**A2 标签数组与数据数组错位**
- 症状：横坐标写 8月~7月，数据却是 1~12 月顺序，每个月显示的都是别的月的值。
- 做法：标签数组与数值数组必须来自**同一次排序**；改排序时两个一起改，或干脆用 `{月: 值}` 字典映射后再排序输出。

**A3 财年切法不直观**
- 用户明确否定「2024-08~2025-07 vs 2025-08~2026-07」双年对比。
- 季节性一律：**自然月 1~12 排列 + 单年度柱状 + 全年月均金色虚线**，峰值月/谷值月用颜色区分（峰=coral，谷=rose，其余=cyan）。同比结论写进 insight 文字，不塞进图里。

## B. HTML 结构层

**B1 字符串替换丢闭合标签 → 卡片外框残缺**
- 症状：某张卡片的白色圆角边框"缺一块"，与相邻卡片粘连。
- 原因：用 `body.replace(旧文案, 新文案)` 改 insight/src 文字时，新字符串末尾漏了 `</div>`。
- 强制自检：构建后跑 `len(re.findall(r'<div\b', html)) == html.count('</div>')`，不等就报错中止。

**B2 Python 拼 `</script>` 写成字面量 → 整页空白**
- 症状：截图全白，什么都没了。
- 原因：在 Python 三引号字符串里写 `'</' + 'script>'`，拼接表达式被当字面量写进文件，script 永不闭合，后续整个 body 被吞。
- 做法：用 `chr(60) + '/script' + chr(62)` 或先把闭合标签存变量再拼接；构建后断言 `<script` 与 `</script>` 数量相等。

**B3 路径解析误匹配**
- `glob('cls_parts/part*.txt')` 配 `p.split('part')[1]` 会命中目录名 `parts` 里的 `part`，抛 `ValueError: invalid literal for int()`。
- 做法：排序键用 `re.search(r'part(\d+)\.txt$', p)`，别用 split。

## C. 布局与视觉层

**C1 入场动画 translateY 大于卡片间距 → 模块重叠**
- 症状：用户报「每个模块的外框没有独立显示，重叠到一起」。
- 原因：`.reveal{transform:translateY(28px)}` 而卡片 `mb-6` 只有 24px，动画过程中卡片下移压叠下一张。
- 做法：**入场动画只用 opacity 淡入，不做位移**（模板已改）。若一定要位移，必须 `translateY < 卡片间距`。

**C2 相邻卡片无间距（尤其"在末卡后再追加一张"时）**
- 症状：两张卡片白框紧贴、中间 0 间距（典型如 2.5 表格卡与 2.6 图表卡粘连）。
- 根因：规范是「同一 section 内除**最后一张**卡片外都要 `mb-6`」。当你往章节**末尾追加新卡片**时，原来的末卡（当初按"末卡"写的 `class="card p-6 reveal"`，**没有** `mb-6`）就变成了中间卡，必须补上 `mb-6`；否则新末卡与它贴合。这是追加卡片时最容易漏的一步。
- 做法：追加卡片后，把**上一张末卡**的 class 改成 `card p-6 reveal mb-6`，新末卡保持无 `mb-6`。
- 构建期强制自检（务必内置到 build 脚本，扫描 body/成品 HTML）：
```python
import re
for si,s in enumerate(re.split(r'(?=<section)', body)):
    if '<section' not in s: continue
    cards=re.findall(r'<div class="card p-6 reveal( mb-6)?">', s)  # group='' 或 ' mb-6'
    titles=re.findall(r'<h3 class="font-bold mb-1 text-lg">([^<]+)', s)
    n=len(cards)
    for i,mb in enumerate(cards):
        assert not (i<n-1 and not mb), f"缺间距: 第{si}节 卡片 {titles[i].strip()}"
```
- 推广：任何"在章节内增删/重排卡片"的改动后都要重跑此审计，因为末卡身份会随之改变。

**C3 长轴名与刻度/图例重叠**
- 症状：`yAxis.name` 写成「ABA排名(小=好)」「月销量(件·对数轴)」这类长文本，与顶部刻度或图例撞在一起。
- 做法：**轴含义写进图表标题（h3）**，`yAxis.name` 只留极简（如"月销量(件)"）或省略。

**C4 对数轴折线不要加 areaStyle**
- `type:'log'` 折线加面积填充会渲染异常。对数轴图一律纯折线。

## D. 交互层（ECharts）

**D1 `tooltip.trigger:'axis'` 会绕过 series 悬停聚焦**
- 症状：配了 `emphasis:{focus:'series'}` 但悬停毫无反应。
- 原因：axis 触发接管了整个图表区的悬停（弹全系列数据面板），不再触发单条线的 emphasis。
- 做法：需要「悬停某条线→聚焦该线+只看它的数据」时，用**默认 item 触发**（不要覆盖 tooltip.trigger）。

**D2 主线 areaStyle 劫持全图悬停目标（最隐蔽的坑）**
- 症状：参考报告里效果正常，复制到新报告后"悬停任何位置都只聚焦同一条线"。
- 原因：参考报告的主线是**最下方**的线，面积块很薄；新报告主线是**最上方**的线，它的 areaStyle 覆盖整个绘图区，鼠标落在任何细线上实际命中的都是这块面积。
- 做法：**主线只在"位于图区底部/面积小"时才用 areaStyle**；否则一律不加，靠 `width:3 + symbolSize:6 + z:10` 区分主线。

**D3 blur 默认淡出不明显**
- 只写 `emphasis:{focus:'series'}` 时其余系列淡出很弱，用户会认为"没效果"。
- 必须显式：`blur:{lineStyle:{opacity:.08}, symbolSize:2}`，并给 emphasis 加粗 `lineStyle:{width: 原宽+2}`。

**D4 多系列配色数组长度要 ≥ 系列数**
- 症状：把 TOP6 扩到 TOP10 后，`lineStyle[6]` 为 undefined，颜色/宽度全崩。
- 做法：配色数组用 `pal.map((col,i)=>({color:col, width:i===0?3:1.8, z:10-i}))` 生成，或按 `i % pal.length` 取色，别硬编码 6 条。

**D5 图表 init 后再 `setOption({series: getOption().series})` 会吃掉坐标轴**
- 症状：散点/气泡图「横轴不见了」，纵轴或图例可能也在，极具迷惑性——同一 builder 里没这句的另一张图正常。
- 原因：拿 getOption() 处理后的 series 再 setOption 一次，等于局部覆盖重置了 axis 内部状态。
- 做法：mk/draw **一次成型**，绝不在初始化后回读再重设；双击还原用 `dispatchAction({type:'dataZoom',...})`，不要动 setOption。

**D6 气泡/散点图例色块与气泡不同色**
- 症状：legend 方块是默认调色盘色、气泡是自定义 alpha 色，对不上。
- 原因：legend 取 **series 级 `color`/`itemStyle.color`**；只在每个 data 项写 itemStyle、series 没顶层色时，图例回退默认。
- 做法：series 顶层设 `color:系列色`（不透明，供图例），data 项内再设 `itemStyle.color:系列色+透明度`（供气泡），两者同色。

**D7 单点极端值把气泡图压成一坨**
- 症状：四象限气泡「全挤在角落/一条线上」。
- 原因：某点小基数导致同比 +2000% 之类离群撑爆该轴；或半径按线性/单一除系数映射，量级差大时小点全叠一起。
- 做法：① 对超出稳健分位的轴值做**截断并在 tooltip 标「实际 X%，已截断」**（配 dataZoom 看全量），别让它决定轴域；② 半径用 **sqrt 按本图 min/max 归一到 10–52**；③ 同比类点先过「两窗口都有值 + 前窗口基数下限」，滤掉小基数伪高增长。

## E. 表格层

**E1 一个 ReferenceError 会静默杀掉后续所有渲染**
- 症状：某一张表空白，且它之后的所有表格/结论卡全部空白（图表因在表格之前定义所以还渲染，极具迷惑性）。
- 原因：用了未定义的格式化函数（如 `fnum`）。
- 做法：构建后断言脚本中引用的所有 `D.xxx` 键都存在；格式化函数集中定义在脚本顶部。

**E2 表头排序必须做数值解析**
- 直接按 textContent 排会把 `$9.80` 排在 `$19.32` 之后、`+113.9%` 按字符序乱排。
- 做法：`parseVal()` 剥掉 `$ % + − ,` 与 `K/M/万` 后缀换算成数值，`—`/空返回 `-Infinity` 沉底，非数值回落 `localeCompare(...,'zh')`。

**E3 明细表列名/口径**
- 多标签维度（节日/品种/颜色）份额加总会超 100%，必须在 00 METHODOLOGY 与 src 行都写明"重复累积"口径。
- 中文翻译**并入英文名列**（`Wedding(婚礼)`），不单独开中文列。

## F. 验证方式（用户强约束）

**F1 不要擅自截图验证**
- 默认只做静态自查；需要截图时必须先征得用户同意，仅在静态手段无法定位问题时才申请。

**F2 静态自查清单（构建脚本内置，任一失败即中止）**
```python
ids  = re.findall(r'<div id="(ch\d+)"', html)
cfgs = re.findall(r"mk\('(ch\d+)'", html)
assert set(ids) == set(cfgs)                      # 图表容器与配置一一对应
assert len(re.findall(r'<div\b', html)) == html.count('</div>')   # div 开闭配对
assert html.count('<script') == html.count('</script>')           # script 闭合
tbls = set(re.findall(r'<table class="dt" id="(tbl\w+)"', html))
tfil = set(re.findall(r"fillTable\('(tbl\w+)'", html))
assert tbls == tfil                               # 表格容器与填充调用匹配
refs = set(re.findall(r'D\.([a-zA-Z_]+)\b', script))
assert not [r for r in refs if r not in D]        # 数据键全部存在
# 注意：取 D 键的正则须加前置边界 `(?<![A-Za-z0-9_])D\.`，否则会把 BUILD.push / xxxD.forEach
# 这类「以 D 结尾的变量.方法」误判成 D.push / D.forEach → 自检假报错。
# 卡片间距审计（见 C2：追加/重排卡片后末卡身份会变，非末卡必须带 mb-6）
for si,s in enumerate(re.split(r'(?=<section)', body)):
    if '<section' not in s: continue
    cs=re.findall(r'<div class="card p-6 reveal( mb-6)?">', s)
    for i,mb in enumerate(cs):
        assert not (i<len(cs)-1 and not mb), f"卡片缺 mb-6 会与下张粘连: 第{si}节第{i}张"
# 再跑: node --check /tmp/extracted_main_script.js
```
另需人工核对：insight 里每个数字都能在聚合结果中找到出处（**不要凭记忆写数字**，先 print 再写文案）。

**F3 后台子任务进度判断**
- 子 agent 的 transcript 文件恒为 178 字节占位，**不能**作为进度信号；只看结果文件是否生成。批量任务某批超 30 分钟无结果文件即视为卡死，重启或改为对话内直接执行。
