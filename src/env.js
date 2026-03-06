(function (window) {
  window.__env = window.__env || {};

  window.__env.logLevel = 3; // Warn

  // Get config from remote host?
  window.__env.configEndpoint = true;

  // Environment name
  window.__env.ENVIRONMENT = "local"; // local | dev | test | prod

  window.__env.GH_HASH = "sandbox-20260227170243";

  // Add any feature-toggles
  // window.__env.coolFeatureActive = false;
})(this);
