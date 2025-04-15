(function (window) {
  window.__env = window.__env || {};

  window.__env.logLevel = 0; // All

  // Get config from remote host?
  window.__env.configEndpoint = false;

  // Environment name
  window.__env.ENVIRONMENT = "local"; // local | dev | test | prod

  window.__env.API_LOCATION = "http://localhost:3000/";
  window.__env.API_PATH = "api";
  window.__env.GH_HASH = "local-build";


//PublicPool2
  window.__env.PUBLIC_USER_POOL_ID = "ca-central-1_3VK9jbezb";
  window.__env.PUBLIC_USER_POOL_CLIENT_ID = "6bae9a3cms44aseme02do57nkg";
  window.__env.PUBLIC_IDENTITY_POOL_ID = "ca-central-1:0821f46c-bfa0-4d0f-99f9-e2d246b620ec";
  window.__env.PUBLIC_USER_POOL_DOMAIN_URL = "ca-central-13vk9jbezb.auth.ca-central-1.amazoncognito.com";
  // window.__env.API_KEY = "api-key-here";

  // Add any feature-toggles
  // window.__env.coolFeatureActive = false;
})(this);
