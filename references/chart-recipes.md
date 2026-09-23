# 图表配方库（从实战报告提炼，可直接改造）· 浅色版 v2.1

统一使用 template.html 中的 `mk(id, opt)` 创建（mk 返回图表实例，可绑定事件）。以下各类图表的 ECharts option 模板，`D.xxx` 为数据占位。

统一颜色常量（模板已内置）：
```js
const C = {coral:'#f97316',cyan:'#0e9db8',lime:'#4c9d00',gold:'#f59e0b',violet:'#7c6cf0',rose:'#e11d48',sub:'#5c7a94',line:'#dde7f0'};
const SPL = 'rgba(24,42,63,.08)';  // 浅色网格线
```

## 1. Treemap 构成图
适用：分类体量占比全景。
```js
mk('ch1',{series:[{type:'treemap',roam:false,nodeClick:false,breadcrumb:{show:false},
  label:{show:true,formatter:p=>p.name+'\n'+fmtM(p.value),fontSize:12,fontFamily:FONT},
  upperLabel:{show:false},
  itemStyle:{borderColor:'#dbe7f2',borderWidth:2,gapWidth:2,borderRadius:6},
  data:D.groups.map(([k,v],i)=>({name:k,value:v.sv,
    itemStyle:{color:new echarts.graphic.LinearGradient(0,0,1,1,
      [{offset:0,color:PAL[i%6]+'cc'},{offset:1,color:PAL[i%6]+'55'}])}}))]});
```

## 2. 双轴柱线图（量 + 率）
适用：分类词数 vs 单词平均价值、月度销量 + 销售额等。
```js
mk('ch2',{grid:{left:10,right:60,top:40,bottom:80,containLabel:true},
  legend:{top:0,textStyle:{color:C.sub,fontFamily:FONT}},
  xAxis:{type:'category',data:D.names,axisLabel:{rotate:38,fontSize:11,color:C.sub},axisLine:{lineStyle:{color:C.line}}},
  yAxis:[{type:'value',name:'{{N1}}',nameTextStyle:{color:C.sub},axisLabel:{color:C.sub},splitLine:{lineStyle:{color:SPL}}},
         {type:'value',name:'{{N2}}',nameTextStyle:{color:C.sub},axisLabel:{color:C.sub,formatter:fmtK},splitLine:{show:false}}],
  series:[
    {name:'{{N1}}',type:'bar',data:D.a,itemStyle:{color:C.cyan,borderRadius:[4,4,0,0]},barWidth:'45%'},
    {name:'{{N2}}',type:'line',yAxisIndex:1,data:D.b,itemStyle:{color:C.coral},lineStyle:{color:C.coral,width:2},symbolSize:7}]});
```

