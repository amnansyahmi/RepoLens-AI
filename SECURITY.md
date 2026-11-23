# Security policy

Please report security issues privately through GitHub's repository security advisory feature, rather than filing a public issue. RepoLens runs locally in the browser; do not add telemetry or upload user source without explicit user consent. Do not put credentials in the application. External links should use safe URLs and open with noopener/noreferrer.

## Bring Your Own Key (BYOK)

Cloud AI uses direct browser-to-provider HTTPS calls and opt-in metadata sharing. Keys are never stored in localStorage, cookies or the RepoLensa backend (there is no cloud proxy). Browser-side keys **are not secrets against compromised origins, browser extensions or DevTools**. Visitors must use provider-restricted, low-spend keys, clear credentials after use and avoid entering production secrets. Cloud providers may log prompts and file paths; no source text is sent by the cloud BYOK feature.

Do not submit source files, API keys, GitHub tokens or private project paths in public issues. If the origin is compromised, disable cloud BYOK and rotate any exposed keys. Provider CORS or key restrictions may prevent requests; never ask users to disable browser security to work around failures.
