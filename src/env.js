(function (window) {
  window.__env = window.__env || {};

  window.__env.logLevel = 0; // All

  // Get config from remote host?
  window.__env.configEndpoint = false;

  // Environment name
  window.__env.ENVIRONMENT = "local"; // local | dev | test | prod

  window.__env.API_LOCATION = "http://localhost:3000/";
  // window.__env.API_LOCATION = "https://o5t24hjhbd.execute-api.ca-central-1.amazonaws.com/";
  // window.__env.API_PATH = "api";
  window.__env.GH_HASH = "local-build";
//PublicPool2
  window.__env.PUBLIC_USER_POOL_ID = "ca-central-1_WILrEy2Vr";
  window.__env.PUBLIC_USER_POOL_CLIENT_ID = "3tampra6clvuk29akiarvgelhp";
  window.__env.PUBLIC_IDENTITY_POOL_ID = "ca-central-1:1e521803-6fe1-4fb6-b749-d4ac1c8f6389";
  window.__env.PUBLIC_USER_POOL_DOMAIN_URL = "reserve-rec-public-identity-dev.auth.ca-central-1.amazoncognito.com";
  window.__env.CONFIG_URL = 'https://dr9u9b754tjck.cloudfront.net'; // If null, will defer to host url. If defined, will look for config at this url.

  // Add any feature-toggles
  // window.__env.coolFeatureActive = false;
})(this);
