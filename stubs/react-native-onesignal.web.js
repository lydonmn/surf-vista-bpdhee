// Web stub for react-native-onesignal
// OneSignal is not supported on web — all methods are no-ops
const OneSignal = {
  initialize: () => {},
  Notifications: {
    requestPermission: async () => false,
    addEventListener: () => {},
    removeEventListener: () => {},
  },
  User: {
    addTag: () => {},
    removeTag: () => {},
    addTags: () => {},
  },
  login: () => {},
  logout: () => {},
};

module.exports = { OneSignal };
