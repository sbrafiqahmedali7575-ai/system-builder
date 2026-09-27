<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/68c6ef1e-cce3-42f5-a93a-7da822711935

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`


## System Builder UI

This version includes a clean blue/red/yellow visual system and a long-term professional badge ladder. Badge ranks are unlocked by completed days, with milestones progressing from Analytics Learner to Analytics Master.


## Owner authentication

Administrative APIs for notification settings, delivery logs, test emails, and backups require owner authentication.

Set `OWNER_ACCESS_TOKEN` in the server/deployment environment to a random value of at least 32 characters. Do not commit the value to Git.

Example token generation:

`openssl rand -base64 48`

Open Notification Settings in the app and enter that token once. The server creates a 12-hour HttpOnly, SameSite=Strict owner session cookie.

For the generated Windows backup sync script, set `SYSTEM_BUILDER_OWNER_TOKEN` on the Windows machine to the same secret so the script can send an authenticated bearer request.

Scheduled reminder and finalization webhooks do not use a static shared scheduler secret. The approved GitHub Actions workflows authenticate with short-lived GitHub OIDC tokens.


## Firestore and data security

System Builder no longer connects to Firestore from browser code. The SPA is owner-gated and reads/writes records, tasks, habits, and countdown settings only through owner-authenticated `/api/data/*` endpoints.

The checked-in `firestore.rules` intentionally denies every direct Firebase client read and write. The backend accesses Firestore with Google IAM credentials over the Firestore REST API, so it does not depend on Firebase client Security Rules.

For production on Google Cloud / Cloud Run, grant the runtime service account the minimum Firestore access required by the app (normally `roles/datastore.user`). Application Default Credentials are used automatically.

For local or non-Google hosting, either configure standard Google Application Default Credentials or provide `FIREBASE_SERVICE_ACCOUNT_JSON` as a server-only environment variable containing the service-account JSON. Never commit service-account credentials.

After deploying this version, deploy the repository's `firestore.rules` to the Firebase project. The source change alone does not modify already-deployed Firestore rules.

The legacy Firebase web configuration file is not imported by browser code and the Firebase browser SDK is no longer a direct dependency. Firebase web API keys are public identifiers rather than authorization secrets; if the legacy key remains enabled, restrict its allowed APIs and HTTP referrers in Google Cloud Console.

## Security controls

- Entire SPA requires an owner session.
- Owner token is exchanged for a 12-hour HttpOnly, SameSite=Strict cookie.
- Firestore direct client access is denied.
- Backend Firestore access uses Google IAM credentials.
- Scheduler webhooks accept approved GitHub Actions OIDC tokens only.
- Email capability tokens are removed from the browser URL after initial validation and moved into short-lived route-scoped HttpOnly cookies.
- SMTP certificate verification is enforced.
- Backend bundles and source maps are built outside the public `dist/` directory.
- Production responses use CSP, HSTS, anti-framing, no-sniff, no-referrer, and restrictive Permissions-Policy headers.
- CI runs `security:check` to prevent accidental reintroduction of browser Firebase access, open Firestore rules, disabled TLS verification, or public server bundles.
