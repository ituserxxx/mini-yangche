const { cloud } = require('../../utils/cloud')
const { requireSession } = require('../../utils/auth')

const ENERGY_TYPES = [
  { value: 'fuel', label: '燃油车', desc: '按升 / 油价', icon: '⛽', bg: '#ffedd5' },
  { value: 'charge', label: '纯电车', desc: '按度 / 电价', icon: '🔋', bg: '#d1fae5' },
  { value: 'hybrid', label: '混动车', desc: '油电都记', icon: '♻️', bg: '#e0e7ff' },
]

const BRAND_CHIPS = ['比亚迪', '特斯拉', '丰田', '本田', '大众', '蔚来', '理想', '小鹏', '吉利', '长安']

const COLOR_OPTIONS = [
  { hex: '#f8fafc', name: '珍珠白' },
  { hex: '#94a3b8', name: '星空灰' },
  { hex: '#1f2937', name: '曜石黑' },
  { hex: '#cbd5e1', name: '极光银' },
  { hex: '#2563eb', name: '宝石蓝' },
  { hex: '#dc2626', name: '烈焰红' },
  { hex: '#059669', name: '墨玉绿' },
  { hex: '#d4a373', name: '香槟金' },
]

const emptyForm = () => ({
  name: '',
  plate: '',
  energy_type: 'fuel',
  brand_model: '',
  color: '',
  note: '',
})

function labelOf(energyType) {
  const hit = ENERGY_TYPES.find((item) => item.value === energyType)
  return hit ? hit.label : ENERGY_TYPES[0].label
}

Page({
  data: {
    isEdit: false,
    vehicleId: null,
    energyTypes: ENERGY_TYPES,
    brandChips: BRAND_CHIPS,
    colorOptions: COLOR_OPTIONS,
    energyLabel: labelOf('fuel'),
    focusKey: '',
    saving: false,
    form: emptyForm(),
  },

  onLoad(options) {
    if (options.id) {
      this.setData({ isEdit: true, vehicleId: options.id })
      wx.setNavigationBarTitle({ title: '编辑车辆' })
      this.loadVehicle(options.id)
    } else {
      wx.setNavigationBarTitle({ title: '添加车辆' })
    }
  },

  async loadVehicle(id) {
    try {
      await requireSession()
      const { data, error } = await cloud.database
        .from('vehicles')
        .select('*')
        .eq('id', Number(id))
        .maybeSingle()

      if (error) throw error
      if (!data) {
        wx.showToast({ title: '车辆不存在', icon: 'none' })
        wx.navigateBack()
        return
      }

      const energyType = data.energy_type || 'fuel'
      this.setData({
        form: {
          name: data.name || '',
          plate: (data.plate || '').toUpperCase(),
          energy_type: energyType,
          brand_model: data.brand_model || '',
          color: data.color || '',
          note: data.note || '',
        },
        energyLabel: labelOf(energyType),
      })
    } catch (error) {
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
  },

  onInput(event) {
    const { key } = event.currentTarget.dataset
    let value = event.detail.value
    // 车牌统一大写，输入即见效（顶部预览同步变化）
    if (key === 'plate') value = value.toUpperCase()
    this.setData({ ['form.' + key]: value })
  },

  onFocus(event) {
    this.setData({ focusKey: event.currentTarget.dataset.key || '' })
  },

  onBlur() {
    this.setData({ focusKey: '' })
  },

  onEnergySelect(event) {
    const { value } = event.currentTarget.dataset
    if (this.data.form.energy_type === value) return
    this.setData({
      'form.energy_type': value,
      energyLabel: labelOf(value),
    })
    wx.vibrateShort({ type: 'light', fail: () => {} })
  },

  // 色板点选，再点一次取消
  onColorSelect(event) {
    const { hex } = event.currentTarget.dataset
    const next = this.data.form.color === hex ? '' : hex
    this.setData({ 'form.color': next })
    wx.vibrateShort({ type: 'light', fail: () => {} })
  },

  // 品牌快捷标签：点已选中的再取消，否则填入
  onBrandChip(event) {
    const { value } = event.currentTarget.dataset
    const next = this.data.form.brand_model === value ? '' : value
    this.setData({ 'form.brand_model': next })
  },

  async onSave() {
    if (this.data.saving) return

    const { name, plate } = this.data.form
    if (!name.trim()) {
      wx.showToast({ title: '请填写车辆昵称', icon: 'none' })
      return
    }
    if (!plate.trim()) {
      wx.showToast({ title: '请填写车牌号', icon: 'none' })
      return
    }

    this.setData({ saving: true })
    try {
      await requireSession()
      const payload = {
        name: name.trim(),
        plate: plate.trim().toUpperCase(),
        energy_type: this.data.form.energy_type,
        brand_model: this.data.form.brand_model.trim(),
        color: this.data.form.color.trim(),
        note: this.data.form.note.trim(),
      }

      if (this.data.isEdit) {
        // 编辑：按主键精确更新，RLS 保证只能改自己的车
        const { data, error } = await cloud.database
          .from('vehicles')
          .update(payload)
          .eq('id', Number(this.data.vehicleId))
          .select()

        if (error) {
          if (error.code === '23505') {
            wx.showToast({ title: '该车牌已存在', icon: 'none' })
          } else {
            wx.showToast({ title: '保存失败', icon: 'none' })
          }
          return
        }
        if (!data || !data.length) {
          wx.showToast({ title: '未找到可修改的车辆', icon: 'none' })
          return
        }
      } else {
        // 新增：按 (owner_id, plate) 唯一索引 upsert —— 同车牌则更新，不存在则插入
        const { error } = await cloud.database
          .from('vehicles')
          .upsert(payload, { onConflict: 'owner_id,plate' })
          .select()

        if (error) {
          wx.showToast({ title: '保存失败', icon: 'none' })
          return
        }
      }

      wx.showToast({ title: '已保存', icon: 'success' })
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
        title: '删除车辆',
        content: '删除后该车的加油充电记录仍会保留，确认删除？',
        confirmColor: '#e0245e',
        success: (res) => resolve(res.confirm),
        fail: () => resolve(false),
      })
    })
    if (!confirmed) return

    try {
      await requireSession()
      const { data } = await cloud.database
        .from('vehicles')
        .delete()
        .eq('id', Number(this.data.vehicleId))
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
