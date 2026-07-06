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

For classic Pages Git integration, use:

- Framework preset: None
- Build command: `pnpm run build`
- Build output directory: `dist`
- Root directory: leave blank

For a Workers static-assets project, use:

- Build command: `pnpm run build`
- Deploy command: `npx wrangler deploy`

The checked-in `wrangler.jsonc` points Wrangler at `dist/`. Without that file, Wrangler may infer `.` as the assets directory and try to upload `node_modules`.

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

Fireworks is the primary target. The model picker favors the least-tuned practical pay-per-token routes that still fit Basebench's completions + prompt-logprobs workflow:

- `accounts/fireworks/models/kimi-k2p6`
- `accounts/fireworks/models/glm-5p2`
- `accounts/fireworks/models/deepseek-v4-pro`
- `accounts/fireworks/models/minimax-m3`
- `accounts/fireworks/models/qwen3p7-plus`

Together is included as a second adapter because its completions API documents prompt logprobs via `echo: true` + `logprobs`. The curated Together presets currently include `Qwen/Qwen3.5-397B-A17B`, `zai-org/GLM-5.2`, `deepseek-ai/DeepSeek-V4-Pro`, `moonshotai/Kimi-K2.6`, `MiniMaxAI/MiniMax-M3`, `google/gemma-4-31B-it`, and a few smaller Qwen controls.

Actual base checkpoints remain scarce on serverless pay-per-token inference. Together's `moonshotai/Kimi-K2-Base` catalog model is not currently in the self-serve dedicated endpoint model list, despite API errors that suggest creating a dedicated endpoint for it. Some recent open-weight families are omitted from the preset picker when the available hosted route is chat-only, deployment-only, or lacks prompt-token logprobs. After creating a Together dedicated endpoint, use the generated endpoint `name` as the Basebench model value.

API keys are stored in `sessionStorage`, not committed or persisted across browser sessions. Static BYOK means each user pays with their own key.