## 2b. 多系列折线图交互基线（必配）
适用：2 条及以上折线对比（分类趋势、多词对比、节日月度分布等）。效果：主线加粗+微面积置顶，悬停线条/图例聚焦该系列、其余淡出至 8% 透明度；tooltip 用 axis 触发（悬停任意 x 位置即展示该列全部数值）。
```js
(function(){
  const style = [
    {color:C.coral, width:3,   z:10, area:'rgba(249,115,22,.06)'},   // 主线(最重要的系列)
    {color:C.cyan,  width:1.8, z:5},
    {color:C.lime,  width:1.8, z:4},
    {color:C.violet,width:1.8, z:3}
  ];
  const series = D.names.map((n,i)=>({name:n,type:'line',data:D.data[n],
    itemStyle:{color:style[i].color},lineStyle:{color:style[i].color,width:style[i].width},
    symbol:'circle',symbolSize:style[i].z===10?6:3,
    emphasis:{focus:'series',lineStyle:{width:style[i].width+1.5}},   // 悬停聚焦:本线加粗
    blur:{lineStyle:{opacity:.08},symbolSize:2},                       // 其余淡出到8%
    z:style[i].z||2}));
  series[0].areaStyle={color:style[0].area};                           // 主线微面积
  mk('chX',{grid:{left:10,right:20,top:40,bottom:70,containLabel:true},
    legend:{top:0,textStyle:{color:C.sub,fontFamily:FONT,fontSize:11},itemWidth:18},
    tooltip:{trigger:'axis',axisPointer:{type:'line',lineStyle:{color:C.gold,type:'dashed'}}},
    xAxis:{type:'category',data:D.months,axisLabel:{rotate:45,fontSize:10,color:C.sub},axisLine:{lineStyle:{color:C.line}}},
    yAxis:{type:'value',axisLabel:{color:C.sub,formatter:fmtK},splitLine:{lineStyle:{color:SPL}}},
    series:series});
})();
```
注意（三条都是踩过的坑）：
① **不要覆盖 tooltip.trigger**——用 mk() 默认的 item 触发。一旦改成 `trigger:'axis'`，axis 会接管整个图表区的悬停（弹全系列面板），**绕过单条线的 emphasis 聚焦**，用户感知为"没效果"。
② **blur 必须显式写 opacity**（默认淡出太弱）。
③ **主线 areaStyle 有前提条件**：只有当主线位于图区**底部/面积很薄**时才加；若主线是**最上方**的线，它的面积块会覆盖整个绘图区，鼠标落在任何细线上实际命中的都是这块面积——表现为"悬停哪里都聚焦同一条线"。不确定就不加，靠 `width:3 + symbolSize:6 + z:10` 区分主线。
④ **配色数组长度必须 ≥ 系列数**：TOP6 扩到 TOP10 时硬编码 6 条会导致 `lineStyle[6]` undefined、颜色全崩。用生成式写法：
```js
const pal10 = [C.cyan,C.rose,C.violet,C.coral,C.lime,C.gold,'#0891b2','#7c3aed','#334155','#15803d'];
const lineStyle = pal10.map((col,i)=>({color:col, width:i===0?3:1.8, z:10-i}));  // 或 i % pal.length 取色
```
⑤ 双轴柱线组合图（销量柱+销售额线）**不要**加 focus:'series'——聚焦会连带把柱体淡出，观感差。
⑥ 对数轴折线（见配方 5b）**禁止**加 areaStyle，log 轴下面积填充渲染异常。

## 3. 横向正负条形榜（同比涨跌）
适用：单指标同比排名，正负分色。类目 ≤15 时用横向；>15 个改纵向（见 3b）。
```js
mk('ch3',{grid:{left:10,right:40,top:20,bottom:80,containLabel:true},
  xAxis:{type:'value',axisLabel:{formatter:'{value}%',color:C.sub},splitLine:{lineStyle:{color:SPL}}},
  yAxis:{type:'category',data:D.names.reverse(),axisLabel:{color:'#5c7a94',fontSize:11},axisLine:{lineStyle:{color:C.line}}},
  series:[{type:'bar',data:D.vals.map(v=>({value:v,itemStyle:{color:v>=0?C.lime:C.rose,borderRadius:v>=0?[0,4,4,0]:[4,0,0,4]}})).reverse(),
    label:{show:true,position:'right',formatter:p=>pc(p.value),fontFamily:'JetBrains Mono',fontSize:10,color:'#5c7a94'},
    markLine:{symbol:'none',data:[{xAxis:0}],lineStyle:{color:C.gold,type:'dashed'}}}]});
```
### 3b. 纵向版本（类目 >15）
```js
mk('ch3b',{grid:{left:10,right:50,top:20,bottom:110,containLabel:true},
  xAxis:{type:'category',data:D.names,axisLabel:{rotate:52,fontSize:10,color:C.sub},axisLine:{lineStyle:{color:C.line}}},
  yAxis:{type:'value',axisLabel:{formatter:'{value}%',color:C.sub},splitLine:{lineStyle:{color:SPL}}},
  series:[{type:'bar',data:D.vals.map(v=>({value:v,itemStyle:{color:v>=0?C.lime:C.rose,borderRadius:3}})),
    label:{show:true,position:'top',formatter:p=>p.value>0?'+'+p.value.toFixed(0)+'%':p.value.toFixed(0)+'%',fontSize:9,color:C.sub,fontFamily:'JetBrains Mono'},
    markLine:{symbol:'none',data:[{yAxis:0}],lineStyle:{color:C.gold,type:'dashed'}}}]});
```

