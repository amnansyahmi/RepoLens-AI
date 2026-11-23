# RepoLensa showcase

The visuals used in the README are not stock images.

- [Brand cover](assets/repolensa-cover.svg): editable vector product illustration, **not** a UI screenshot.
- [Demo dependency graph](assets/demo-dependency-graph.svg): vector diagram based on the real ten-file `src/demo.ts` sample (12 static imports), **not** a UI screenshot.
- Screenshot capture: [automated workflow](../.github/workflows/capture-showcase.yml) launches the actual Vite app, opens its built-in demo in Chromium, and captures the homepage, interactive graph, and health report.
- A short animated walkthrough is generated from the same browser screenshots. No account, private repository, API token, or cloud AI key is used.

Screenshot files are generated after the workflow has succeeded and published them into `docs/assets/`. The README should link to them only when those files exist.

To reproduce locally, install the app dependencies, Playwright and Chromium, then run `npm run dev` and `node scripts/capture-showcase.mjs` while Vite is running. Pillow generates the GIF with `python scripts/make-showcase-gif.py`.

Do not create promotional images that falsely suggest a feature is available or imply a rendered illustration is a genuine application screenshot.
