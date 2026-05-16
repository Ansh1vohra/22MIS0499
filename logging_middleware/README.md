# Logging Middleware

Reusable logging package for the Affordmed evaluation test server.

## Usage

Set the Bearer token in your environment:

```bash
LOG_AUTH_TOKEN=your_access_token_here
```

Then call:

```js
import { Log } from "./logging_middleware/index.js";

await Log("backend", "error", "handler", "received string, expected bool");
```

For frontend code, pass the token explicitly from your app config:

```js
await Log("frontend", "info", "component", "notifications loaded", {
  token: import.meta.env.VITE_LOG_AUTH_TOKEN,
});
```

Do not commit real tokens or client secrets.
