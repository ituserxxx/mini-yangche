const { cloud } = require('../../utils/cloud')
const { requireSession } = require('../../utils/auth')
const { money, dateText } = require('../../utils/format')
const { drawPoster, posterSize } = require('../../utils/poster')

const RANGES = [
  { key: 'month', label: '本月' },
  { key: 'year', label: '今年' },
  { key: 'all', label: '全部' },
]

const THEME_NAME = { fuel: '燃油', charge: '纯电', hybrid: '混动' }
const TAGLINE = {
  fuel: '精打细算，每一滴油都值得记录',
  charge: '绿色出行，充电也要算明白',
  hybrid: '油电通吃，账单一目了然',
  default: '记录每一笔，看见用车生活',
}

function rangeStart(key) {
  const now = new Date()
  if (key === 'month') return new Date(now.getFullYear(), now.getMonth(), 1).getTime()
  if (key === 'year') return new Date(now.getFullYear(), 0, 1).getTime()
  return 0
}

function agg(arr) {
  let amount = 0
  let quantity = 0
  arr.forEach((r) => {
    amount += Number(r.amount) || 0
    quantity += Number(r.quantity) || 0
  })
  return { amount, quantity, count: arr.length, avg: quantity > 0 ? amount / quantity : 0 }
}

function colorDot(color) {
  return typeof color === 'string' && color.indexOf('#') === 0 ? color : '#cbd5e1'
}

