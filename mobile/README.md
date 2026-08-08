# ChurchFlow Mobile

The ChurchFlow mobile app is an Expo client for authorised church workers. It
connects to the same ChurchFlow API, database, roles, and permissions as the
web application.

## Run locally

1. Install dependencies:

   ```bash
   npm install
   ```

2. Start Expo:

   ```bash
   npm start
   ```

3. Open ChurchFlow on the web, go to **Administration → Users**, and choose
   **Issue mobile access** for the worker.

4. Copy the one-time activation code into the mobile app. The code is stored in
   the device secure store and is not shown again in ChurchFlow.

## Quality checks

```bash
npm run typecheck
npm run doctor
```

## Native builds

After connecting the project to an Expo account:

```bash
npx eas-cli build --platform android --profile preview
npx eas-cli build --platform ios --profile preview
```

Production app-store builds use the `production` profile in `eas.json`. Android
and iOS signing credentials remain managed through the organisation's Expo and
app-store accounts.
