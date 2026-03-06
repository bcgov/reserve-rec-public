'use strict';

/**
 * Lambda@Edge origin-request handler — /api/* behavior.
 *
 * Runs in us-east-1 on each booking API request before it reaches the origin.
 *
 * Responsibilities:
 *  1. Check for a bcparks-admission cookie on booking POST requests.
 *  2. If the cookie is present but structurally malformed (not base64url.hex) → 400.
 *  3. If the cookie is present and structurally valid → pass through.
 *     Full HMAC + expiry validation is performed by the origin booking Lambda (Phase 4).
 *  4. If no cookie → pass through.
 *     The origin booking Lambda enforces waiting-room admission when a queue is active.
 *
 * Future enhancement: add full HMAC validation here using the HMAC key ARN from the
 * 'x-wr-hmac-key-arn' custom origin header (currently passed but not used).
 */

const COOKIE_NAME = 'bcparks-admission';

// Base64url chars + dot separator + lowercase hex chars
const TOKEN_REGEX = /^[A-Za-z0-9_-]+\.[0-9a-f]{64}$/;

/**
 * Parse a raw Cookie header value into a key→value map.
 */
function parseCookies(cookieHeader) {
  if (!cookieHeader) return {};
  return cookieHeader.split(';').reduce((acc, pair) => {
    const idx = pair.indexOf('=');
    if (idx === -1) return acc;
    const k = pair.slice(0, idx).trim();
    const v = pair.slice(idx + 1).trim();
    if (k) acc[k] = v;
    return acc;
  }, {});
}

exports.handler = async (event) => {
  const request = event.Records[0].cf.request;

  // Only inspect booking-creation requests
  if (request.method !== 'POST' || !request.uri.includes('/bookings')) {
    return request;
  }

  // Parse admission cookie
  const rawCookie = (request.headers['cookie'] || [])[0]?.value || '';
  const cookies = parseCookies(rawCookie);
  const token = cookies[COOKIE_NAME];

  // If a token is present but structurally invalid → reject at edge (no origin call)
  if (token && !TOKEN_REGEX.test(token)) {
    return {
      status: '400',
      statusDescription: 'Bad Request',
      headers: {
        'content-type': [{ key: 'Content-Type', value: 'application/json' }],
        'cache-control': [{ key: 'Cache-Control', value: 'no-cache, no-store' }],
      },
      body: JSON.stringify({ error: 'Malformed admission token', code: 'INVALID_TOKEN' }),
    };
  }

  // Pass through — origin handles HMAC validation and waiting-room enforcement
  return request;
};
