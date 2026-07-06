# Base Model Workbench

A static BYOK prototype for writing with base-ish language models:

- write in a single CodeMirror editor;
- score prompt tokens with `echo` + `logprobs`;
- color tokens inline by surprisal;
- keep a cursor-synced completions pane with sampled forks;
- cache scored prompts and sampled forks in `localStorage`.

## Build

```sh
cd /Users/lume/base-model-workbench
pnpm install
pnpm run build
```

The build writes the static deployable site to `dist/` and also refreshes the local root-level `app.js` used by `serve.py`.

## Cloudflare Pages

Use Pages Git integration against this repository:

- Framework preset: None
- Build command: `pnpm run build`
- Build output directory: `dist`
- Root directory: leave blank

No provider API keys should be configured in Cloudflare. Basebench is BYOK: keys are entered by each user in the browser and stored only in `sessionStorage`.

## Run Locally

```sh
cd /Users/lume/base-model-workbench
python3 serve.py
```

Open <http://127.0.0.1:4173/>.

## VM Service

The VM-host-facing prototype is served by a LaunchAgent:

```sh
launchctl print gui/$(id -u)/com.lume.base-model-workbench
launchctl kickstart -k gui/$(id -u)/com.lume.base-model-workbench
launchctl bootout gui/$(id -u)/com.lume.base-model-workbench
```

Open <http://192.168.64.100:4173/index.html> from the host-side browser.

## Provider Notes

Fireworks is the primary target. Useful model IDs:

- `accounts/fireworks/models/kimi-k2p6`
- `accounts/fireworks/models/glm-5p2`
- `accounts/fireworks/models/kimi-k2p7-code`

Together is included as a second adapter because its completions API documents prompt logprobs via `echo: true` + `logprobs`.

API keys are stored in `sessionStorage`, not committed or persisted across browser sessions. Static BYOK means each user pays with their own key.
