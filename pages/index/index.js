const { cloud } = require('../../utils/cloud')
const { requireSession } = require('../../utils/auth')
const { typeLabel, quantityLabel, dateText, money } = require('../../utils/format')

function monthStart() {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), 1).getTime()
}

Page({
  data: {
    loading: true,
    vehicles: [],
    filterId: null,
    records: [],
    monthAmount: '0.00',
    totalAmount: '0.00',
    totalCount: 0,
  },

  onShow() {
    this.load()
  },

  onPullDownRefresh() {
    this.load().then(() => wx.stopPullDownRefresh())
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

      const app = getApp()
      if (app) app.globalData.vehicles = vehicles || []

      this.allRecords = records || []
      this.setData({ vehicles: vehicles || [] }, () => this.applyFilter())
    } catch (error) {
      this.setData({ loading: false })
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
  },

  applyFilter() {
    const filterId = this.data.filterId
    const list = (this.allRecords || []).filter((item) => {
      if (!filterId) return true
      return item.vehicle_id === filterId
    })

    const start = monthStart()
    let monthAmount = 0
    let totalAmount = 0
    list.forEach((item) => {
      const amount = Number(item.amount) || 0
      totalAmount += amount
      if (new Date(item.record_at).getTime() >= start) {
        monthAmount += amount
      }
    })

    this.setData({
      loading: false,
      records: list.map((item) => ({
        id: item.id,
        vehicleName: item.vehicle_name,
        typeText: typeLabel(item.type),
        isCharge: item.type === 'charge',
        amountText: '¥' + money(item.amount),
        quantityText: quantityLabel(item.quantity, item.type),
        dateText: dateText(item.record_at),
        station: item.station || '',
        note: item.note || '',
      })),
      monthAmount: money(monthAmount),
      totalAmount: money(totalAmount),
      totalCount: list.length,
    })
  },

  onFilter(event) {
    const { id } = event.currentTarget.dataset
    this.setData({ filterId: id === 'all' ? null : Number(id) }, () => this.applyFilter())
  },

  onAdd() {
    wx.navigateTo({ url: '/pages/record/record' })
  },

  onTapRecord(event) {
    const { id } = event.currentTarget.dataset
    wx.navigateTo({ url: '/pages/record/record?id=' + id })
  },

  onGoVehicles() {
    wx.switchTab({ url: '/pages/vehicles/vehicles' })
  },

  onFeedback() {
    wx.navigateTo({ url: '/pages/feedback/feedback' })
  },
})
