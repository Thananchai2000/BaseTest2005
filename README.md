# BaseTest2005

2005-style login page plus a factory monitoring dashboard.
Node.js only, **no npm dependencies**.

## Run

```bash
npm start
```

Open http://localhost:3000

On first run the server creates `data/users.json` with a demo account:

| Username | Password    |
|----------|-------------|
| admin    | factory2005 |

Change it right away, or add users:

```bash
node scripts/adduser.js <username> <password> "Display Name" "Role"
```

Re-running `adduser.js` with an existing username replaces that user's password.

## Structure

```
server.js            HTTP server, login, sessions, API
lib/factory.js       simulated factory data (replace with PLC/DB source)
scripts/adduser.js   create or update users
public/              login page, dashboard, css, js
data/users.json      generated, git-ignored
```

## Security

- Passwords stored as salted scrypt hashes, never in the repo.
- Sessions: random token in an HttpOnly, SameSite=Strict cookie, 30 min idle timeout.
- Login is limited to 5 failed attempts per IP per 5 minutes.
- Dashboard page and `/api/*` data require a session.
- Sessions live in memory (restart = everyone logs out).
- Serve over HTTPS (reverse proxy) before exposing it beyond localhost, and add the `Secure` cookie flag then.
- GitHub Pages cannot run this server (static only). Use a Node host (Render, Railway, a VPS) instead.

## Real data

`lib/factory.js` generates simulated values. Keep `snapshot()` returning the same shape
(`kpi`, `machines`, `alarms`) and wire it to your real source; the dashboard needs no change.

## License

MIT