## 4. 同比双柱对比（两期对比）
适用：202607 vs 202507、A 年 vs B 年。上期半透明灰，本期主题色。
```js
mk('ch4',{grid:{left:10,right:20,top:40,bottom:100,containLabel:true},
  legend:{top:0,textStyle:{color:C.sub,fontFamily:FONT}},
  xAxis:{type:'category',data:D.names,axisLabel:{rotate:45,fontSize:10,color:C.sub},axisLine:{lineStyle:{color:C.line}}},
  yAxis:{type:'value',axisLabel:{formatter:'{value}%',color:C.sub},splitLine:{lineStyle:{color:SPL}}},
  series:[
    {name:'{{上期}}',type:'bar',data:D.prev,itemStyle:{color:'rgba(154,167,196,.5)',borderRadius:[3,3,0,0]},barWidth:'35%'},
    {name:'{{本期}}',type:'bar',data:D.curr,itemStyle:{color:C.cyan,borderRadius:[3,3,0,0]},barWidth:'35%'}]});
```

## 5b. 对数轴折线（跨量级序列对比）
适用：两条线量级差 >10 倍（如类目大盘 24~70 万件 vs 细分 0.3~4.6 万件）。**单轴对数刻度**，斜率可直接比增速；用户已否定双轴（判为不直观）。
```js
(function(){
  mk('chX',{grid:{left:10,right:20,top:40,bottom:70,containLabel:true},
    legend:{top:0,textStyle:{color:C.sub,fontFamily:FONT}},
    xAxis:{type:'category',data:D.months,axisLabel:{rotate:45,fontSize:9,color:C.sub},axisLine:{lineStyle:{color:C.line}}},
    yAxis:{type:'log',min:1000,max:1000000,axisLabel:{color:C.sub,formatter:fmtK},splitLine:{lineStyle:{color:SPL}}},
    series:[
      {name:'大盘',type:'line',data:D.big,itemStyle:{color:C.coral},lineStyle:{color:C.coral,width:2},symbol:'circle',symbolSize:5,
       emphasis:{focus:'series',lineStyle:{width:4}},blur:{lineStyle:{opacity:.08},symbolSize:2}},
      {name:'细分',type:'line',data:D.small,itemStyle:{color:C.cyan},lineStyle:{color:C.cyan,width:2.5},symbol:'circle',symbolSize:5,
       emphasis:{focus:'series',lineStyle:{width:4.5}},blur:{lineStyle:{opacity:.08},symbolSize:2}}]});   // 两条线都不加areaStyle
})();
```
标题须点明「（对数轴）」，src 行说明"两序列量级差约 N 倍，对数轴可同轴比较增速斜率"。

## 5. 四象限散点（双增速矩阵，气泡=体量，带缩放）
适用：需求增速 vs 供给增速、需求增速 vs 均价增速等两维竞争定位。
```js
(function(){
  const c7 = mk('ch7',{
    tooltip:{trigger:'item',formatter:p=>{const d=p.data;const sv26=d._sv;
      return '<div style="font-weight:700;margin-bottom:4px">'+d.name+'</div>X：<b>'+d.value[0].toFixed(1)+'%</b><br/>Y：<b>'+d.value[1].toFixed(1)+'%</b><br/>体量：<b>'+fmtM(sv26)+'</b>';},
      backgroundColor:'rgba(24,42,63,.92)',borderColor:C.cyan,textStyle:{color:'#fff',fontFamily:FONT,fontSize:12}},
    grid:{left:10,right:30,top:30,bottom:90,containLabel:true},
    xAxis:{type:'value',name:'{{X}} %',nameTextStyle:{color:C.sub},axisLabel:{formatter:'{value}%',color:C.sub},splitLine:{lineStyle:{color:SPL}},scale:true},
    yAxis:{type:'value',name:'{{Y}} %',nameTextStyle:{color:C.sub},axisLabel:{formatter:'{value}%',color:C.sub},splitLine:{lineStyle:{color:SPL}},scale:true},
    series:[{type:'scatter',
      data:D.points.map(v=>({value:[v.x,v.y],name:v.name,_sv:v.size,
        symbolSize:Math.max(10,Math.min(52,Math.sqrt(v.size/2e4))),
        itemStyle:{color:v.x>v.y?C.cyan+'d0':C.rose+'b0',borderColor:'#fff2',borderWidth:1}})),
      label:{show:true,formatter:p=>p.name,position:'top',fontSize:9,color:'#5c7a94'},
      labelLayout:{hideOverlap:true},
      markLine:{symbol:'none',data:[{xAxis:0},{yAxis:0}],lineStyle:{color:C.gold,type:'dashed',opacity:.6}}}],
    dataZoom:[
      {type:'inside',xAxisIndex:0,filterMode:'none',zoomOnMouseWheel:true,moveOnMouseWheel:false,moveOnMouseMove:true},
      {type:'inside',yAxisIndex:0,filterMode:'none',zoomOnMouseWheel:true,moveOnMouseWheel:false,moveOnMouseMove:true}
    ]});
  if(c7){ c7.on('dblclick', function(){ c7.dispatchAction({type:'dataZoom',start:0,end:100}); c7.dispatchAction({type:'dataZoom',start:0,end:100,dataZoomIndex:1}); }); }
})();
```
图卡内在 chart 下加提示行：`<div style="font-size:11px;color:var(--sub);font-family:'JetBrains Mono',monospace;margin-top:4px;">🖱 滚轮缩放 · 拖拽平移 · 双击还原视图</div>`

