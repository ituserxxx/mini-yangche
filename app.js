App({
  globalData: {
    vehicles: [],
    lastVehicleId: null,
  },

  onLaunch() {
    const last = wx.getStorageSync('lastVehicleId')
    if (last) {
      this.globalData.lastVehicleId = last
    }
  },

  setLastVehicleId(vehicleId) {
    this.globalData.lastVehicleId = vehicleId
    if (vehicleId) {
      wx.setStorageSync('lastVehicleId', vehicleId)
    }
  },
})
