# Configuration

## JWT signing key

Generated automatically on first run and stored at `./data/jwt.key`. To supply your own, set the `Jwt__Key` environment variable.

## Reminder notifications (Web Push)

The app is an installable PWA that can send reminders to write entries (turned on per device on the Settings page).

- **HTTPS is required** to install the app and receive push notifications. `localhost` counts as secure, so `npm run dev` works; in production the Cloudflare Tunnel provides HTTPS.
- **VAPID keys** sign push messages. They are generated automatically on first run and stored at `./data/vapid.json`. To supply your own, set both `Push__VapidPublicKey` and `Push__VapidPrivateKey` (setting only one stops the backend from starting). Set `Push__Subject` to a `mailto:` address or your site's URL so push services can contact you (default `mailto:admin@localhost`).
- **iPhone/iPad** (iOS 16.4 or later) only receive notifications once the app is added to the Home Screen (Share → Add to Home Screen) and opened from there.

## Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `Jwt__Key` | Generated, stored at `./data/jwt.key` | Signs login tokens |
| `Push__VapidPublicKey` | Generated, stored at `./data/vapid.json` | Web Push public key (set together with the private key) |
| `Push__VapidPrivateKey` | Generated, stored at `./data/vapid.json` | Web Push private key (set together with the public key) |
| `Push__Subject` | `mailto:admin@localhost` | Contact address for push services |
| `CF_TUNNEL_TOKEN` | None | Cloudflare Tunnel token, read from `.env` by Docker Compose |
