# Config, secrets, and environments

- `.env` / `.env.[mode]` / `.env.[browser]`: values must start with `WXT_` or `VITE_`; read with `import.meta.env.WXT_X`. **Everything in the bundle is public.** Never ship real secrets; proxy through your server.
- `app.config.ts` + `defineAppConfig`/`getAppConfig()`: typed runtime config, a single place that parses env vars into types/defaults (committed: no secrets).
- `--mode staging` for custom build modes; read `import.meta.env.MODE`.
- In `wxt.config.ts`, env vars are only available inside the **function form** `manifest: ({ mode, browser }) => ({ … })`.
