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
