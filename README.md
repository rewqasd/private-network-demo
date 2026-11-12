# 中国联通政企专线产品动态演示平台 V4.0

面向运营商政企客户经理培训、客户讲解与市场拓展的专线产品知识库 + 网络原理动态演示系统。纯静态站点，托管于 GitHub Pages。

- 正式访问地址：<https://rewqasd.github.io/private-network-demo/>
- V3 历史版本（原样归档，旧深链 `?page=N`、`?mission=xxx` 自动跳转）：<https://rewqasd.github.io/private-network-demo/v3/>
- V3 可恢复节点：Git 标签 `v3.2-final`（commit `fe5960a`）

## 八大模块

| 模块 | 内容 |
| --- | --- |
| 01 产品全景 | 政企专线联网产品地图：互联网接入（点到网）、精品传输（二层硬管道）、组网与云网（三层组网）、网络延伸服务 |
| 02 产品中心 | 18 个产品条目：正式名称、定位、功能、核心技术、参数表（逐条出处）、网络架构、场景、优势、限制、差异、讲师提示 |
| 03 动态演示 | 16 套、19 个场景、105 个讲解步骤的 SVG 动态拓扑；分步播放、暂停、重播、调速、节点说明、路径高亮 |
| 04 网络技术 | 10 个技术主题（接入、OTN 保护、SDH 迁转、多分支组网、云网互联、PON 虚拟专网等）+ 术语表 |
| 05 行业方案 | 政务、政法公安、金融、医疗卫健、教育、制造与能源、集团企业与连锁；组合演示 + 资料案例 |
| 06 产品对比 | 6 张“同一资料口径”对比表 + 自选对比 |
| 07 营销实战 | 需求识别决策树、商机信号、产品组合、SPIN 提问、异议处理、客户常见问题 |
| 08 课堂互动 | 29 道题、六类题型，练习 / 测验模式，答案解析与得分统计 |

另有“资料口径”页：资料登记表、12 项资料差异及处理方式、展示口径说明。

## 讲师快捷键

| 按键 | 作用 |
| --- | --- |
| `←` `→`（或翻页笔 `PageUp` `PageDown`） | 演示：上一步 / 下一步；其他页面：切换同级页面 |
| `空格` | 自动播放 / 暂停（暂停时动画冻结） |
| `R` | 重播 |
| `1`–`9`、`Home`、`End` | 跳到指定步骤 / 第一步 / 最后一步 |
| `[` `]` | 行业方案、技术主题：上一个 / 下一个 |
| `F` | 演示区全屏投影 |
| `P` | 讲师模式（放大拓扑、隐藏次要信息） |
| `T` | 讲师提示 |
| `Esc` | 关闭说明 / 弹层 |
| `?` | 快捷键说明 |

输入框内打字时快捷键不生效。演示地址会记录场景与步骤（如 `#/demo/premium-network?scene=protect&step=4`），刷新或分享后停在同一步。

## 本地预览

站点通过 HTTP 读取 `data/*.json`，不能直接双击 `index.html` 打开。

```bash
node tests/serve.mjs 8080
```

然后访问 <http://localhost:8080/private-network-demo/>（模拟 GitHub Pages 子路径）。

## 项目结构

```text
index.html              应用外壳（顶栏、导航、主体）
css/                    design-system / base / layout / components / topology / responsive
js/
  app.js                入口：加载数据、注册路由、渲染
  router.js             hash 路由（刷新不 404）
  store.js              数据加载与索引
  interaction.js        快捷键、讲师模式、全屏、帮助
  ui.js                 通用片段（出处标签、徽标、图标）
  topology/engine.js    拓扑渲染引擎（JSON → SVG）
  topology/player.js    分步播放控制器
  components/demo-player.js  演示播放器组件
  views/*.js            八大模块与资料口径页
data/                   全部内容数据（产品、参数、对比、行业、营销、题库、术语、拓扑、资料来源）
svg/icons.svg           统一设备图标库（43 个 symbol）
tests/                  数据校验、布局碰撞检测、端到端测试、本地服务器
docs/                   架构、数据维护、资料研究报告、V3 分析、测试报告、更新日志
v3/                     V3 原样归档
```

## 测试

```bash
npm i -D playwright         # 首次（或设置 PLAYWRIGHT_PATH 指向已安装的 playwright）
node tests/validate_data.mjs                 # 数据完整性与敏感信息检查
node tests/private_network_demo_v4_test.js   # 端到端：功能、内容、安全、5 种分辨率、逐步布局碰撞
node tests/private_network_demo_v4_test.js https://rewqasd.github.io/private-network-demo/   # 线上验收
```

## 资料口径与安全

- 产品名称、参数、功能均来自金山文档资料，页面逐条标注资料编号与页码（见“资料口径”页）。
- 不在站点中写入任何在线文档链接、文件 ID、访问凭据、个人联系方式或客户合同信息。
- 资费只展示“面向客户”材料中的标准资费（互联网安全专线安全服务附加产品），结算价、佣金、折扣审批与区域报价不展示。

## 维护

新增产品、修改参数、增加行业场景或新的 SVG 动画，见 [docs/data-guide.md](docs/data-guide.md)。整体设计见 [docs/architecture.md](docs/architecture.md)。
