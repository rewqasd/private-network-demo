# 数据维护指南：新增产品、修改参数、增加场景与动画

所有内容都在 `data/` 下，改完运行一次校验：

```bash
node tests/validate_data.mjs      # 引用、出处、敏感信息
node tests/layout_lint.js         # 改了拓扑时：逐步骤检查文字是否被遮挡
```

出处字段统一写成 `"资料编号:页码"`，多个用分号分隔，如 `"S13:4.1; S14:P26"`。资料编号必须先登记在 `data/sources.json`（只写文件名、发布单位、日期、范围、受众，**不写在线文档链接、文件 ID 或凭据**）。

## 1. 新增产品

在 `data/products.json` 的 `products` 数组中追加一项（字段缺资料就留空数组，不要推测）：

```json
{
  "id": "new-product",
  "name": "资料中的正式产品名称（原样）",
  "aka": ["资料中的简称"],
  "en": "",
  "brand": "中国联通",
  "category": "internet | security | transport | networking | service",
  "scope": "group | province | legacy | baseline",
  "scopeNote": "适用范围与资料来源省份",
  "status": "在售",
  "tagline": "一句话定位",
  "positioning": "解决什么问题",
  "intro": "资料中的正式介绍", "introSrc": "S0X:P1",
  "customers": [], "needs": [],
  "functions": [{ "name": "", "desc": "", "src": "" }],
  "tech": [], "architecture": { "summary": "", "chain": [] },
  "access": [], "devices": [], "services": [],
  "scenarios": [], "advantages": [], "limits": [{ "text": "", "src": "" }],
  "diff": [{ "vs": "已有产品 id", "text": "", "src": "" }],
  "teacher": { "open": "", "highlight": "", "show": "", "explain": "", "bridge": "" },
  "demos": ["演示 id（可选）"], "related": [], "src": ["S0X"]
}
```

首页全景图的产品入口在 `js/views/home.js` 的 `panorama()` 中按分类排列，新产品需在对应分类的 `items` 里加一行。

## 2. 修改技术参数

参数集中在 `data/parameters.json`，按产品 id 分组：

```json
{ "g": "分组", "n": "参数名", "v": "数值或描述", "u": "单位（可选）", "c": "适用范围与条件", "src": "S0X:P6", "st": "ok" }
```

`st` 取值：`ok` 正式口径，`regional` 省内口径，`old` 早期资料，`conflict` 资料间有差异（同时在 `meta.json` 的 `conflicts` 中说明处理方式）。价格类只收录面向客户材料中的标准资费。

## 3. 增加行业场景

在 `data/scenarios.json` 的 `industries` 中追加：业务节点 `nodes`、带出处的需求 `needs`、推荐产品 `products`（`id` + 角色说明）、行业演示 `demo`（拓扑 id）、案例 `cases`。案例 `type` 必须如实标注：`official` 资料中的具名案例；`anonymized` 资料原文已脱敏；`training` 培训材料案例（需业务确认）。

## 4. 增加 SVG 动态演示

在 `data/topologies.json`（产品 / 技术）或 `data/topologies-industry.json`（行业）中追加一个 demo：

```json
{
  "id": "demo-id", "title": "标题", "kind": "product | tech | industry",
  "products": ["关联产品 id"], "summary": "一句话说明",
  "scenes": [{
    "id": "scene-id", "title": "场景名",
    "zones":    [{ "id": "z1", "x": 30, "y": 96, "w": 330, "h": 588, "label": "客户侧", "tone": "customer" }],
    "nodes":    [{ "id": "rt", "x": 200, "y": 360, "icon": "router", "label": "出口路由器", "sub": "客户自备", "tone": "customer",
                   "info": { "t": "点击后显示的说明", "src": "S03:2.4" } }],
    "links":    [{ "id": "l1", "a": "rt", "b": "bras", "kind": "dedicated", "label": "互联网专线" }],
    "flows":    [{ "id": "f1", "path": ["rt", "bras", "inet"], "kind": "data", "n": 4, "label": "图例名称（可选）" }],
    "callouts": [{ "id": "c1", "at": "bras", "x": 640, "y": 220, "w": 280, "text": "讲解标注", "tone": "info" }],
    "kpis":     [{ "id": "k1", "label": "带宽", "value": "100M – 10G", "src": "S01:P6" }],
    "steps": [
      { "t": "第一步标题", "say": "讲解词", "add": ["z1", "rt", "l1"], "flows": ["f1"], "callouts": ["c1"], "kpis": ["k1"],
        "states": { "l1": "active" }, "src": "S01:P6", "teacher": "本步讲师提示（可选）" }
    ]
  }]
}
```

- 坐标系 1280×720，可见区域为 y 64–700；节点标签默认在下方（`lp` 可设 `t/l/r`）。
- 图标名见 `svg/icons.svg`（`i-` 后的部分，如 `router`、`otn`、`cpe`、`shield`、`cloud`）。新增图标：在该文件追加 `<symbol id="i-xxx" viewBox="0 0 48 48">`，线宽 2.4、`stroke="currentColor"`。
- 节点 `tone`：customer / access / unicom / transport / security / cloud / internet / attacker / platform / legacy / ok。
- 链路 `kind`：lan / fiber / link / dedicated / hardpipe / tunnel / cloud / control / legacy / threat / service。
- 流量 `kind`：data / video / attack / clean / backup / tunnel / cloud / control / security。
- 状态 `states`：active / standby / down（链路断开，显示 ✕）/ alert / protect / ok / normal（清除）。
- 仪表：节点设 `"kind": "meter"`，步骤中用 `"meters": { "m-id": { "value": 80, "text": "80%", "tone": "fault" } }` 更新。
- 演示要出现在某个产品页，把 demo id 写进该产品的 `demos`；要出现在网络技术中心，在 `data/glossary.json` 的 `topics` 中引用。

## 5. 题库与营销素材

- `data/quiz.json`：`type` 取 knowledge / topology / match / param / industry / sales；`answer` 为选项下标；`explain` + `src` 必填。
- `data/sales.json`：决策树 `decision.nodes` / `results`、商机信号、产品组合、SPIN、异议、FAQ；举证只用有出处的事实。
