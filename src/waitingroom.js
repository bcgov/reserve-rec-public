/* BC Parks Waiting Room — standalone JavaScript */
/* Requires: waitingroom.html loaded, config served at /api/config */

(function () {
  'use strict';

  // ── State ────────────────────────────────────────────────────────────────
  let config = null;
  let queueId = null;
  let ws = null;
  let openingTime = null;
  let countdownInterval = null;
  let reconnectTimeout = null;
  let reconnectAttempts = 0;
  let wsToken = null;          // JWT cached for WebSocket reconnects
  let isAdmitted = false;
  let joinParams = null;
  let isMode2 = false;         // true when handling full-site Mode 2 queue

  const MAX_RECONNECT_DELAY_MS = 30000;

  // ── UI helpers ────────────────────────────────────────────────────────────
  const STATES = ['loading', 'preopen', 'randomizing', 'releasing', 'admitted', 'mode2', 'error'];

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

  // ── Token: read from Amplify v6 localStorage ─────────────────────────────
  // Amplify v6 stores tokens as:
  //   CognitoIdentityServiceProvider.{clientId}.LastAuthUser  → username
  //   CognitoIdentityServiceProvider.{clientId}.{username}.accessToken
  function getAmplifyToken(clientId) {
    var prefix = 'CognitoIdentityServiceProvider.' + clientId;
    var lastUser = localStorage.getItem(prefix + '.LastAuthUser');
    if (!lastUser || lastUser === 'username') return null;
    var token = localStorage.getItem(prefix + '.' + lastUser + '.accessToken') || null;
    if (!token) return null;
    // Check expiry by decoding the JWT payload (no signature verification needed here)
    try {
      var payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    } catch (e) { /* malformed token — let the server reject it */ }
    return token;
  }

  // ── Config ────────────────────────────────────────────────────────────────
  async function fetchConfig() {
    var resp = await fetch('/api/config?config=public');
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
    if (!params) return '';
    var parts = [params.collectionId, params.activityType].filter(Boolean);
    var label = parts.join(' / ');
    if (params.startDate) label += ' — ' + params.startDate;
    return label;
  }

  function getReturnUrl() {
    var p = new URLSearchParams(window.location.search);
    return p.get('returnUrl') || '/';
  }

  // ── Countdown ─────────────────────────────────────────────────────────────
  function updateCountdown() {
    if (!openingTime) return;
    var diff = openingTime - Date.now();
    if (diff <= 0) {
      clearInterval(countdownInterval);
      var el = document.getElementById('countdown-timer');
      if (el) el.textContent = '00:00:00';
      return;
    }
    var h = Math.floor(diff / 3600000);
    var m = Math.floor((diff % 3600000) / 60000);
    var s = Math.floor((diff % 60000) / 1000);
    var display = [h, m, s].map(function (n) { return String(n).padStart(2, '0'); }).join(':');
    var el = document.getElementById('countdown-timer');
    if (el) el.textContent = display;
  }

  // ── API calls ─────────────────────────────────────────────────────────────
  async function joinQueue(token, params) {
    var resp = await fetch('/api/waiting-room/join', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token,
      },
      body: JSON.stringify(params),
    });

    if (resp.status === 401 || resp.status === 403) {
      redirectToLogin();
      return null;
    }

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
      throw new Error((json && (json.msg || json.error)) || 'Failed to join queue');
    }
    return json.data;
  }

  async function claimAdmission(token, claimQueueId) {
    var resp = await fetch('/api/waiting-room/claim', {
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
  function connectWebSocket() {
    if (!queueId || !config.WS_URL) {
      console.warn('[WaitingRoom] Cannot connect WebSocket: missing queueId or WS_URL');
      return;
    }

    // Refresh token from localStorage on every connect attempt — Amplify auto-refreshes
    // access tokens there. This prevents expired-token rejections during long waits.
    var currentToken = getAmplifyToken(config.PUBLIC_USER_POOL_CLIENT_ID) || wsToken;
    if (!currentToken) {
      console.warn('[WaitingRoom] Cannot connect WebSocket: no valid token');
      window.location.href = '/login';
      return;
    }
    wsToken = currentToken;

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
      if (!isAdmitted) scheduleReconnect();
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
        if (ws) { ws.close(); ws = null; }
        handleAdmission();
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
      var result = await claimAdmission(wsToken, queueId);
      // Store non-sensitive admission context for the Angular SPA.
      // For Mode 2, facilityKey starts with 'MODE2' — the SPA guard accepts this as site access.
      // Claim handler returns fields directly (not wrapped in { data: ... })
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
      showError('Failed to claim your admission: ' + e.message);
    }
  }

  // ── Auth redirect ─────────────────────────────────────────────────────────
  // The Angular SPA handles Cognito login. Store the intended URL so it can
  // redirect back after authentication.
  function redirectToLogin() {
    sessionStorage.setItem('wr_return_url', window.location.href);
    window.location.href = '/';
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
      var token = getAmplifyToken(config.PUBLIC_USER_POOL_CLIENT_ID);
      if (!token) {
        redirectToLogin();
        return;
      }
      wsToken = token;

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
      var joinResult = await joinQueue(token, joinParams);
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
        // Mode 2 always shows mode2 state with position display
        showState('mode2');

      } else if (status === 'pre-open') {
        if (joinResult.openingTime) {
          openingTime = new Date(joinResult.openingTime).getTime();
          var openingDate = new Date(joinResult.openingTime);
          var otEl = document.getElementById('opening-time-display');
          if (otEl) {
            otEl.textContent = 'Opens at '
              + openingDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' });
          }
        }
        showState('preopen');
        updateCountdown();
        countdownInterval = setInterval(updateCountdown, 1000);

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
      connectWebSocket();

    } catch (e) {
      showError(e.message || 'An unexpected error occurred.');
    }
  }

  // ── Leave-page warning ────────────────────────────────────────────────────
  window.addEventListener('beforeunload', function (e) {
    if (!isAdmitted && queueId) {
      e.preventDefault();
      // Modern browsers show their own message, but we still set returnValue
      e.returnValue = 'Leaving this page will remove you from the waiting room. Are you sure?';
    }
  });

  // ── Bootstrap ─────────────────────────────────────────────────────────────
  window.addEventListener('load', init);

})();
