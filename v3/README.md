# Private Network Demo V3

单文件 HTML 演示与训战测试工具，面向运营商政企客户经理的专线产品培训。

## 入口

- 本地入口：`index.html`
- 页码深链：`?page=N`
- 闯关深链：
  - `?mission=government`
  - `?mission=justice`
  - `?mission=finance`
  - `?mission=manufacturing`

## 内容范围

- 家宽/普通宽带误用问题
- DIA/互联网专线
- 互联网安全专线
- SDH/MSTP 迁转
- OTN/智能 OTN/政企精品网
- 组网专线、PON 组网、云联网相关组网表达
- 医院、四川政务、四川政法、四川金融、大型制造集团组网
- 问题诊断商机页
- 客户侧硬件地图
- 四行业互动闯关考核

## 资料口径

本版本只采用今天 KDocs 中的严格专线类资料，不把云桌面、AI、云网小微、网络延伸服务作为主线内容。采用资料标题包括：

- ★互联网专线业务-202607 - 地市.pptx
- 互联网专线智能升速产品介绍 -26年.pptx
- 中国联通互联网安全专线产品手册、客户介绍、一纸禅及焕新升级通知
- ★政企组网专线业务-202606.pptx
- PON组网专线介绍20230414.pptx
- SDH迁转 政企精品网 2P-CU20250407.pdf
- 政企OTN精品专网汇报支撑材料
- 政企精品网产品及智能化功能介绍-V2.pptx
- 政企OTN专线技术标摘录
- 中国联通政企精品网白皮书.pdf
- OTN政企精品网产品介绍彩页

## 本地测试

在 Codex Desktop 环境可运行：

```bash
NODE_PATH=/Users/jacklei/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules:/Users/jacklei/node_modules \
/Users/jacklei/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node \
private_network_demo_v3_test.js index.html
```

测试覆盖 18 页导航、`?page=N`、四个 `?mission=` 深链和闯关点击交互。
