const { cloud } = require('../../utils/cloud')
const { requireSession } = require('../../utils/auth')
const { typeLabel } = require('../../utils/format')

Page({
  data: {
    vehicles: [],
    loading: true,
  },

  onShow() {
    this.load()
  },

  async load() {
    this.setData({ loading: true })
    try {
      await requireSession()
      const { data, error } = await cloud.database
        .from('vehicles')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error

      const vehicles = (data || []).map((item) => ({
        ...item,
        energyText: typeLabel(item.energy_type),
        // 只有标准色值才渲染成色块，自定义文字颜色不显示
        colorDot: /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(item.color || '') ? item.color : '',
      }))

      const app = getApp()
      if (app) app.globalData.vehicles = vehicles

      this.setData({ vehicles, loading: false })
    } catch (error) {
      this.setData({ loading: false })
      wx.showToast({ title: '加载失败，请检查网络', icon: 'none' })
    }
  },

  onAdd() {
    wx.navigateTo({ url: '/pages/vehicle-edit/vehicle-edit' })
  },

  onEdit(event) {
    const { id } = event.currentTarget.dataset
    wx.navigateTo({ url: '/pages/vehicle-edit/vehicle-edit?id=' + id })
  },
})
