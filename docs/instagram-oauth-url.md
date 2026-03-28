# Instagram browser OAuth URL (exact shape)

The API builds the Meta login URL in `src/lib/instagramBrowserOAuth.ts` via `buildInstagramBrowserOAuthUrl`.

## Template

After resolving `appId` (`INSTAGRAM_APP_ID` or `FACEBOOK_APP_ID`), `redirect_uri` (`INSTAGRAM_FRONTEND_REDIRECT_URI`), and a server-issued `state` token, the redirect target is:

```
https://www.facebook.com/v19.0/dialog/oauth?client_id=<APP_ID>&redirect_uri=<ENCODED_REDIRECT_URI>&state=<STATE>&response_type=code&scope=instagram_basic%2Cinstagram_manage_insights%2Cpages_show_list%2Cbusiness_management
```

`URLSearchParams` produces comma-separated scopes with `%2C` between entries.

## HTTP entry points (same underlying URL)

| Method | Path | Auth | Notes |
|--------|------|------|--------|
| `GET` | `/api/auth/instagram?clientId=…` | `Authorization: Bearer <jwt>` | **302** redirect to Facebook (agency admins must pass `clientId`). |
| `GET` | `/api/auth/oauth/instagram/authorise?clientId=…` | Bearer | **200** JSON `{ "url": "<same dialog URL>" }` — used by the dashboard so the SPA can open Meta in the same tab (browser navigations cannot attach the `Authorization` header). |

`GET /auth/instagram` on the API host is registered as an alias for the same redirect behaviour (see `src/app.ts`).

## Manual check (curl)

```bash
# Replace TOKEN; use a client id the user can access (e.g. demo-client).
curl -sS -D - -o /dev/null \
  -H "Authorization: Bearer TOKEN" \
  "http://localhost:4000/api/auth/instagram?clientId=demo-client"
```

Expect `HTTP/1.1 302` and a `Location:` header pointing at `https://www.facebook.com/v19.0/dialog/oauth?...`.
