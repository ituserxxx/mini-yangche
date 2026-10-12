const { cloud } = require('./cloud')

function currentAppId() {
  try {
    return wx.getAccountInfoSync().miniProgram.appId
  } catch (error) {
    return ''
  }
}

function loginWithWechat() {
  return new Promise((resolve, reject) => {
    wx.login({
      success({ code }) {
        const appid = currentAppId()
        cloud.auth
          .signInWithWechat(code, appid)
          .then(({ data, error }) => {
            if (error) {
              reject(error)
              return
            }
            resolve(data)
          })
          .catch(reject)
      },
      fail(error) {
        console.error(
          '[WorkBuddy Cloud] login failed',
          JSON.stringify({ stage: 'wx.login', message: error.errMsg }),
        )
        reject(error)
      },
    })
  })
}

// 会话门禁：优先复用 SDK 持久化的会话（冷启动自动恢复），
// 恢复失败时才用 wx.login + signInWithWechat 换取新会话。
async function ensureSession() {
  try {
    const { data: session, error } = await cloud.auth.getSession()
    if (!error && session) {
      return session
    }
  } catch (error) {
    // 读取本地会话失败，继续走微信登录
  }
  return loginWithWechat()
}

// 页面统一入口：拿不到会话时提示并抛出，调用方据此渲染登录态。
async function requireSession() {
  try {
    return await ensureSession()
  } catch (error) {
    wx.showToast({ title: '登录失败，请稍后重试', icon: 'none' })
    throw error
  }
}

module.exports = { ensureSession, requireSession }
