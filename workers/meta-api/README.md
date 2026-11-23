# AutoViral Meta API Worker

Secure server-side OAuth and Meta Marketing API gateway for the Firebase-first AutoViral app.

## Required Cloudflare configuration

Create a KV namespace and replace `REPLACE_WITH_KV_NAMESPACE_ID` in `wrangler.toml`. Configure these as Worker secrets (never as plaintext vars):

- `META_APP_ID`: App ID for the existing VIRAL SALES AI Meta app.
- `META_APP_SECRET`: App Secret for that same Meta app.
- `TOKEN_ENCRYPTION_KEY`: 32-byte random key encoded as 64 hexadecimal characters.
- `OAUTH_REDIRECT_URI`: exact HTTPS callback URL, e.g. `https://autoviral-meta-api.<your-subdomain>.workers.dev/meta/oauth/callback`.

The `APP_ORIGIN` and `FIREBASE_PROJECT_ID` vars are non-secret. Confirm the deployed Worker URL and register its exact callback URL in the Meta app's Valid OAuth Redirect URIs. Do not remove the legacy Supabase callback URLs used by the other platform.

## Endpoints

- `GET /health`: non-sensitive readiness/configuration check.
- `POST /meta/oauth/start`: requires Firebase ID token; returns Meta authorization URL.
- `GET /meta/oauth/callback`: validates one-time state, exchanges code, encrypts and stores the Meta token in KV.
- `POST /meta/accounts`: lists ad accounts for the authenticated Firebase user.
- `POST /meta/campaigns`: lists campaigns for a verified ad account.
- `POST /meta/campaigns/action`: pauses or activates a campaign only after verifying the ad account and campaign association.

## Security properties

- Firebase ID tokens are verified against Google's Secure Token JWKS, including issuer, audience, expiry and subject.
- OAuth state is random, one-time and expires after 10 minutes.
- Meta tokens are AES-GCM encrypted before storage in KV.
- Browser requests are restricted to the configured app origin.
- App Secret and Meta access tokens never reach the browser.
- Account IDs are checked against the user's authorized Meta ad accounts before campaign reads/writes.
- No campaign deletion endpoint is provided.

## Important

This Worker does not make the Meta app approved for Advanced Access. The Meta app owner must configure Login for Business/Marketing API, exact redirect URI, permissions, privacy policy and App Review as required. Test first with app-role users and a test ad account.
