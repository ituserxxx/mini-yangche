// 海报绘制工具：表单同款卡片风格，按能源类型自适应（纯油不展示用电 / 纯电不展示加油）
// 左下角绘制可扫描的引流二维码（纯前端生成，无需后端）

const qrcode = require('qrcode-generator')

const THEMES = {
  default: { c0: '#3b82f6', c1: '#1e40af', accent: '#2563eb', name: '综合' },
  fuel: { c0: '#fb923c', c1: '#d9480f', accent: '#ea580c', name: '燃油' },
  charge: { c0: '#34d399', c1: '#047857', accent: '#059669', name: '纯电' },
  hybrid: { c0: '#818cf8', c1: '#4338ca', accent: '#4f46e5', name: '混动' },
}

// 引流二维码配置：把 qrUrl 改成你的小程序分享链接 / 落地页（ASCII 链接最稳）；
// 若要「扫一扫直接打开小程序」，请把官方小程序码 PNG 放到 assets/qrcode.png 并把 qrImage 设为该路径。
const POSTER_CONFIG = {
  qrUrl: '',
  qrImage: '',
}

const FALLBACK_QR = 'https://workbuddy.cn/app/fuel-ev-log'
const APP_NAME = '养车刺客'

function money(v) {
  const n = Number(v)
  return (isFinite(n) ? n : 0).toFixed(2)
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

// 动态布局：依据油/电分区数量决定海报高度，避免空白；底部预留二维码区
function computeLayout(data) {
  const W = 640
  const n = (data.showFuel ? 1 : 0) + (data.showCharge ? 1 : 0)
  const heroH = 268
  const cy = 250 // 白色内容卡顶部（与头图轻微重叠，形成层叠）
  const innerTop = cy + 74
  const step = 190
  const sectionH = 164
  const sectionsBottom = innerTop + n * step
  const cardBottom = sectionsBottom + 94 // 最近一笔 + 内边距
  const taglineY = cardBottom + 56
  const footerTop = cardBottom + 102
  const footerH = 168
  const H = footerTop + footerH + 24
  return { W, H, heroH, cy, innerTop, step, sectionH, cardBottom, taglineY, footerTop, footerH }
}

function posterSize(data) {
  const l = computeLayout(data)
  return { W: l.W, H: l.H }
}

function drawHero(ctx, W, Hh, theme) {
  const r = 44
  const g = ctx.createLinearGradient(0, 0, W, Hh)
  g.addColorStop(0, theme.c0)
  g.addColorStop(1, theme.c1)
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.lineTo(W, 0)
  ctx.lineTo(W, Hh - r)
  ctx.quadraticCurveTo(W, Hh, W - r, Hh)
  ctx.lineTo(r, Hh)
  ctx.quadraticCurveTo(0, Hh, 0, Hh - r)
  ctx.closePath()
  ctx.fillStyle = g
  ctx.fill()
}

// 绘制可扫描二维码（纯前端生成）。返回 false 表示无法生成。
function drawQrCode(ctx, x, y, size, text) {
  try {
    const qr = qrcode(0, 'M') // 0 = 自动版本，M = 中等纠错
    qr.addData(text)
    qr.make()
    const count = qr.getModuleCount()
    const quiet = 4
    const total = count + quiet * 2
    const cell = size / total
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(x, y, size, size)
    ctx.fillStyle = '#0f172a'
    for (let r = 0; r < count; r++) {
      for (let c = 0; c < count; c++) {
        if (qr.isDark(r, c)) {
          ctx.fillRect(x + (c + quiet) * cell, y + (r + quiet) * cell, cell, cell)
        }
      }
    }
    return true
  } catch (e) {
    return false
  }
}

function drawPoster(ctx, data, W, H) {
  const theme = THEMES[data.theme] || THEMES.default
  const L = computeLayout(data)
  ctx.textBaseline = 'alphabetic'

  // 页面背景
  ctx.fillStyle = '#f8fafc'
  ctx.fillRect(0, 0, W, H)

  // ===== 头图 =====
  drawHero(ctx, W, L.heroH, theme)
  ctx.save()
  ctx.globalAlpha = 0.12
  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  ctx.arc(W * 0.82, 46, 92, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(W * 0.1, 214, 66, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  // 标题 + 副标题
  ctx.textAlign = 'left'
  ctx.fillStyle = '#ffffff'
  ctx.font = '600 40px sans-serif'
  ctx.fillText('我的用车账单', 44, 74)
  ctx.font = '24px sans-serif'
  ctx.fillStyle = 'rgba(255,255,255,0.85)'
  ctx.fillText(data.period || '', 46, 110)

  // 类型徽标（右上角胶囊）
  const badge = theme.name === '综合' ? '综合' : theme.name + '车'
  ctx.font = '24px sans-serif'
  const bw = ctx.measureText(badge).width + 40
  roundRect(ctx, W - bw - 34, 48, bw, 46, 23)
  ctx.fillStyle = 'rgba(255,255,255,0.22)'
  ctx.fill()
  ctx.textAlign = 'center'
  ctx.fillStyle = '#ffffff'
  ctx.fillText(badge, W - 34 - bw / 2, 79)

  // 总支出标签 + 大金额（拉开间距，避免叠字）
  ctx.textAlign = 'left'
  ctx.font = '24px sans-serif'
  ctx.fillStyle = 'rgba(255,255,255,0.82)'
  ctx.fillText('总支出', 44, 156)
  ctx.font = '600 74px sans-serif'
  ctx.fillStyle = '#ffffff'
  ctx.fillText('¥' + money(data.amountTotal), 44, 228)

  // ===== 白色内容卡 =====
  const cardX = 40
  const cardW = W - 80
  roundRect(ctx, cardX, L.cy, cardW, L.cardBottom - L.cy, 36)
  ctx.fillStyle = '#ffffff'
  ctx.fill()
  ctx.strokeStyle = '#eef2f7'
  ctx.lineWidth = 2
  ctx.stroke()

  // 车辆范围（卡内小标题）
  ctx.textAlign = 'left'
  ctx.font = '24px sans-serif'
  ctx.fillStyle = '#9ca3af'
  ctx.fillText(data.vehicleText || '', cardX + 28, L.cy + 42)

  // ===== 油 / 电分区（仅展示与所选车辆类型相关的）=====
  const sections = []
  if (data.showFuel) sections.push({ icon: '⛽', name: '加油', d: data.fuel, unit: (data.fuel && data.fuel.unit) || 'L' })
  if (data.showCharge) sections.push({ icon: '🔋', name: '充电', d: data.charge, unit: (data.charge && data.charge.unit) || 'kWh' })
  const twoSections = sections.length === 2

  let y = L.innerTop
  sections.forEach((s) => {
    const sx = cardX + 22
    const sw = cardW - 44
    const sh = L.sectionH
    roundRect(ctx, sx, y, sw, sh, 24)
    ctx.fillStyle = '#f7f9fc'
    ctx.fill()

    // 标题行：名称（左）+ 金额（右）
    ctx.textAlign = 'left'
    ctx.font = '600 30px sans-serif'
    ctx.fillStyle = '#111827'
    ctx.fillText(s.icon + '  ' + s.name, sx + 24, y + 50)
    ctx.textAlign = 'right'
    ctx.font = '600 34px sans-serif'
    ctx.fillStyle = theme.accent
    ctx.fillText('¥' + money(s.d.amount), sx + sw - 24, y + 52)

    // 标题下：占比进度条（双分区）或细分隔线（单分区），避免堆数字
    const barX = sx + 24
    const barW = sw - 48
    const barY = y + 66
    const barH = 8
    if (twoSections) {
      roundRect(ctx, barX, barY, barW, barH, 4)
      ctx.fillStyle = '#e6eaf0'
      ctx.fill()
      const share = data.amountTotal > 0 ? s.d.amount / data.amountTotal : 0
      if (share > 0.015) {
        roundRect(ctx, barX, barY, Math.max(barW * share, barH), barH, 4)
        ctx.fillStyle = theme.accent
        ctx.fill()
      }
    } else {
      ctx.strokeStyle = '#e9edf3'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(barX, barY + barH / 2)
      ctx.lineTo(barX + barW, barY + barH / 2)
      ctx.stroke()
    }

    // 指标：一行三列（总量 / 次数 / 均价），数值下方留足间距给标签
    const cols = [
      { v: Number(s.d.quantity || 0).toFixed(2) + ' ' + s.unit, l: '总量' },
      { v: String(s.d.count), l: '次数' },
      { v: s.d.quantity > 0 ? '¥' + money(s.d.avg) : '—', l: '均价/' + s.unit },
    ]
    const mStartX = sx + 24
    const colW = (sw - 48) / 3
    cols.forEach((c, i) => {
      const cx = mStartX + i * colW
      ctx.textAlign = 'left'
      ctx.font = '600 26px sans-serif'
      ctx.fillStyle = '#111827'
      ctx.fillText(c.v, cx, y + 118)
      ctx.font = '20px sans-serif'
      ctx.fillStyle = '#9ca3af'
      ctx.fillText(c.l, cx, y + 146)
    })

    y += L.step
  })

  // 最近一笔
  ctx.strokeStyle = '#f0f2f5'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(cardX + 30, L.cardBottom - 58)
  ctx.lineTo(cardX + cardW - 30, L.cardBottom - 58)
  ctx.stroke()
  ctx.textAlign = 'left'
  ctx.font = '24px sans-serif'
  ctx.fillStyle = '#6b7280'
  ctx.fillText('最近一笔', cardX + 30, L.cardBottom - 30)
  ctx.textAlign = 'right'
  ctx.font = '600 28px sans-serif'
  ctx.fillStyle = '#111827'
  ctx.fillText(data.lastRecord || '暂无记录', cardX + cardW - 30, L.cardBottom - 28)

  // 底部标语
  ctx.textAlign = 'center'
  ctx.font = '600 28px sans-serif'
  ctx.fillStyle = theme.accent
  ctx.fillText(data.tagline || '记录每一笔，看见用车生活', W / 2, L.taglineY)

  // ===== 底部引流区：白卡 + 二维码（左下）+ 文案（右侧）=====
  const fy = L.footerTop
  const fh = L.footerH
  roundRect(ctx, 28, fy, W - 56, fh, 28)
  ctx.fillStyle = '#ffffff'
  ctx.fill()
  ctx.strokeStyle = '#eef2f7'
  ctx.lineWidth = 2
  ctx.stroke()

  const qrSize = 124
  const qrX = 44
  const qrY = fy + (fh - qrSize) / 2
  let qrOk = false
  if (POSTER_CONFIG.qrImage) {
    try {
      const img = ctx.createImage ? ctx.createImage() : null
      if (img) {
        img.src = POSTER_CONFIG.qrImage
        ctx.drawImage(img, qrX, qrY, qrSize, qrSize)
        qrOk = true
      }
    } catch (e) {
      qrOk = false
    }
  }
  if (!qrOk) {
    roundRect(ctx, qrX - 8, qrY - 8, qrSize + 16, qrSize + 16, 16)
    ctx.fillStyle = '#ffffff'
    ctx.fill()
    ctx.strokeStyle = '#e5e7eb'
    ctx.lineWidth = 2
    ctx.stroke()
    drawQrCode(ctx, qrX, qrY, qrSize, POSTER_CONFIG.qrUrl || FALLBACK_QR)
  }

  const textX = qrX + qrSize + 28
  ctx.textAlign = 'left'
  ctx.font = '600 30px sans-serif'
  ctx.fillStyle = '#111827'
  ctx.fillText(APP_NAME, textX, fy + fh / 2 - 22)
  ctx.font = '24px sans-serif'
  ctx.fillStyle = theme.accent
  ctx.fillText('扫码记录你的用车账单', textX, fy + fh / 2 + 12)
  ctx.font = '22px sans-serif'
  ctx.fillStyle = '#9ca3af'
  ctx.fillText('数据仅本人可见', textX, fy + fh / 2 + 44)
}

module.exports = { drawPoster, posterSize, THEMES, POSTER_CONFIG }