## 5c. 两级 Treemap（父级=分组、子级=明细）
适用：层级构成（如"三大分类 → 各分类下颜色/品种"）。父级用主题色实底+upperLabel，子级同色系饱和度渐变。
```js
(function(){
  const catColor = [C.coral, C.cyan, C.lime];   // 父级配色
  const data = D.tree.map((t,i)=>({
    name:t.name, itemStyle:{color:catColor[i]},
    children:t.children.map(ch=>({name:ch.name, value:ch.value,
      itemStyle:{color:catColor[i], borderColor:'#ffffff'}}))
  }));
  mk('chX',{
    tooltip:{formatter:p=>{
      const parent = p.treePathInfo && p.treePathInfo.length>1 ? p.treePathInfo[p.treePathInfo.length-2].name : '';
      const tot = parent ? (D.tree.find(x=>x.name===parent)||{value:p.value}).value : p.value;
      return '<b>'+p.name+'</b>'+(parent?'<br>'+parent:'')+'<br>销量: '+fnum(p.value)+'<br>父级内占比: '+(p.value/tot*100).toFixed(1)+'%';}},
    series:[{type:'treemap',roam:false,nodeClick:false,breadcrumb:{show:false},
      left:'1%',right:'1%',top:'1%',bottom:'1%',
      label:{show:true,formatter:p=>p.name+'\n'+fmtK(p.value),fontSize:12,fontFamily:FONT,color:'#fff'},
      upperLabel:{show:true,height:34,color:'#fff',fontFamily:FONT,fontSize:13,fontWeight:'bold'},
      itemStyle:{borderColor:'#ffffff',borderWidth:2,gapWidth:2},
      levels:[{itemStyle:{borderWidth:0,gapWidth:3},upperLabel:{show:true}},
              {colorSaturation:[0.35,0.62],itemStyle:{borderColor:'#fff',borderWidth:1,gapWidth:1}}],
      data:data}]});
})();
```
每个父级取 TOP8 子项，其余合并为「其他」，避免碎块不可读；src 行写明该截断规则。

## 6. 横向排名条形（带阈值基准线）
适用：需供比、机会分等排名。分段配色示例：≥5 lime / ≥2 gold / 其余 coral。
```js
mk('ch6',{grid:{left:10,right:55,top:20,bottom:110,containLabel:true},
  xAxis:{type:'value',axisLabel:{color:C.sub},splitLine:{lineStyle:{color:SPL}}},
  yAxis:{type:'category',data:D.names.reverse(),axisLabel:{color:'#5c7a94',fontSize:10},axisLine:{lineStyle:{color:C.line}}},
  series:[{type:'bar',data:D.vals.reverse().map(v=>({value:v,itemStyle:{color:v>=5?C.lime:v>=2?C.gold:C.coral,borderRadius:[0,4,4,0]}})),
    label:{show:true,position:'right',formatter:p=>p.value.toFixed(1),fontFamily:'JetBrains Mono',fontSize:9,color:C.sub},
    markLine:{symbol:'none',data:[{xAxis:{{THRESH}}}],lineStyle:{color:C.cyan,type:'dashed'},label:{formatter:'{{LABEL}}',color:C.cyan}}}]});
```

