# V4.0 架构说明

## 1. 设计原则

1. **内容与展示分离**：所有产品知识、参数、对比、行业、营销话术、题库、拓扑都在 `data/*.json`；页面代码只负责渲染。
2. **拓扑引擎化**：动态演示由统一的“场景描述”驱动（区域、节点、链路、流量、标注、仪表、步骤），新增演示只写 JSON。
3. **出处可核验**：每条参数、能力、案例都带 `src`（资料编号:页码），页面渲染为可点击的出处标签，指向“资料口径”页。
4. **讲师优先**：分步可控、键盘与翻页笔可用、讲师模式与全屏投影、提示可隐藏。
5. **零依赖、纯静态**：不引入框架与 CDN，GitHub Pages 直接托管；国内网络环境下也不依赖外部资源。

## 2. 运行流程

```text
index.html
  └─ js/app.js
       ├─ store.loadData()      并行加载 12 个 JSON，建立索引（产品、分类、演示、行业、资料来源）
       ├─ 注入 svg/icons.svg     设备图标 <symbol>，供拓扑 <use> 复用
       ├─ router（hash）         #/products、#/product/:id、#/demo/:id?scene=&step= …
       └─ views/*.render()      返回 { destroy, player, keys, keysAlt, title }
            └─ interaction.js   根据当前视图分发快捷键（演示步骤 / 同级页面切换）
```

使用 hash 路由，GitHub Pages 刷新任意页面都不会 404；V3 旧深链 `?page=`、`?mission=` 在 `index.html` 头部被重定向到 `v3/`。

## 3. 拓扑引擎（js/topology/engine.js）

### 3.1 场景描述

画布坐标系 1280×720（显示裁切为 `0 64 1280 636`）。

| 元素 | 主要字段 | 说明 |
| --- | --- | --- |
| zones | `x y w h label tone` | 网络域（客户侧、城域网、骨干网、云……），虚线底框 + 标签 |
| nodes | `x y icon label sub tone size lp badge info shape round` | 设备节点；`info` 存在时可点击查看说明；`kind: "meter"` 为仪表（利用率、带宽） |
| links | `a b kind label route via bend lab cut` | 链路；`route` 支持直线、`hv`/`vh`/`hvh`/`vhv` 折线、`curve` 曲线、`via` 自定义拐点 |
| flows | `path kind n speed label` | 流量：沿节点路径移动的光点；路径相邻节点自动匹配链路几何 |
| callouts | `at x y w text tone lead` | 讲解标注，带引线 |
| kpis | `label value src note` | 关键指标卡（侧栏显示） |
| steps | `t say add remove states flows meters callouts kpis focus src teacher dur` | 分步讲解 |

### 3.2 图层与防压字

图层顺序：区域 → 链路 → 流量轨迹 → 流量光点 → 链路标签 → 节点 → 标注。节点卡片和文字底板绘制在连线之上，连线永远不会压住设备名称；`tests/layout_lint.js` 逐步骤检测文字与元素碰撞（当前 0 处）。

### 3.3 语义配色（css/topology.css）

| 颜色 | 含义 |
| --- | --- |
| 蓝 `--flow` | 业务数据流、互联网专线 |
| 青 `--tunnel` | 上云、VPN / VxLAN / IPSec 隧道 |
| 橙 `--security` | 安全监测、清洗、防护 |
| 绿 `--ok` | 正常、保护路由、清洗后流量 |
| 红 `--fault` | 断纤、告警、攻击流量（只用于故障语义） |
| 灰 `--link` | 普通物理连接 |
| 深蓝双线 `--hardpipe` | OTN 物理隔离硬管道 |
| 紫 `--control` | SDN 管控、平台编排 |

品牌联通红 `--brand` 只用于界面强调（导航、主按钮、当前步骤），不在拓扑中使用，避免与故障红混淆。

## 4. 播放器（js/topology/player.js + components/demo-player.js）

- 每一步的画面状态都从第 1 步“累积重放”计算：上一步、下一步、跳步、刷新深链结果一致。
- `add/remove`、`states`（持续到被覆盖）、`flows`/`kpis`（未声明则沿用）、`meters`（合并）、`callouts`/`focus`（只作用于当前步）。
- 三种播放状态：就绪（光点流动、不自动翻步）→ 播放（自动翻步）→ 暂停（停止翻步并冻结动画）；手动翻步自动解除冻结。
- 速度 0.5× / 1× / 1.5× / 2× 同时作用于光点速度与自动翻步间隔。
- 节点点击显示说明（含出处），流量图例点击高亮完整路径，`Esc` 依次关闭。
- `prefers-reduced-motion` 下不播放光点，改为带方向箭头的静态流量线。

## 5. 视觉与适配

- 浅色商务画布、白色卡片、系统中文字体（PingFang / 微软雅黑 / 思源黑体），字号随视口平滑缩放。
- 1920 / 1600：拓扑 + 右侧讲解栏；1366×768：压缩标题区，保证拓扑与控制条同屏；≤1180：导航折叠、讲解栏移至下方；≤900（平板）与手机：拓扑区固定最小宽度可横向滑动，文字不缩到 11px 以下，可一键“适配屏宽”。
- 讲师模式：隐藏导航与次要面板，拓扑放大，讲解改为底部大字条，讲师提示浮层（T）。

## 6. 质量保障

| 脚本 | 覆盖 |
| --- | --- |
| `tests/validate_data.mjs` | JSON 解析、ID 引用、流量路径链路、资料编号、题库答案、敏感信息 |
| `tests/layout_lint.js` | 16 套演示 105 个步骤画面的文字 / 元素碰撞与越界 |
| `tests/private_network_demo_v4_test.js` | 导航、产品详情、全部演示场景、播放控制、快捷键、讲师模式、全屏、减少动画、行业、对比、营销、测验、资料页、安全扫描、5 种分辨率截图、控制台错误与资源加载 |

## 7. 浏览器支持

Chrome / Edge（Chromium）为主要目标；Safari 15.4+；依赖的特性：ES Module、CSS `aspect-ratio`、`:is()`、SVG `transform-box`。
