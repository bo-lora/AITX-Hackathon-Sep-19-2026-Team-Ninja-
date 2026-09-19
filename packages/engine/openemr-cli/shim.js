// Top-level shim: OpenEMR pages expect to live inside main.php (tabs), whose single-use token cannot be reused from a saved
// session. Pages call top.restoreSession(), top.left_nav.*, etc.; when loaded top-level, top === window, so provide no-op stubs.
(function () {
  if (window.top !== window) return;
  var noop = function () { return true; };
  var stubObj = function () { return new Proxy({}, { get: function (t, k) { return k in t ? t[k] : noop; }, set: function (t, k, v) { t[k] = v; return true; } }); };
  window.__name = window.__name || function (f) { return f; };
  if (!window.restoreSession) window.restoreSession = noop;
  window.left_nav = window.left_nav || stubObj();
  ['navigateTab', 'activateTabByName', 'setPatient', 'setEncounter', 'loadFrame', 'tabCloseByName', 'clearPatient', 'clearEncounter', 'refreshme', 'RTop'].forEach(function (n) { if (!(n in window)) window[n] = noop; });
  // used by the 8.4 insurance screen (library/js/oeUI/insurance/*.js via window.top.*)
  window.jsGlobals = window.jsGlobals || { assetVersion: '82' };
  if (!window.xl) window.xl = function (s) { return s; };
  var ymd = function (v) { if (v === null || v === undefined || v === '') return ''; if (v instanceof Date) { if (isNaN(v)) return ''; var p = function (n) { return String(n).padStart(2, '0'); }; return v.getFullYear() + '-' + p(v.getMonth() + 1) + '-' + p(v.getDate()); } return String(v).slice(0, 10); };
  window.oeFormatters = window.oeFormatters || { I18NDateFormat: ymd, DateFormatRead: function () { return 'Y-m-d'; } };
  window.app_view_model = window.app_view_model || stubObj();
})();
