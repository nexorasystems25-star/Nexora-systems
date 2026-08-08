# ChurchFlow

ChurchFlow is a production-oriented church management platform with a responsive
web application, an Expo mobile application, role-based access control, member
self-service, and operational modules for membership, attendance, events,
finance, welfare, payroll, communication, records, archives, volunteers, and
reporting.

## Applications

- `app/` — web interface and protected API routes
- `mobile/` — Expo React Native application for workers and members
- `db/` and `drizzle/` — Cloudflare D1 schema and migrations
- `tests/` — security and application contract tests

## Authentication

ChurchFlow uses Supabase authentication for email/password, email OTP, and
Google OAuth. Authentication alone does not grant CMS access: every email must
first be created and assigned an active role by a ChurchFlow administrator.
The API validates the Supabase access token and applies the role policy stored
in ChurchFlow.

Only the public Supabase client configuration belongs in client applications.
Never commit a Supabase service-role key, GitHub token, Expo access token, or
other privileged credential.

## Web development

Requirements:

- Node.js 22 or newer
- npm

```bash
npm ci
npm test
npm run dev
```

Production environment variables:

```text
SUPABASE_URL
SUPABASE_ANON_KEY
```

The web deployment also requires the D1 and R2 bindings declared in
`.openai/hosting.json`.

## Mobile development

```bash
cd mobile
npm ci
npm run typecheck
npm start
```

Create an installable Android preview:

```bash
npx eas-cli@latest login
npx eas-cli@latest build --platform android --profile preview
```

Create the Android production build:

```bash
npx eas-cli@latest build --platform android --profile production
```

## Access model

- Public registration is disabled.
- Administrators create and approve worker/member access.
- Member accounts are linked to one active member record.
- Permissions are enforced by protected APIs, not only by hidden navigation.
- Finance approvals use maker-checker controls.
- Confidential care data is restricted by role.

## Production

Current web application:

https://churchflow-management.amanvid-da.chatgpt.site

Before a live rollout, configure Supabase redirect URLs and providers, create
the initial administrator accounts, test every role on real devices, configure
backups and monitoring, and complete the privacy and operational policies.
