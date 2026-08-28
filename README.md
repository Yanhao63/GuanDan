# 掼蛋蛋

面向四位朋友的在线掼蛋网页游戏。第一版只支持桌面浏览器，界面使用简体中文。

## 本地运行

```powershell
pnpm install
pnpm dev
```

当前已完成可交互的桌面端视觉原型，并开始接入独立规则引擎：现已覆盖单张、对子、三张、三带二、顺子、三连对、钢板、同花顺、四至十张炸弹、四王炸、动态级牌、红桃级牌百搭解释和炸弹比较，同时已实现两副牌生成与发牌、升级、打 A 三次失败降级、贡还牌基础判定、倒计时、报牌与掉线处置的纯规则。

仍在继续实现完整贡还交换流程和客户端网络细节；Cloudflare Durable Objects WebSocket 传输层与权威房间核心已搭建，覆盖房间创建、持久化、休眠连接恢复、个性化状态广播、静态网页托管和机器人自动回合。大厅与牌桌已经改用真实服务端状态。当前测试命令：

```powershell
pnpm test
pnpm build
```

本地联机服务使用 `pnpm dev:worker`，正式部署使用 `pnpm deploy`。

完整需求见 `docs/product-spec.md`，视觉规范见 `design/design-system.md`。
