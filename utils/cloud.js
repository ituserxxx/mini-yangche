const { createMiniProgramWorkBuddyCloud } = require('@tencent-ai/workbuddy-cloud-sdk/miniprogram')
const { createDiagnosticWx } = require('./workbuddy-cloud-diagnostics')

// 仅使用公开配置：endpoint 与 publishableKey 均来自云服务的 publicConfig，
// 不含任何密钥。owner_id 由数据库 DEFAULT auth.uid() 写入，前端永不发送。
const PUBLIC_CONFIG = {
  endpoint: 'https://mp-api.app.workbuddy.host',
  publishableKey: 'wbpk_rqH9yduRb6tiihJzlM54Tw_gSnX75VWPS1Ny6gK6Rt010chceLZ4N2J',
}

const cloud = createMiniProgramWorkBuddyCloud({
  endpoint: PUBLIC_CONFIG.endpoint,
  publishableKey: PUBLIC_CONFIG.publishableKey,
  wx: createDiagnosticWx(wx),
})

module.exports = { cloud, PUBLIC_CONFIG }
