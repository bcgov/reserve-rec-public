/* BC Parks Waiting Room — standalone JavaScript */
/* Requires: waitingroom.html loaded, config served at /api/config */

(function () {
  'use strict';

  // Derived from this page's own path so it works at the domain root and under /dayuse/.
  var APP_BASE = window.location.pathname.replace(/waitingroom\.html$/, '');

  // ── State ────────────────────────────────────────────────────────────────
  let config = null;
  let queueId = null;
  let ws = null;
  let countdownInterval = null;
  let tokenCheckInterval = null;
  let refreshPromise = null;   // single in-flight token refresh
  let reconnectTimeout = null;
  let reconnectAttempts = 0;
  let wsToken = null;          // JWT cached for WebSocket reconnects
  let isAdmitted = false;
  let isQueueClosed = false;   // suppresses reconnect after server pushes 'queueClosed'
  let waitEnded = false;       // sign-in expired: no reconnects, no leave warning
  let joinParams = null;
  let isMode2 = false;         // true when handling full-site Mode 2 queue

  const MAX_RECONNECT_DELAY_MS = 30000;
  const MAX_JOIN_RETRY_DELAY_MS = 30000;
  const TOKEN_REFRESH_MARGIN_MS = 2 * 60 * 1000;
  const TOKEN_CHECK_INTERVAL_MS = 60 * 1000;

  // ── UI helpers ────────────────────────────────────────────────────────────
  const STATES = ['loading', 'preopen', 'randomizing', 'releasing', 'admitted', 'mode2', 'notice', 'error'];

  function showState(name) {
    STATES.forEach(function (s) {
      var el = document.getElementById('state-' + s);
      if (el) el.classList.toggle('d-none', s !== name);
    });
  }

  function showError(msg) {
    var el = document.getElementById('error-message');
    if (el) el.textContent = msg || 'An unexpected error occurred.';
    showState('error');
    console.error('[WaitingRoom]', msg);
  }

  // Card for a refusal the visitor can act on; link is optional ({ text, href }).
  function showNotice(title, message, link) {
    setText('notice-title', title);
    setText('notice-message', message);
    var a = document.getElementById('notice-link');
    if (a) {
      a.classList.toggle('d-none', !link);
      if (link) {
        a.textContent = link.text;
        a.href = link.href;
      }
    }
    showState('notice');
  }

  function stopWaiting() {
    waitEnded = true;
    clearInterval(countdownInterval);
    clearInterval(tokenCheckInterval);
    clearTimeout(reconnectTimeout);
    if (ws) { ws.close(); ws = null; }
  }

  function showSessionExpired() {
    stopWaiting();
    saveReturnUrl();
    showNotice('Sign-in expired', 'Your sign-in has expired. Sign in again to rejoin the queue.',
      { text: 'Sign in', href: APP_BASE + 'login?reason=waiting-room' });
  }

  // Keys: CognitoIdentityServiceProvider.{clientId}.LastAuthUser, then .{user}.accessToken.
  // This page does not run Amplify, so it refreshes tokens itself and writes them back.
  function amplifyKeyPrefix(clientId) {
    var prefix = 'CognitoIdentityServiceProvider.' + clientId;
    var lastUser = localStorage.getItem(prefix + '.LastAuthUser');
    if (!lastUser || lastUser === 'username') return null;
    return prefix + '.' + lastUser;
  }

  // Expiry in ms from the JWT payload, or null when unreadable (no signature check needed).
  function tokenExpiryMs(token) {
    try {
      var payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      return payload.exp ? payload.exp * 1000 : null;
    } catch (e) {
      return null;
    }
  }

  function getAmplifyToken(clientId) {
    var keyPrefix = amplifyKeyPrefix(clientId);
    if (!keyPrefix) return null;
    var token = localStorage.getItem(keyPrefix + '.accessToken') || null;
    if (!token) return null;
    // A malformed token is left for the server to reject
    var exp = tokenExpiryMs(token);
    if (exp !== null && exp < Date.now()) return null;
    return token;
  }

  function getAmplifyIdToken(clientId) {
    var keyPrefix = amplifyKeyPrefix(clientId);
    return (keyPrefix && localStorage.getItem(keyPrefix + '.idToken')) || null;
  }

  function sessionExpiredError() {
    var e = new Error('Sign-in expired');
    e.sessionExpired = true;
    return e;
  }

  // Cognito refresh-token call for a public client (no secret). A 4xx means the
  // refresh token is expired or revoked; anything else is transient.
  async function refreshTokens() {
    var clientId = config.PUBLIC_USER_POOL_CLIENT_ID;
    var keyPrefix = amplifyKeyPrefix(clientId);
    var refreshToken = keyPrefix && localStorage.getItem(keyPrefix + '.refreshToken');
    if (!refreshToken) throw sessionExpiredError();

    var poolId = config.PUBLIC_USER_POOL_ID || '';
    var region = poolId.split('_')[0] || 'ca-central-1';
    // The region becomes part of the host the refresh token is sent to.
    if (!/^[a-z]{2}(-[a-z]+)+-\d$/.test(region)) {
      console.error('[WaitingRoom] Refusing token refresh: invalid region in config');
      throw new Error('Token refresh unavailable');
    }
    var resp = await fetch('https://cognito-idp.' + region + '.amazonaws.com/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-amz-json-1.1',
        'X-Amz-Target': 'AWSCognitoIdentityProviderService.InitiateAuth',
      },
      body: JSON.stringify({
        AuthFlow: 'REFRESH_TOKEN_AUTH',
        ClientId: clientId,
        AuthParameters: { REFRESH_TOKEN: refreshToken },
      }),
    });
    if (resp.status >= 400 && resp.status < 500) throw sessionExpiredError();
    if (!resp.ok) throw new Error('Token refresh failed (HTTP ' + resp.status + ')');

    var result = (await resp.json()).AuthenticationResult || {};
    if (!result.AccessToken) throw new Error('Token refresh returned no access token');
    localStorage.setItem(keyPrefix + '.accessToken', result.AccessToken);
    if (result.IdToken) localStorage.setItem(keyPrefix + '.idToken', result.IdToken);
    wsToken = result.AccessToken;
    return wsToken;
  }

  // Resolves a token with more than the refresh margin left, refreshing if needed.
  // Rejects with sessionExpired when the refresh token is rejected.
  function ensureFreshToken(force) {
    var token = getAmplifyToken(config.PUBLIC_USER_POOL_CLIENT_ID);
    var exp = token && tokenExpiryMs(token);
    if (!force && token && (exp === null || exp - Date.now() > TOKEN_REFRESH_MARGIN_MS)) {
      wsToken = token;
      return Promise.resolve(token);
    }
    if (!refreshPromise) {
      refreshPromise = refreshTokens().finally(function () { refreshPromise = null; });
    }
    return refreshPromise;
  }

  function startTokenCheck() {
    tokenCheckInterval = setInterval(function () {
      if (isAdmitted || waitEnded) return;
      ensureFreshToken().catch(function (e) {
        if (e.sessionExpired) showSessionExpired();
        else console.warn('[WaitingRoom] Token refresh failed, will retry', e.message);
      });
    }, TOKEN_CHECK_INTERVAL_MS);
  }

  // ── Config ────────────────────────────────────────────────────────────────
  async function fetchConfig() {
    var resp = await fetch(APP_BASE + 'api/config?config=public');
    if (!resp.ok) throw new Error('Failed to fetch config (HTTP ' + resp.status + ')');
    var json = await resp.json();
    if (!json.data) throw new Error('Config response missing data');
    return json.data;
  }

  // ── URL params (set by Angular SPA on redirect) ───────────────────────────
  // Expected: ?collectionId=...&activityType=...&activityId=...&startDate=...&returnUrl=...
  function getJoinParams() {
    var p = new URLSearchParams(window.location.search);
    return {
      collectionId: p.get('collectionId'),
      activityType: p.get('activityType'),
      activityId:   p.get('activityId') ? parseInt(p.get('activityId'), 10) : null,
      startDate:    p.get('startDate'),
    };
  }

  // Returns join params for the Mode 2 site-wide queue
  function getMode2JoinParams() {
    var today = new Date().toISOString().slice(0, 10);
    return {
      collectionId: 'MODE2',
      activityType: 'global',
      activityId:   1,
      startDate:    today,
    };
  }

  function getFacilityDisplay(params) {
    var p = new URLSearchParams(window.location.search);
    var facilityName = p.get('facilityName');
    if (facilityName) return facilityName;
    return '';
  }

  // Resolve like the browser (so '/\evil.com' is caught) and accept only same-origin paths
  // under APP_BASE; the SPA's bare '/checkout' is re-prefixed.
  function resolveAppPath(raw) {
    function sameApp(candidate) {
      try {
        var url = new URL(candidate, window.location.origin + APP_BASE);
        if (url.origin !== window.location.origin || url.pathname.indexOf(APP_BASE) !== 0) return null;
        return url.pathname + url.search + url.hash;
      } catch (e) {
        return null;
      }
    }
    if (!raw) return null;
    return sameApp(raw)
      || (/^\/[^\/\\%]/.test(raw) ? sameApp(APP_BASE + raw.slice(1)) : null);
  }

  function getReturnUrl() {
    var p = new URLSearchParams(window.location.search);
    return resolveAppPath(p.get('returnUrl')) || APP_BASE;
  }

  // ── Countdown ─────────────────────────────────────────────────────────────
  function setText(id, text) {
    var el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function formatRemaining(diff) {
    var h = Math.floor(diff / 3600000);
    var m = Math.floor((diff % 3600000) / 60000);
    var s = Math.floor((diff % 60000) / 1000);
    return [h, m, s].map(function (n) { return String(n).padStart(2, '0'); }).join(':');
  }

  function formatOpensAt(date) {
    return 'Opens at '
      + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' });
  }

  // Ticks once now, then every second; onZero runs once when the target passes.
  function startCountdown(targetMs, timerId, onZero) {
    function tick() {
      var diff = targetMs - Date.now();
      if (diff <= 0) {
        clearInterval(countdownInterval);
        setText(timerId, '00:00:00');
        if (onZero) onZero();
        return;
      }
      setText(timerId, formatRemaining(diff));
    }
    tick();
    countdownInterval = setInterval(tick, 1000);
  }

  // Mode 2 card: countdown block, or the position block once positions exist.
  function showMode2Countdown(show) {
    document.getElementById('mode2-countdown-block').classList.toggle('d-none', !show);
    document.getElementById('mode2-position-block').classList.toggle('d-none', show);
  }

  function startMode2Countdown(firstReleaseAt) {
    var target = new Date(firstReleaseAt);
    if (isNaN(target) || target.getTime() <= Date.now()) return;
    setText('mode2-opening-time-display', formatOpensAt(target));
    showMode2Countdown(true);
    startCountdown(target.getTime(), 'mode2-countdown-timer', function () {
      document.getElementById('mode2-countdown-live').classList.add('d-none');
      document.getElementById('mode2-opening-now').classList.remove('d-none');
    });
  }

  // ── API calls ─────────────────────────────────────────────────────────────
  function errorCodeOf(json) {
    return (json && (json.errorCode || json.error)) || null;
  }

  // The API checks the account against the ID token, sent alongside the access token.
  async function joinQueue(token, params) {
    var idToken = getAmplifyIdToken(config.PUBLIC_USER_POOL_CLIENT_ID);
    if (!idToken) {
      redirectToLogin();
      return null;
    }
    var resp = await fetch(APP_BASE + 'api/waiting-room/join', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token,
        'X-Id-Token': idToken,
      },
      body: JSON.stringify(params),
    });

    // Only a 401 means "not signed in"; 403 carries a refusal reason below.
    if (resp.status === 401) {
      var body401 = await resp.json().catch(function () { return null; });
      if (errorCodeOf(body401) === 'ID_TOKEN_INVALID') return { idTokenInvalid: true };
      redirectToLogin();
      return null;
    }

    // Transient failure (e.g. the account check is unavailable): caller retries.
    if (resp.status === 503) return { retry: true };

    // Queue is closed — no waiting room needed, proceed directly to booking
    if (resp.status === 410) {
      return { queueClosed: true };
    }

    // CloudFront custom error pages convert 403/404 from API Gateway to 200 + index.html.
    // Detect this by checking Content-Type before parsing JSON.
    var ct = resp.headers.get('content-type') || '';
    if (ct.includes('text/html')) {
      redirectToLogin();
      return null;
    }

    var json = await resp.json();
    if (!resp.ok) {
      var err = new Error((json && (json.msg || json.error)) || 'Failed to join queue');
      err.errorCode = errorCodeOf(json);
      throw err;
    }
    return json.data;
  }

  // Backoff of 2s, 4s, 8s ... capped at 30s, with up to half the delay shaved off as jitter.
  function joinRetryDelayMs(attempt) {
    var base = Math.min(2000 * Math.pow(2, attempt), MAX_JOIN_RETRY_DELAY_MS);
    return base / 2 + Math.random() * base / 2;
  }

  // Keeps retrying while the page is open; refreshes the token before every attempt.
  // A rejected ID token gets one forced refresh and one retry, then counts as signed out.
  async function joinWithRetry(params) {
    var idTokenRefreshed = false;
    for (var attempt = 0; ; attempt++) {
      var token = await ensureFreshToken();
      var result = await joinQueue(token, params);
      if (result && result.idTokenInvalid) {
        if (idTokenRefreshed) throw sessionExpiredError();
        idTokenRefreshed = true;
        await ensureFreshToken(true);
        attempt--;
        continue;
      }
      if (!result || !result.retry) return result;
      setText('loading-message', 'Busy, retrying…');
      await new Promise(function (resolve) { setTimeout(resolve, joinRetryDelayMs(attempt)); });
    }
  }

  async function claimAdmission(token, claimQueueId) {
    var resp = await fetch(APP_BASE + 'api/waiting-room/claim', {
      method: 'POST',
      credentials: 'include',   // Needed to receive the HttpOnly Set-Cookie
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token,
      },
      body: JSON.stringify({ queueId: claimQueueId }),
    });

    var json = await resp.json().catch(function () { return {}; });
    if (!resp.ok) {
      throw new Error((json && (json.msg || json.error)) || 'Claim failed (HTTP ' + resp.status + ')');
    }
    return json;
  }

  // ── WebSocket ─────────────────────────────────────────────────────────────
  async function connectWebSocket() {
    if (!queueId || !config.WS_URL) {
      console.warn('[WaitingRoom] Cannot connect WebSocket: missing queueId or WS_URL');
      return;
    }

    // A reconnect after a long wait finds an expired access token; refresh it first.
    try {
      await ensureFreshToken();
    } catch (e) {
      if (e.sessionExpired) {
        showSessionExpired();
      } else {
        console.warn('[WaitingRoom] Token refresh failed before connect', e.message);
        if (!isAdmitted && !isQueueClosed && !waitEnded) scheduleReconnect();
      }
      return;
    }
    if (isAdmitted || isQueueClosed || waitEnded) return;

    var url = config.WS_URL
      + '?token=' + encodeURIComponent(wsToken)
      + '&queueId=' + encodeURIComponent(queueId);

    console.debug('[WaitingRoom] Connecting WebSocket…');
    ws = new WebSocket(url);

    ws.onopen = function () {
      console.debug('[WaitingRoom] WebSocket connected');
      reconnectAttempts = 0;
    };

    ws.onmessage = function (event) {
      try {
        var msg = JSON.parse(event.data);
        handleWsMessage(msg);
      } catch (e) {
        // Ignore malformed messages
      }
    };

    ws.onclose = function (event) {
      console.debug('[WaitingRoom] WebSocket closed', event.code);
      if (!isAdmitted && !isQueueClosed && !waitEnded) scheduleReconnect();
    };

    ws.onerror = function () {
      // onclose fires after onerror; reconnect is handled there
    };
  }

  function scheduleReconnect() {
    if (reconnectTimeout) return;
    var delay = Math.min(1000 * Math.pow(2, reconnectAttempts), MAX_RECONNECT_DELAY_MS);
    reconnectAttempts++;
    console.debug('[WaitingRoom] Reconnecting in', delay, 'ms (attempt', reconnectAttempts, ')');
    reconnectTimeout = setTimeout(function () {
      reconnectTimeout = null;
      connectWebSocket();
    }, delay);
  }

  // ── WebSocket message handlers ────────────────────────────────────────────
  function handleWsMessage(msg) {
    console.debug('[WaitingRoom] WS message:', msg);
    switch (msg.type) {
      case 'position':
        if (isMode2) {
          clearInterval(countdownInterval);
          showMode2Countdown(false);
          updateMode2PositionDisplay(msg.position, msg.total);
        } else {
          if (msg.queueStatus === 'releasing' || msg.queueStatus === 'randomizing') {
            showState(msg.queueStatus === 'randomizing' ? 'randomizing' : 'releasing');
          }
          updatePositionDisplay(msg.position, msg.total);
        }
        break;

      case 'queueStatus':
        if (!isMode2) {
          if (msg.status === 'randomizing') showState('randomizing');
          else if (msg.status === 'releasing') showState('releasing');
          else if (msg.status === 'pre-open') showState('preopen');
        }
        break;

      case 'admitted':
        isAdmitted = true;
        clearInterval(tokenCheckInterval);
        if (ws) { ws.close(); ws = null; }
        handleAdmission();
        break;

      case 'queueClosed':
        // Admin force-closed the queue: stop reconnecting and go on to booking.
        isQueueClosed = true;
        if (ws) { ws.close(); ws = null; }
        if (!isMode2) sessionStorage.setItem('wr_bypass_guard', '1');
        window.location.href = getReturnUrl();
        break;

      default:
        break;
    }
  }

  function updatePositionDisplay(position, total) {
    var posEl = document.getElementById('position-number');
    var totalEl = document.getElementById('position-of-total');
    var bar = document.getElementById('progress-bar');

    if (posEl) posEl.textContent = '#' + position;
    if (totalEl) totalEl.textContent = 'of ' + total + ' people';
    if (bar && total > 0) {
      var pct = Math.max(0, Math.min(100, ((total - position) / total) * 100));
      bar.style.width = pct + '%';
      bar.setAttribute('aria-valuenow', Math.round(pct));
    }
  }

  function updateMode2PositionDisplay(position, total) {
    var posEl = document.getElementById('mode2-position-number');
    var totalEl = document.getElementById('mode2-position-total');
    var bar = document.getElementById('mode2-progress-bar');

    if (posEl) posEl.textContent = '#' + position;
    if (totalEl) totalEl.textContent = 'of ' + total + ' people';
    if (bar && total > 0) {
      var pct = Math.max(0, Math.min(100, ((total - position) / total) * 100));
      bar.style.width = pct + '%';
      bar.setAttribute('aria-valuenow', Math.round(pct));
    }
  }

  // ── Admission flow ────────────────────────────────────────────────────────
  async function handleAdmission() {
    showState('admitted');
    try {
      var result = await claimAdmission(await ensureFreshToken(), queueId);
      // Non-sensitive admission context for the SPA; a 'MODE2' facilityKey counts as site access.
      if (result && result.facilityKey) {
        sessionStorage.setItem('wr_admission', JSON.stringify({
          facilityKey:  result.facilityKey,
          dateKey:      result.dateKey,
          tokenExpiry:  result.tokenExpiry,
          admittedAt:   result.admittedAt,
        }));
      }
      // Redirect to the Angular SPA booking flow (or home for Mode 2)
      window.location.href = getReturnUrl();
    } catch (e) {
      if (e.sessionExpired) showSessionExpired();
      else showError('Failed to claim your admission: ' + e.message);
    }
  }

  // ── Auth redirect ─────────────────────────────────────────────────────────
  // The SPA restores returnUrl via router.navigateByUrl, so prefer the SPA path over this page's URL.
  function saveReturnUrl() {
    var p = new URLSearchParams(window.location.search);
    var raw = p.get('returnUrl');
    sessionStorage.setItem('returnUrl', resolveAppPath(raw) ? raw : window.location.href);
  }

  function redirectToLogin() {
    // The SPA guard normally routes here already; this is the fallback for
    // direct hits on the standalone waiting room page without a valid token.
    saveReturnUrl();
    window.location.href = APP_BASE + 'login?reason=waiting-room';
  }

  // ── Init ──────────────────────────────────────────────────────────────────
  async function init() {
    showState('loading');

    try {
      // Step 1 — Fetch config (no auth required)
      var loadMsg = document.getElementById('loading-message');
      if (loadMsg) loadMsg.textContent = 'Loading configuration…';
      config = await fetchConfig();

      // Step 2 — Get JWT from Amplify localStorage
      try {
        await ensureFreshToken();
      } catch (e) {
        if (!e.sessionExpired) throw e;
        redirectToLogin();
        return;
      }

      // Step 3 — Parse queue params from URL
      joinParams = getJoinParams();
      if (!joinParams.collectionId || !joinParams.startDate) {
        // Mode 2: no booking params — join the global site-access queue
        isMode2 = true;
        joinParams = getMode2JoinParams();
      }

      if (!isMode2) {
        // Populate facility name in UI states that show it
        var facilityDisplay = getFacilityDisplay(joinParams);
        ['facility-name', 'facility-name-releasing'].forEach(function (id) {
          var el = document.getElementById(id);
          if (el) el.textContent = facilityDisplay;
        });
      }

      // Step 4 — Join the queue
      if (loadMsg) loadMsg.textContent = 'Joining the waiting room…';
      var joinResult = await joinWithRetry(joinParams);
      if (!joinResult) return;   // redirected to login

      // Queue already closed — no waiting room needed
      if (joinResult.queueClosed) {
        if (!isMode2) sessionStorage.setItem('wr_bypass_guard', '1');
        // Clear waitingRoomActive from cart items so the guard doesn't fire again
        try {
          var cartItems = JSON.parse(localStorage.getItem('bcparks-cart') || '[]');
          var updated = cartItems.map(function(item) { return Object.assign({}, item, { waitingRoomActive: false }); });
          localStorage.setItem('bcparks-cart', JSON.stringify(updated));
        } catch (e) { /* ignore */ }
        window.location.href = getReturnUrl();
        return;
      }

      queueId = joinResult.queueId;

      // If already admitted (e.g., page reload after admission but before claim),
      // go straight to claim — no need to show queue UI or open WebSocket.
      if (joinResult.status === 'admitted') {
        isAdmitted = true; // suppress beforeunload dialog during redirect
        await handleAdmission();
        return;
      }

      // Step 5 — Show initial UI state based on queue status
      var status = joinResult.queueStatus;

      if (isMode2) {
        showState('mode2');
        if (joinResult.firstReleaseAt) startMode2Countdown(joinResult.firstReleaseAt);

      } else if (status === 'pre-open') {
        var openingTime = null;
        if (joinResult.openingTime) {
          openingTime = new Date(joinResult.openingTime);
          setText('opening-time-display', formatOpensAt(openingTime));
        }
        showState('preopen');
        if (openingTime) startCountdown(openingTime.getTime(), 'countdown-timer');

      } else if (status === 'randomizing') {
        showState('randomizing');

      } else if (status === 'releasing') {
        showState('releasing');

      } else if (status === 'closed') {
        // Queue is done — proceed to booking directly
        sessionStorage.setItem('wr_bypass_guard', '1');
        window.location.href = getReturnUrl();
        return;
      } else {
        showState('preopen'); // fallback
      }

      // Step 6 — Open WebSocket for push updates
      startTokenCheck();
      connectWebSocket();

    } catch (e) {
      if (e.sessionExpired) showSessionExpired();
      else if (e.errorCode === 'EMAIL_UNVERIFIED') {
        showNotice('Verify your email address', 'Verify your email address to join the waiting room.',
          { text: 'Go to account settings', href: APP_BASE + 'account-details' });
      } else showError(e.message || 'An unexpected error occurred.');
    }
  }

  // ── Leave-page warning ────────────────────────────────────────────────────
  window.addEventListener('beforeunload', function (e) {
    if (!isAdmitted && !waitEnded && queueId) {
      e.preventDefault();
      // Modern browsers show their own message, but we still set returnValue
      e.returnValue = 'Leaving this page will remove you from the waiting room. Are you sure?';
    }
  });

  // ── Bootstrap ─────────────────────────────────────────────────────────────
  window.addEventListener('load', init);

})();
