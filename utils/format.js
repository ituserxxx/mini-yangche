const ENERGY_LABEL = {
  fuel: '加油',
  charge: '充电',
  hybrid: '混动',
}

const QUANTITY_UNIT = {
  fuel: 'L',
  charge: 'kWh',
}

function typeLabel(type) {
  return ENERGY_LABEL[type] || '加油'
}

function quantityUnit(type) {
  return QUANTITY_UNIT[type] || 'L'
}

function money(value) {
  const num = Number(value)
  if (!isFinite(num)) return '0.00'
  return num.toFixed(2)
}

function amountLabel(value) {
  return '¥' + money(value)
}

function quantityLabel(value, type) {
  const num = Number(value)
  if (!isFinite(num) || num <= 0) return '—'
  return num.toFixed(2) + ' ' + quantityUnit(type)
}

function pad2(n) {
  return n < 10 ? '0' + n : String(n)
}

function dateText(input) {
  const d = input ? new Date(input) : new Date()
  if (isNaN(d.getTime())) return ''
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate())
}

function monthText(input) {
  const d = input ? new Date(input) : new Date()
  if (isNaN(d.getTime())) return ''
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1)
}

function todayInputValue() {
  return dateText(new Date())
}

function toInputDate(value) {
  const d = value ? new Date(value) : new Date()
  if (isNaN(d.getTime())) return todayInputValue()
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) +
    'T' + pad2(d.getHours()) + ':' + pad2(d.getMinutes())
}

function fromInputDate(value) {
  if (!value) return new Date().toISOString()
  const d = new Date(value)
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString()
}

// 单价：缺省时用金额 / 数量推导
function unitPrice(amount, quantity) {
  const a = Number(amount)
  const q = Number(quantity)
  if (!isFinite(a) || !isFinite(q) || q <= 0) return null
  return a / q
}

module.exports = {
  typeLabel,
  quantityUnit,
  money,
  amountLabel,
  quantityLabel,
  dateText,
  monthText,
  todayInputValue,
  toInputDate,
  fromInputDate,
  unitPrice,
}