## 7. 分档双轴（词数柱 + 合计量线）
适用：分布形态（分档统计）。
```js
mk('ch7',{grid:{left:10,right:55,top:40,bottom:50,containLabel:true},
  legend:{top:0,textStyle:{color:C.sub,fontFamily:FONT}},
  xAxis:{type:'category',data:D.bins,axisLabel:{color:'#5c7a94'},axisLine:{lineStyle:{color:C.line}}},
  yAxis:[{type:'value',name:'数量',nameTextStyle:{color:C.sub},axisLabel:{color:C.sub},splitLine:{lineStyle:{color:SPL}}},
         {type:'value',name:'合计',nameTextStyle:{color:C.sub},axisLabel:{color:C.sub,formatter:fmtM},splitLine:{show:false}}],
  series:[
    {name:'数量',type:'bar',data:D.cnt,itemStyle:{color:C.coral,borderRadius:[4,4,0,0]},barWidth:'40%'},
    {name:'合计',type:'line',yAxisIndex:1,data:D.sum,itemStyle:{color:C.cyan},lineStyle:{color:C.cyan,width:2},symbolSize:8,
     label:{show:true,position:'top',formatter:p=>fmtM(p.value),fontFamily:'JetBrains Mono',fontSize:10,color:C.cyan}}]});
```

## 8. 百分比柱（占比分布）
适用：单维度占比。渐变填充。
```js
mk('ch8',{grid:{left:10,right:20,top:40,bottom:50,containLabel:true},
  xAxis:{type:'category',data:D.bins,axisLabel:{color:'#5c7a94'},axisLine:{lineStyle:{color:C.line}}},
  yAxis:{type:'value',axisLabel:{formatter:'{value}%',color:C.sub},splitLine:{lineStyle:{color:SPL}}},
  series:[{type:'bar',data:D.pct,
    itemStyle:{color:new echarts.graphic.LinearGradient(0,0,0,1,[{offset:0,color:C.violet},{offset:1,color:C.violet+'33'}]),borderRadius:[6,6,0,0]},barWidth:'50%',
    label:{show:true,position:'top',formatter:'{c}%',fontFamily:'JetBrains Mono',fontSize:11,color:C.violet}}]});
```

## 9. 渐变横向条形（排名 + 单位标签）
适用：TOP N 排名（销售额、份额等），条形渐变+右侧 mono 标签。
```js
mk('ch9',{grid:{left:10,right:70,top:30,bottom:40,containLabel:true},
  xAxis:{type:'value',axisLabel:{color:C.sub,formatter:fmtK},splitLine:{lineStyle:{color:SPL}}},
  yAxis:{type:'category',data:D.names.reverse(),axisLabel:{color:'#5c7a94',fontSize:11,fontFamily:'JetBrains Mono'},axisLine:{lineStyle:{color:C.line}}},
  series:[{type:'bar',data:D.vals.reverse(),
    itemStyle:{color:new echarts.graphic.LinearGradient(1,0,0,0,[{offset:0,color:C.coral},{offset:1,color:C.coral+'44'}]),borderRadius:[0,5,5,0]},
    label:{show:true,position:'right',formatter:p=>fmtK(p.value),fontFamily:'JetBrains Mono',fontSize:10,color:'#5c7a94'}}]});
```

## 10. 数据表填充 + 涨跌着色
```js
function fillTable(id, cols, rows){
  const t = document.getElementById(id); if(!t) return;
  t.innerHTML = '<thead><tr>'+cols.map(c=>`<th>${c}</th>`).join('')+'</tr></thead><tbody>'+
    rows.map(r=>'<tr>'+r.map(c=>`<td>${c}</td>`).join('')+'</tr>').join('')+'</tbody>';
}
const fnum = v => v===null||v===undefined?'—':(typeof v==='number'?v.toLocaleString('en-US'):v);
const fpc = v => v==null?'—':'<span class="'+(v>=0?'pos':'neg')+'">'+(v>0?'+':'')+v.toFixed(1)+'%</span>';
// 代码列样式：'<span class="mono text-xs">'+asin+'</span>'
// 长文本截断：str.length>52 ? str.slice(0,52)+'…' : str
// 表格前标题行下加 mt-3：'<div class="overflow-x-auto mt-3"><table class="dt" id="tblN"></table></div>'
```

