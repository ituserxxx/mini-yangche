const { cloud } = require('../../utils/cloud')
const { requireSession } = require('../../utils/auth')

const TYPE_TABS = [
  { value: 'suggestion', label: '建议', desc: '功能 / 体验', icon: '💡', bg: '#eef4ff' },
  { value: 'bug', label: '问题', desc: '报错 / 异常', icon: '🐞', bg: '#fdeef0' },
  { value: 'other', label: '其他', desc: '吐槽 / 闲聊', icon: '💬', bg: '#eafaf1' },
]

function typeMetaOf(type) {
  const hit = TYPE_TABS.find((item) => item.value === type)
  return hit || TYPE_TABS[0]
}

Page({
  data: {
    typeTabs: TYPE_TABS,
    feedbackType: 'suggestion',
    typeName: TYPE_TABS[0].label,
    typeIcon: TYPE_TABS[0].icon,
    content: '',
    contact: '',
    focusKey: '',
    submitting: false,
  },

  onTypeSelect(event) {
    const { value } = event.currentTarget.dataset
    if (this.data.feedbackType === value) return
    const meta = typeMetaOf(value)
    this.setData({
      feedbackType: value,
      typeName: meta.label,
      typeIcon: meta.icon,
    })
    wx.vibrateShort({ type: 'light', fail: () => {} })
  },

  onInput(event) {
    const { key } = event.currentTarget.dataset
    this.setData({ [key]: event.detail.value })
  },

  onFocus(event) {
    this.setData({ focusKey: event.currentTarget.dataset.key || '' })
  },

  onBlur() {
    this.setData({ focusKey: '' })
  },

  async onSubmit() {
    if (this.data.submitting) return

    const content = this.data.content.trim()
    if (!content) {
      wx.showToast({ title: '请填写反馈内容', icon: 'none' })
      return
    }

    this.setData({ submitting: true })
    try {
      await requireSession()
      const { error } = await cloud.database
        .from('feedback')
        .insert({
          type: this.data.feedbackType,
          content,
          contact: this.data.contact.trim(),
        })
        .select()

      if (error) {
        wx.showToast({ title: '提交失败，请重试', icon: 'none' })
        return
      }

      wx.showToast({ title: '感谢反馈', icon: 'success' })
      setTimeout(() => wx.navigateBack(), 600)
    } catch (error) {
      wx.showToast({ title: '提交失败，请重试', icon: 'none' })
    } finally {
      this.setData({ submitting: false })
    }
  },
})
