# QR Print Security Documentation

## Overview
This document outlines the security measures implemented in the QR code print functionality to prevent XSS and other injection attacks.

## Security Measures Implemented

### 1. Data URI Validation (`isValidQRCodeDataUrl`)
**Location:** `qr-print.service.ts`

**Protection Against:** Malicious data URIs, JavaScript injection, non-image content

**Implementation:**
- ✅ Only allows `data:image/png;base64,` format
- ✅ Validates base64 character set (A-Z, a-z, 0-9, +, /, =)
- ✅ Enforces maximum size limit (140KB base64 ≈ 100KB image)
- ✅ Rejects all other protocols (http://, javascript:, etc.)

**Example Attacks Prevented:**
```javascript
// ❌ Rejected - JavaScript URI
'javascript:alert("xss")'

// ❌ Rejected - HTML data URI
'data:text/html,<script>alert("xss")</script>'

// ❌ Rejected - JPEG (wrong format)
'data:image/jpeg;base64,...'

// ❌ Rejected - Invalid base64
'data:image/png;base64,<script>alert("xss")</script>'

// ✅ Accepted - Valid PNG data URI
'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA...'
```

### 2. Booking Info Sanitization
**Location:** `qr-print.service.ts` - `printQRCode()` method

**Protection Against:** XSS via booking details (number, area name, dates)

**Implementation:**
- ✅ All `BookingInfo` fields are sanitized before rendering
- ✅ Uses DOM API to escape HTML entities (`textContent` → `innerHTML`)
- ✅ Sanitized data is passed to component, not original user input

**Example Attacks Prevented:**
```javascript
// Input
{
  bookingNumber: '<script>alert("xss")</script>BOOK-123',
  areaName: '<img src=x onerror=alert("xss")>Park'
}

// Output (sanitized)
{
  bookingNumber: '&lt;script&gt;alert("xss")&lt;/script&gt;BOOK-123',
  areaName: '&lt;img src=x onerror=alert("xss")&gt;Park'
}
```

### 3. Angular Template Auto-Escaping
**Location:** `qr-print-view.component.html`

**Protection Against:** XSS via template interpolation

**Implementation:**
- ✅ Angular automatically escapes all `{{ }}` interpolations
- ✅ Using `[src]` binding (safe for validated data URIs)
- ✅ No use of `[innerHTML]` or `bypassSecurityTrust...` methods

**Safe Patterns Used:**
```html
<!-- ✅ Safe - Auto-escaped by Angular -->
<p>{{ bookingInfo?.bookingNumber }}</p>
<p>{{ bookingInfo?.areaName }}</p>

<!-- ✅ Safe - Validated data URI only -->
<img [src]="qrCodeDataUrl" alt="Booking QR Code" />
```

### 4. Component Isolation
**Location:** `qr-print.service.ts` - `printQRCode()` method

**Protection Against:** State pollution, component reuse attacks

**Implementation:**
- ✅ Component created fresh for each print
- ✅ Component destroyed immediately after HTML extraction
- ✅ No shared state between print operations

## Content Security Policy (CSP) Recommendations

### Recommended CSP Headers
```
Content-Security-Policy:
  default-src 'self';
  img-src 'self' data:;
  script-src 'self';
  style-src 'self' 'unsafe-inline';
  object-src 'none';
```

### Why These Settings?
- `img-src 'self' data:` - Allows QR code images as data URIs (validated to be PNG only)
- `script-src 'self'` - No inline scripts, only from same origin
- `style-src 'self' 'unsafe-inline'` - Angular components may use inline styles
- `object-src 'none'` - Prevents embedding of plugins

### Popup Window CSP
The popup window created by `window.open()` inherits the parent's CSP by default, but has no external resources, so it's safe.

## Known Limitations

### 1. `document.write()` Usage
**Location:** `qr-print.service.ts:81`

**Risk:** Low (controlled content only)

**Justification:**
- Only used in a popup window for printing
- Content is generated from Angular component (already sanitized)
- No user input directly interpolated into the document structure
- Necessary for cross-browser print functionality

### 2. No DomSanitizer Usage
**Decision:** Not needed

**Reasoning:**
- Angular templates auto-escape all values
- All user input is sanitized before passing to component
- Data URIs are strictly validated
- We don't use `[innerHTML]` or bypass security

## Testing

### Security Test Coverage
✅ Rejects non-PNG data URIs  
✅ Rejects invalid base64 content  
✅ Rejects non-data URLs  
✅ Sanitizes XSS in booking number  
✅ Sanitizes XSS in area name  
✅ Sanitizes XSS in date fields  
✅ Validates QR code size limits  

**Test File:** `qr-print.service.spec.ts`

## Audit Trail

| Date | Change | Reason |
|------|--------|--------|
| 2026-01-07 | Added `isValidQRCodeDataUrl()` | Prevent malicious data URI injection |
| 2026-01-07 | Sanitize all `BookingInfo` fields | Prevent XSS via booking details |
| 2026-01-07 | Added comprehensive security tests | Verify protections work correctly |

## Future Improvements

1. Consider adding rate limiting for print operations
2. Add logging/monitoring for rejected data URIs (potential attack attempts)
3. Consider using Trusted Types API if browser support improves
4. Add integration tests with actual malicious payloads

## References

- [OWASP XSS Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)
- [Angular Security Guide](https://angular.io/guide/security)
- [MDN: Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
