// No-op stub for react-native-onesignal.
// The real native functionality is provided by the onesignal-expo-plugin
// at build time via the compiled ObjC/Java native module.
// This JS stub prevents TurboModuleRegistry crashes on web.

let OneSignal;
(function (_OneSignal) {
  _OneSignal.initialize = function() {};
  _OneSignal.login = function() {};
  _OneSignal.logout = function() {};
  _OneSignal.setConsentRequired = function() {};
  _OneSignal.setConsentGiven = function() {};

  const Debug = _OneSignal.Debug = {};
  Debug.setLogLevel = function() {};
  Debug.setAlertLevel = function() {};

  const User = _OneSignal.User = {};
  User.addTag = function() {};
  User.addTags = function() {};
  User.removeTag = function() {};
  User.removeTags = function() {};
  User.getTags = async function() { return {}; };
  User.addEmail = function() {};
  User.removeEmail = function() {};
  User.addAlias = function() {};
  User.removeAlias = function() {};
  User.setLanguage = function() {};
  User.addEventListener = function() {};
  User.removeEventListener = function() {};
  const pushSubscription = User.pushSubscription = {};
  pushSubscription.addEventListener = function() {};
  pushSubscription.removeEventListener = function() {};
  pushSubscription.getIdAsync = async function() { return null; };
  pushSubscription.getTokenAsync = async function() { return null; };
  pushSubscription.getOptedInAsync = async function() { return false; };
  pushSubscription.optIn = function() {};
  pushSubscription.optOut = function() {};

  const Notifications = _OneSignal.Notifications = {};
  Notifications.hasPermission = false;
  Notifications.getPermissionAsync = async function() { return false; };
  Notifications.requestPermission = async function() { return false; };
  Notifications.canRequestPermission = async function() { return false; };
  Notifications.addEventListener = function() {};
  Notifications.removeEventListener = function() {};
  Notifications.clearAll = function() {};

  const InAppMessages = _OneSignal.InAppMessages = {};
  InAppMessages.addEventListener = function() {};
  InAppMessages.removeEventListener = function() {};
  InAppMessages.addTrigger = function() {};
  InAppMessages.removeTrigger = function() {};
  InAppMessages.setPaused = function() {};
  InAppMessages.getPaused = async function() { return false; };

  const Location = _OneSignal.Location = {};
  Location.requestPermission = function() {};
  Location.setShared = function() {};

  const Session = _OneSignal.Session = {};
  Session.addOutcome = function() {};
  Session.addUniqueOutcome = function() {};
  Session.addOutcomeWithValue = function() {};
})(OneSignal || (OneSignal = {}));

module.exports = { OneSignal: OneSignal };
module.exports.default = OneSignal;