## 10b. 可排序明细表（默认能力）
所有"核心指标明细"表都应支持点击表头排序；标题加 `<span class="src">(点击任意表头排序)</span>` 提示。
关键：**必须做数值解析**，否则 `$9.80` 会排在 `$19.32` 之后、`+113.9%` 按字符乱排。
```js
function fillTable(id, cols, rows, sortable){
  const t = document.getElementById(id); if(!t) return;
  t.innerHTML = '<thead><tr>'+cols.map((c,i)=>`<th data-ci="${i}"${sortable?' class="sortable"':''}>${c}</th>`).join('')+'</tr></thead><tbody>'+
    rows.map(r=>'<tr>'+r.map(c=>`<td>${c}</td>`).join('')+'</tr>').join('')+'</tbody>';
  if(sortable) makeSortable(t);
}
function parseVal(txt){                       // 识别 $ % 千分位 K M 万 正负号
  let s=(txt||'').trim();
  if(s===''||s==='—'||s==='-') return -Infinity;   // 空值统一沉底
  let neg=/^[-−]/.test(s);
  s=s.replace(/[+−-]/g,'').replace(/[$%]/g,'').replace(/,/g,'').replace(/<[^>]+>/g,'');
  let mult=1;
  if(/M$/i.test(s)){mult=1e6;s=s.replace(/M$/i,'');}
  else if(/K$/i.test(s)){mult=1e3;s=s.replace(/K$/i,'');}
  else if(/万/.test(s)){mult=1e4;s=s.replace(/万/g,'');}
  const n=parseFloat(s); if(isNaN(n)) return null;
  return (neg?-1:1)*n*mult;
}
function makeSortable(t){
  const ths=t.querySelectorAll('th');
  ths.forEach(th=>th.addEventListener('click',()=>{
    const ci=+th.dataset.ci, tb=t.querySelector('tbody');
    const dir = th.dataset.dir==='asc' ? 'desc' : 'asc';
    ths.forEach(h=>{h.dataset.dir='';h.classList.remove('sort-asc','sort-desc');});
    th.dataset.dir=dir; th.classList.add(dir==='asc'?'sort-asc':'sort-desc');
    Array.from(tb.querySelectorAll('tr')).sort((a,b)=>{
      const A=a.children[ci], B=b.children[ci];
      const av=parseVal(A?A.textContent:''), bv=parseVal(B?B.textContent:'');
      if(av===null&&bv===null) return dir==='asc'?A.textContent.localeCompare(B.textContent,'zh'):B.textContent.localeCompare(A.textContent,'zh');
      if(av===null) return 1; if(bv===null) return -1;
      return dir==='asc'?av-bv:bv-av;
    }).forEach(r=>tb.appendChild(r));
  }));
}
```
配套 CSS（模板已内置）：`th.sortable` 手型光标 + 右侧 ⇅ 占位符，排序后变 ▲/▼ 并高亮为 coral。
**明细表中文翻译并入英文名列**（`Wedding(婚礼)`），不单独开中文列。

