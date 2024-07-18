(function (window) {
    window.__env = window.__env || {};

    window.__env.logLevel = 0; // All

    // Get config from remote host?
    window.__env.configEndpoint = false;

    // Environment name
    window.__env.ENVIRONMENT = "local"; // local | dev | test | prod

    window.__env.API_LOCATION = "http://localhost:3000";
    window.__env.API_PATH = "/api";
    window.__env.GH_HASH = "local-build";

    // Add any feature-toggles
    // window.__env.coolFeatureActive = false;
})(this);
