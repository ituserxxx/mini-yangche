# mini-yangche · 养车刺客

汽车加油 / 充电记账微信小程序：车辆管理、随手记账、周期统计 + 账单海报（含引流二维码）、意见反馈。

## 技术栈

- 微信原生小程序（无自建后端）
- WorkBuddy 云服务：PostgreSQL + 云鉴权（`@tencent-ai/workbuddy-cloud-sdk/miniprogram`）
- 海报：Canvas 2D 本地绘制 + `qrcode-generator` 纯前端生成引流二维码

## 目录结构

```
app.js / app.json / app.wxss   全局入口与样式（含主题联动与通用卡片组件）
pages/
  index/                       记录列表首页
  record/                      记一笔（加油/充电表单）
  vehicles/  vehicle-edit/     车辆列表与车辆表单
  stats/                       统计 + 海报弹窗（保存相册 / 分享朋友圈）
  feedback/                    意见反馈
utils/
  cloud.js                     云服务初始化（仅公开 endpoint + publishableKey）
  auth.js                      ensureSession 会话门禁（wx.login + signInWithWechat）
  poster.js                    海报绘制（按能源类型自适应：纯油不展示电，纯电不展示油）
  format.js                    格式化工具
```

## 数据安全

- 数据表：`vehicles` / `records` / `feedback`
- 全部 `owner_id TEXT NOT NULL DEFAULT auth.uid()` + RLS `FOR ALL USING/WITH CHECK (owner_id = auth.uid())` + GRANT 到 `authenticated, anon`
- 前端永不发送 owner_id，多用户天然隔离

## 发布

`project.config.json` 已绑定 AppID；通过 WorkBuddy 小程序产物卡片 → 预览面板「分享」→「绑定已有小程序」扫码授权发布体验版。
