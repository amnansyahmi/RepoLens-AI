# User guide and troubleshooting

Start with the built-in demo at https://repolensa-ai.vercel.app. No account or key is needed. Select nodes to inspect source and relationships, open the health report, and export the results.

| Problem | What to try |
| --- | --- |
| GitHub import fails | Verify the repository is public and the URL is a GitHub repository URL. Unauthenticated API limits may require waiting. |
| Missing files or edges | Check partial-import warnings and supported file types. Static analysis cannot resolve every runtime dependency. |
| Local folder unavailable | Use a supported desktop browser or try the synthetic demo. |
| Cloud AI fails | Core analysis works without AI. Check provider quota, model availability and CORS; never disable browser security. |
| Ollama unavailable | Check that the local service is running and its allowed origins match the app. Never expose its port publicly. |
| Unexpected health score | Inspect evidence and scoring methodology; scores are structural heuristics, not security or coverage results. |

## Privacy checklist

Use synthetic or public examples in issues and screenshots. Local source stays in browser memory according to the application design. Optional AI sends metadata after consent; filenames can themselves be sensitive. Do not share private exports, source, keys or internal paths. Clear temporary BYOK keys after use. See [security policy](../SECURITY.md).
