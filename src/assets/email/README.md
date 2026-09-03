# Email images

Served publicly as `https://<env domain>/dayuse/assets/email/<file>` because
`src/assets` ships with the app build under the `/dayuse/` prefix.

They exist here, rather than in reserve-rec-api beside the template that uses
them, because the sender is Cognito: a verification email is an HTML string with
no attachments, so its images must be fetched over HTTP. (The booking
confirmation email goes out through our own dispatch Lambda and attaches its
images by Content-ID instead — see reserve-rec-api#507.)

`reserve-rec-api/lib/public-identity-stack/verify-account-email.html` references
these five names. Keep the display sizes in that template at 1x; the files are 2x
exports for retina. PNG only — clients do not load SVG in `<img>`.

Source vectors: `reserve-rec-api/lib/public-identity-stack/assets/`.

Ref bcgov/reserve-rec-public#502