Page({
  data: {
    loading: true,
    vehicles: [],
    selectedIds: [],
    multiSelect: false,
    selectedCount: 0,
    singleName: '',
    singlePlate: '',
    singleColorDot: '#cbd5e1',
    hasVehicles: false,
    ranges: RANGES.map((item) => item.label),
    rangeIndex: 0,
    theme: 'default',
    themeName: '',
    periodText: '',
    vehicleText: '',
    amountText: '0.00',
    statCells: [],
    posterData: null,
    posterPath: '',
    posterVisible: false,
    generating: false,
  },

  onShow() {
    this.load()
  },

  async load() {
    this.setData({ loading: true })
    try {
      await requireSession()

      const { data: vehicles, error: vehicleError } = await cloud.database
        .from('vehicles')
        .select('*')
        .order('created_at', { ascending: false })
      if (vehicleError) throw vehicleError

      const { data: records, error } = await cloud.database
        .from('records')
        .select('*')
        .order('record_at', { ascending: false })
        .limit(1000)
      if (error) throw error

      this.allRecords = records || []

      const list = (vehicles || []).map((v) => ({
        ...v,
        colorDot: colorDot(v.color),
        selected: true,
      }))

      this.setData(
        {
          vehicles: list,
          selectedIds: list.map((v) => v.id),
          multiSelect: list.length > 1,
          hasVehicles: list.length > 0,
          singleName: list.length ? list[0].name : '',
          singlePlate: list.length ? list[0].plate : '',
          singleColorDot: list.length ? list[0].colorDot : '#cbd5e1',
        },
        () => this.applyFilter()
      )
    } catch (error) {
      this.setData({ loading: false })
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
  },

  applyFilter() {
    const vehicles = this.data.vehicles
    const selectedIds = this.data.selectedIds
    const range = rangeStart(RANGES[this.data.rangeIndex].key)

    const selected = vehicles.filter((v) => selectedIds.indexOf(v.id) >= 0)
    const selIds = selected.map((v) => v.id)
    const list = (this.allRecords || []).filter(
      (r) => selIds.indexOf(r.vehicle_id) >= 0 && new Date(r.record_at).getTime() >= range
    )

    // 按车辆能源类型决定是否需要油/电分区（纯油不展示用电、纯电不展示加油）
    const hasFuel = selected.some((v) => v.energy_type === 'fuel' || v.energy_type === 'hybrid')
    const hasCharge = selected.some((v) => v.energy_type === 'charge' || v.energy_type === 'hybrid')
    const showFuel = hasFuel && list.some((r) => r.type === 'fuel')
    const showCharge = hasCharge && list.some((r) => r.type === 'charge')

    const fuel = agg(list.filter((r) => r.type === 'fuel'))
    const charge = agg(list.filter((r) => r.type === 'charge'))
    const totalAmount = fuel.amount + charge.amount
    const totalCount = list.length
    const totalQuantity = fuel.quantity + charge.quantity

    const theme = !hasFuel && hasCharge ? 'charge' : hasFuel && !hasCharge ? 'fuel' : 'hybrid'
    const periodText = this.periodLabel()
    const vehicleText =
      selected.length === 1
        ? selected[0].name + ' · ' + selected[0].plate
        : selected.length + ' 辆车'

    const statCells = [{ value: String(totalCount), label: '记录次数' }]
    if (showFuel) statCells.push({ value: Number(fuel.quantity || 0).toFixed(2) + ' L', label: '总加油量' })
    if (showCharge) statCells.push({ value: Number(charge.quantity || 0).toFixed(2) + ' kWh', label: '总充电量' })
    statCells.push({ value: '¥' + money(totalQuantity > 0 ? totalAmount / totalQuantity : 0), label: '平均单价' })

    let last = null
    list.forEach((r) => {
      if (!last || new Date(r.record_at).getTime() > new Date(last.record_at).getTime()) last = r
    })
    const lastRecord = last ? dateText(last.record_at) + '  ¥' + money(last.amount) : '暂无记录'

    const posterData = {
      theme,
      period: periodText,
      vehicleText,
      amountTotal: totalAmount,
      showFuel,
      showCharge,
      fuel: { ...fuel, unit: 'L' },
      charge: { ...charge, unit: 'kWh' },
      totalCount,
      lastRecord,
      tagline: TAGLINE[theme] || TAGLINE.default,
    }

    this.setData({
      loading: false,
      theme,
      themeName: THEME_NAME[theme] || '',
      periodText,
      vehicleText,
      amountText: money(totalAmount),
      statCells,
      selectedCount: selected.length,
      posterData,
      posterPath: '',
    })
  },

  periodLabel() {
    const key = RANGES[this.data.rangeIndex].key
    const now = new Date()
    if (key === 'month') return now.getFullYear() + '年' + (now.getMonth() + 1) + '月'
    if (key === 'year') return now.getFullYear() + '年'
    return '全部记录'
  },

  onRangeChange(event) {
    const raw =
      event.detail && event.detail.value !== undefined
        ? event.detail.value
        : event.currentTarget.dataset.index
    const index = Number(raw)
    if (!isFinite(index) || !RANGES[index]) return
    this.setData({ rangeIndex: index }, () => this.applyFilter())
  },

  // 同步选中态：同时刷新 selectedIds 与每张卡的 selected 标志（避免卡片底色不更新）
  syncSelected(ids) {
    const vehicles = this.data.vehicles.map((v) => ({
      ...v,
      selected: ids.indexOf(v.id) >= 0,
    }))
    this.setData({ vehicles, selectedIds: ids }, () => this.applyFilter())
  },

  onToggleVehicle(event) {
    const id = event.currentTarget.dataset.id
    const selectedIds = this.data.selectedIds.slice()
    const pos = selectedIds.indexOf(id)
    if (pos >= 0) selectedIds.splice(pos, 1)
    else selectedIds.push(id)
    this.syncSelected(selectedIds)
  },

  selectAll() {
    this.syncSelected(this.data.vehicles.map((v) => v.id))
  },

  selectNone() {
    this.syncSelected([])
  },

  goVehicles() {
    wx.switchTab({ url: '/pages/vehicles/vehicles' })
  },

  async onGeneratePoster() {
    if (this.data.generating) return
    const pd = this.data.posterData
    if (!pd || (!pd.showFuel && !pd.showCharge) || pd.totalCount === 0) {
      wx.showToast({ title: '当前选择没有记录', icon: 'none' })
      return
    }

    this.setData({ generating: true })
    wx.showLoading({ title: '生成中' })

    try {
      const { W, H } = posterSize(pd)
      const query = wx.createSelectorQuery()
      query.select('#posterCanvas').fields({ node: true, size: true }).exec((res) => {
        if (!res || !res[0] || !res[0].node) {
          wx.hideLoading()
          this.setData({ generating: false })
          wx.showToast({ title: '海报生成失败', icon: 'none' })
          return
        }

        const canvas = res[0].node
        const ctx = canvas.getContext('2d')
        const dpr =
          (wx.getWindowInfo && wx.getWindowInfo().pixelRatio) ||
          wx.getSystemInfoSync().pixelRatio ||
          2

        canvas.width = W * dpr
        canvas.height = H * dpr
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        ctx.scale(dpr, dpr)
        drawPoster(ctx, pd, W, H)

        wx.canvasToTempFilePath({
          canvas,
          x: 0,
          y: 0,
          width: W,
          height: H,
          destWidth: W * dpr,
          destHeight: H * dpr,
          success: (result) => {
            wx.hideLoading()
            this.setData({ generating: false, posterPath: result.tempFilePath, posterVisible: true })
          },
          fail: () => {
            wx.hideLoading()
            this.setData({ generating: false })
            wx.showToast({ title: '海报生成失败', icon: 'none' })
          },
        })
      })
    } catch (error) {
      wx.hideLoading()
      this.setData({ generating: false })
      wx.showToast({ title: '海报生成失败', icon: 'none' })
    }
  },

  closePoster() {
    this.setData({ posterVisible: false })
  },

  noop() {},

  onPreviewPoster() {
    if (!this.data.posterPath) return
    wx.previewImage({ urls: [this.data.posterPath], current: this.data.posterPath })
  },

  onSavePoster() {
    if (!this.data.posterPath) return
    wx.saveImageToPhotosAlbum({
      filePath: this.data.posterPath,
      success: () => wx.showToast({ title: '已保存到相册', icon: 'success' }),
      fail: (error) => {
        const msg = (error && error.errMsg) || ''
        if (msg.indexOf('auth deny') >= 0 || msg.indexOf('authorize') >= 0) {
          wx.showModal({
            title: '需要相册权限',
            content: '保存海报需要你允许使用相册，是否去设置中开启？',
            confirmText: '去设置',
            cancelText: '暂不保存',
            success: (res) => {
              if (!res.confirm) return
              wx.openSetting({
                success: (settingRes) => {
                  if (settingRes.authSetting['scope.writePhotosAlbum']) {
                    this.onSavePoster()
                  } else {
                    wx.showToast({ title: '未获得相册权限', icon: 'none' })
                  }
                },
                fail: () => wx.showToast({ title: '打开设置失败', icon: 'none' }),
              })
            },
          })
          return
        }
        wx.showToast({ title: '保存失败', icon: 'none' })
      },
    })
  },

  onSharePoster() {
    if (!this.data.posterPath) return
    if (wx.showShareImageMenu) {
      wx.showShareImageMenu({
        path: this.data.posterPath,
        fail: () => wx.showToast({ title: '请点右上角 ··· 分享', icon: 'none' }),
      })
    } else {
      wx.showModal({
        title: '分享朋友圈',
        content: '请点击右上角「···」选择分享到朋友圈',
        showCancel: false,
      })
    }
  },

  onShareAppMessage() {
    const { posterData } = this.data
    return {
      title: posterData && posterData.totalCount
        ? posterData.vehicleText + ' ' + posterData.period + '用车花了 ¥' + money(posterData.amountTotal) + '，来看看账单'
        : '养车刺客 · 一键生成账单海报',
      path: '/pages/index/index',
      imageUrl: this.data.posterPath || '',
    }
  },

  onShareTimeline() {
    const { posterData } = this.data
    return {
      title: posterData && posterData.totalCount
        ? '用车账单 ¥' + money(posterData.amountTotal)
        : '养车刺客',
      query: '',
      imageUrl: this.data.posterPath || '',
    }
  },
})
