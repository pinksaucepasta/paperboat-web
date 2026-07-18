# CLI Device Authorization

Status: Phase 0 frozen dashboard contract; UI implementation is Phase 2.

The dashboard is the browser approval surface for Paperboat public clients. WorkOS plus
`paperboat-server` remains the identity authority; the dashboard never mints, receives, or
stores CLI access, refresh, or device tokens.

## Route

`/cli/authorize` lives outside the paid dashboard shell. Identity authorization must work
before entitlement is active; entitlement is enforced later when the CLI lists or connects
to projects. An unauthenticated visitor signs in through the existing WorkOS flow and
returns to the same approval route with only the normalized `user_code` preserved.

The complete verification URL may contain `?code=<user_code>`. No device code, access token,
refresh token, session token, or approval result is placed in a URL, browser storage,
analytics event, client log, or client-rendered server response.

## Server Calls

The dashboard BFF uses the HttpOnly WorkOS-backed cookie session for:

- `GET /api/auth/device/requests/{user_code}`
- `POST /api/auth/device/requests/{user_code}/approve`
- `POST /api/auth/device/requests/{user_code}/deny`

Approve and deny additionally use the existing CSRF cookie/header pair. The browser displays
only server-authored client label, OS, device type, requested scopes, issue time, expiry,
user code, and request state. It requires an explicit Approve or Deny command and does not
auto-approve after login.

The CLI's exact permission set is `account:read`, `clients:revoke`, `projects:read`,
`projects:connect`, and `session:refresh`. The dashboard presents all five before approval;
it does not add, remove, or reinterpret scopes.

## States

The UI handles `pending`, `approved`, `denied`, `expired`, and `consumed`, plus malformed or
unknown codes, a request bound to another account, and transient server failure. Approval
moves `pending` to the intermediate `approved` state; only the CLI's successful token poll
moves it to `consumed`. Denied, expired, and consumed requests are terminal. An approved
request cannot be denied or bound to another account, but a repeated approve is idempotent.
Success confirms the approved client without showing credentials and directs the user back
to the CLI.

Authorized-client settings consume `GET /api/auth/clients` and
`DELETE /api/auth/clients/{client_session_id}` through the dashboard BFF. Revocation shows
client label, device/OS, created time, last-used time, and current state; it never exposes
token material. The list uses the server-defined `items` plus `pagination` response and its
`limit`, `offset`, and optional `state` query parameters; the dashboard must not invent a
different collection shape.

The BFF uses the WorkOS cookie session and CSRF for deletion. Non-browser bearer callers
instead require `account:read` to list clients and `clients:revoke` to delete one.

Implementation must follow `paperboat-web/DESIGN.md`, preserve focus through WorkOS return,
support keyboard and screen-reader operation, and cover reduced motion, mobile, expired
requests, and server errors.
