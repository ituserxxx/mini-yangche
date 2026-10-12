const { cloud } = require('../../utils/cloud')
const { requireSession } = require('../../utils/auth')
const { todayInputValue, toInputDate, fromInputDate, unitPrice } = require('../../utils/format')

const TYPE_TABS = [
  { value: 'fuel', label: '加油', desc: '按升 / 油价', icon: '⛽', bg: '#ffedd5' },
  { value: 'charge', label: '充电', desc: '按度 / 电价', icon: '🔋', bg: '#d1fae5' },
]

function typeMetaOf(type) {
  const hit = TYPE_TABS.find((item) => item.value === type)
  return hit || TYPE_TABS[0]
}

function colorDotOf(color) {
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(color || '') ? color : ''
}

Page({
  data: {
    isEdit: false,
    recordId: null,
    vehicles: [],
    vehicleIndex: 0,
    typeTabs: TYPE_TABS,
    typeName: TYPE_TABS[0].label,
    typeIcon: TYPE_TABS[0].icon,
    recordDate: '',
    recordTime: '',
    focusKey: '',
    saving: false,
    form: {
      vehicle_id: null,
      vehicle_name: '',
      type: 'fuel',
      amount: '',
      quantity: '',
      unit_price: '',
      odometer: '',
      station: '',
      location: '',
      note: '',
    },
  },

  onLoad(options) {
    const now = new Date()
    this.setData({ recordDate: todayInputValue(), recordTime: toInputDate(now).slice(11, 16) })

    if (options.id) {
      this.setData({ isEdit: true, recordId: options.id })
      wx.setNavigationBarTitle({ title: '编辑记录' })
    } else {
      wx.setNavigationBarTitle({ title: '记一笔' })
    }
    this.presetVehicleId = options.vehicleId || null
  },

  onShow() {
    this.loadVehicles()
  },

  async loadVehicles() {
    try {
      await requireSession()
      const { data, error } = await cloud.database
        .from('vehicles')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error

      const vehicles = (data || []).map((item) => ({
        ...item,
        colorDot: colorDotOf(item.color),
      }))

      if (!vehicles.length) {
        this.setData({ vehicles: [] })
        return
      }

      const app = getApp()
      if (app) app.globalData.vehicles = vehicles

      let vehicleIndex = 0
      const preset = Number(this.presetVehicleId)
      const lastId = app && app.globalData.lastVehicleId
      const targetId = preset || lastId
      if (targetId) {
        const found = vehicles.findIndex((item) => item.id === targetId)
        if (found >= 0) vehicleIndex = found
      }

      this.setData({ vehicles, vehicleIndex }, () => {
        this.applyVehicle(vehicleIndex)
        if (this.data.isEdit) this.loadRecord()
      })
    } catch (error) {
      wx.showToast({ title: '加载车辆失败', icon: 'none' })
    }
  },

  applyVehicle(index) {
    const vehicle = this.data.vehicles[index]
    if (!vehicle) return
    const type = vehicle.energy_type === 'charge' ? 'charge' : 'fuel'
    const meta = typeMetaOf(type)
    this.setData({
      'form.vehicle_id': vehicle.id,
      'form.vehicle_name': vehicle.name,
      'form.type': type,
      typeName: meta.label,
      typeIcon: meta.icon,
    })
  },

  async loadRecord() {
    try {
      const { data, error } = await cloud.database
        .from('records')
        .select('*')
        .eq('id', Number(this.data.recordId))
        .maybeSingle()

      if (error) throw error
      if (!data) {
        wx.showToast({ title: '记录不存在', icon: 'none' })
        wx.navigateBack()
        return
      }

      const vehicleIndex = Math.max(
        0,
        this.data.vehicles.findIndex((item) => item.id === data.vehicle_id),
      )
      const meta = typeMetaOf(data.type)
      const recordAt = new Date(data.record_at)
      this.setData({
        vehicleIndex,
        typeName: meta.label,
        typeIcon: meta.icon,
        recordDate: toInputDate(recordAt).slice(0, 10),
        recordTime: toInputDate(recordAt).slice(11, 16),
        form: {
          vehicle_id: data.vehicle_id,
          vehicle_name: data.vehicle_name || '',
          type: data.type || 'fuel',
          amount: data.amount != null ? String(data.amount) : '',
          quantity: data.quantity != null ? String(data.quantity) : '',
          unit_price: data.unit_price != null ? String(data.unit_price) : '',
          odometer: data.odometer != null ? String(data.odometer) : '',
          station: data.station || '',
          location: data.location || '',
          note: data.note || '',
        },
      })
      this.applyVehicle(vehicleIndex)
    } catch (error) {
      wx.showToast({ title: '加载记录失败', icon: 'none' })
    }
  },

  onVehicleSelect(event) {
    const index = Number(event.currentTarget.dataset.index)
    this.setData({ vehicleIndex: index }, () => this.applyVehicle(index))
  },

  onTypeSelect(event) {
    const { value } = event.currentTarget.dataset
    if (this.data.form.type === value) return
    const meta = typeMetaOf(value)
    this.setData({
      'form.type': value,
      typeName: meta.label,
      typeIcon: meta.icon,
    })
    wx.vibrateShort({ type: 'light', fail: () => {} })
  },

  onInput(event) {
    const { key } = event.currentTarget.dataset
    this.setData({ ['form.' + key]: event.detail.value })
  },

  onFocus(event) {
    this.setData({ focusKey: event.currentTarget.dataset.key || '' })
  },

  onBlur() {
    this.setData({ focusKey: '' })
  },

  onDateChange(event) {
    this.setData({ recordDate: event.detail.value })
  },

  onTimeChange(event) {
    this.setData({ recordTime: event.detail.value })
  },

  computedUnitPrice() {
    const price = unitPrice(this.data.form.amount, this.data.form.quantity)
    return price == null ? '' : price.toFixed(2)
  },

  async onSave() {
    if (this.data.saving) return

    const { form, vehicles, vehicleIndex } = this.data
    const vehicle = vehicles[vehicleIndex]
    if (!vehicle) {
      wx.showToast({ title: '请先添加车辆', icon: 'none' })
      return
    }

    const amount = Number(form.amount)
    if (!form.amount || !isFinite(amount) || amount <= 0) {
      wx.showToast({ title: '请填写金额', icon: 'none' })
      return
    }

    const quantity = form.quantity === '' ? null : Number(form.quantity)
    if (quantity != null && (!isFinite(quantity) || quantity < 0)) {
      wx.showToast({ title: '数量填写有误', icon: 'none' })
      return
    }

    this.setData({ saving: true })
    try {
      await requireSession()
      const computed = this.computedUnitPrice()
      const payload = {
        vehicle_id: vehicle.id,
        vehicle_name: vehicle.name,
        type: form.type,
        amount,
        quantity,
        unit_price: form.unit_price === '' ? (computed === '' ? null : Number(computed)) : Number(form.unit_price),
        odometer: form.odometer === '' ? null : Number(form.odometer),
        station: form.station.trim(),
        location: form.location.trim(),
        note: form.note.trim(),
        record_at: fromInputDate(this.data.recordDate + 'T' + (this.data.recordTime || '00:00')),
      }

      if (this.data.isEdit) {
        const { data, error } = await cloud.database
          .from('records')
          .update(payload)
          .eq('id', Number(this.data.recordId))
          .select()

        if (error || !data || !data.length) {
          wx.showToast({ title: '保存失败', icon: 'none' })
          return
        }
      } else {
        const { error } = await cloud.database.from('records').insert(payload).select()
        if (error) {
          wx.showToast({ title: '保存失败', icon: 'none' })
          return
        }
      }

      const app = getApp()
      if (app) app.setLastVehicleId(vehicle.id)

      wx.showToast({ title: '已记录', icon: 'success' })
      setTimeout(() => wx.navigateBack(), 500)
    } catch (error) {
      wx.showToast({ title: '保存失败，请重试', icon: 'none' })
    } finally {
      this.setData({ saving: false })
    }
  },

  async onDelete() {
    const confirmed = await new Promise((resolve) => {
      wx.showModal({
        title: '删除记录',
        content: '确认删除这条记录？',
        confirmColor: '#e0245e',
        success: (res) => resolve(res.confirm),
        fail: () => resolve(false),
      })
    })
    if (!confirmed) return

    try {
      await requireSession()
      const { data } = await cloud.database
        .from('records')
        .delete()
        .eq('id', Number(this.data.recordId))
        .select()

      if (!data || !data.length) {
        wx.showToast({ title: '删除失败', icon: 'none' })
        return
      }
      wx.showToast({ title: '已删除', icon: 'success' })
      setTimeout(() => wx.navigateBack(), 500)
    } catch (error) {
      wx.showToast({ title: '删除失败', icon: 'none' })
    }
  },
})