## 11. 点击下钻联动面板（chip 组）
适用：分布图/条形图点击某档后，展示该档下的细分小类目。数据结构：`D.kwdrill = {bins: {'<1千':[{cat:'泳池化学品', sv:123}, ...], ...}}`。
```html
<!-- 图卡内、chart div 之后预置（默认隐藏） -->
<div class="card" style="padding:14px 16px;margin-top:10px;display:none;" id="drill10">
  <div style="font-size:12px;color:var(--sub);font-family:'JetBrains Mono',monospace;margin-bottom:8px;">
    ▸ 点击查看 · 主要细分小类目 — <span id="drill10h" style="color:var(--coral);font-weight:700;"></span></div>
  <div id="drill10c" style="display:flex;flex-wrap:wrap;gap:6px;"></div>
</div>
```
```js
function fmtK_cn(v){ return v>=1e6?(v/1e6).toFixed(1)+'M':v>=1e4?(v/1e4).toFixed(1)+'万':String(v); }
function renderDrill(pid, items, title, mode){  // mode: 'vol'量 | 'goods'数 | 'both'
  const box=document.getElementById(pid); if(!box) return;
  box.style.display='block';
  document.getElementById(pid+'h').textContent=title;
  document.getElementById(pid+'c').innerHTML=items.map(it=>{
    let extra='';
    if(mode==='vol'){ extra=' <b style="color:var(--cyan);font-family:\'JetBrains Mono\',monospace;">'+fmtK_cn(it.sv)+'</b>'; }
    else if(mode==='goods'){ extra=' <b style="color:var(--cyan);font-family:\'JetBrains Mono\',monospace;">'+it.n+'词</b>'; }
    else { extra=' <b style="color:var(--cyan);font-family:\'JetBrains Mono\',monospace;">'+fmtK_cn(it.sv)+'</b><span style="color:var(--sub);"> · '+it.goods+'件</span>'; }
    return '<span style="display:inline-block;background:#f0f6fa;border:1px solid var(--line);border-radius:8px;padding:3px 11px;font-size:11.5px;color:var(--txt);white-space:nowrap;">'+it.cat+extra+'</span>';
  }).join('');
}
(function(){
  const c = mk('ch10', {/* 分档图配置 */});
  if(c){ c.on('click',p=>{ const g=D.kwdrill.bins[p.name]; if(g) renderDrill('drill10',g,p.name+' 档 · 主要细分小类目','vol'); }); }
  // 首屏默认渲染第一组
  renderDrill('drill10', D.kwdrill.bins['<1千'], '<1千 档 · 主要细分小类目', 'vol');
})();
```

## 12. 结论卡组（HTML 模板）
```js
document.getElementById('cards').innerHTML = [
  {t:'① 方向名',c:C.cyan,b:'论据文字（含具体数字）',s:'证据：2.1 / 3.2 图表'}
].map(x=>`<div class="card p-5 reveal" style="border-top:2px solid ${x.c}">
  <div class="font-bold mb-2" style="color:${x.c}">${x.t}</div>
  <div class="text-sm leading-7 text-[color:var(--sub)]">${x.b}</div>
  <div class="src mt-3">${x.s}</div></div>`).join('');
```
容器：`<div class="grid md:grid-cols-2 gap-5 mt-4" id="cards"></div>`
（结论/建议类内容一律放在**分析章节之后、APPENDIX 之前**，不要塞进中段章节里。）

## 13. 气泡/散点工程化（图例同色 + 半径归一 + 离群截断）
四象限气泡避坑（详见 pitfalls D5–D7）：series 顶层设不透明 `color`（图例取它）、data 项设 `color+透明度`（气泡用），两者同色；半径按本图 min/max 做 **sqrt 归一到 10–52**（不是固定除系数）；轴被单点极端同比撑爆时对该轴**截断**并在 tooltip 标「实际 X%，已截断」+ dataZoom 看全量；同比点先过「两窗口都有值 + 前窗基数下限」；**绝不在 init 后 `setOption({series:getOption().series})`**（会吃掉坐标轴）。

## 14. 可选：整站暗黑模式开关（右上）
图表颜色是硬编码的，只翻 CSS 变量翻不动。用「调色板 + 重绘」：
- HTML：`body.dark{ --bg/--card/--txt/--sub/--line… }`，右上放 `<button id="themeBtn">`。
- JS：每张图写成**构建函数**注册进 `BUILD`，统一 `draw(id,opt)` 从全局 `THEME`（paletteLight/Dark）取 txt/split/axis/tip/treemapBd/label；`renderAll()` 遍历 `draw(id, builder(THEME))`；切换时翻 `body.dark`→换 `THEME`→`renderAll()`，`draw` 内 `setOption(opt,true)` notMerge 才能改色。
- 默认按 `matchMedia('(prefers-color-scheme:dark)')`；resize 遍历 `INST` 调 `.resize()`。
- 冒烟桩须给 `document.body`(含 classList.toggle) 与 `window.matchMedia`。
