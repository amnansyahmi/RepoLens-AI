# Keyboard navigation

- Use Tab and Shift+Tab to move through the explorer. The focus outline shows which control or graph node is active.
- Focus a graph node and press Enter to inspect its file or directory. You can also activate **Modules**, then Tab to a file and press Enter.
- File details opens with focus on **Close file details**. Tab and Shift+Tab cycle within the panel. Use the arrow keys to scroll a focused source preview.
- Press Escape, activate **Close file details**, or click or tap the backdrop. Focus returns to the control that opened the panel, even after opening a file from inside a directory. If that control was removed, focus moves to the architecture heading.

The same flow works at a narrow viewport, where you can still pinch to zoom and tap the backdrop beside the panel.

## Run the browser check

Install dependencies and Chromium, then start the app.

```sh
npm ci
npx playwright install chromium
npm run dev
```

In a second terminal, run `npm run test:browser`. Set `CHECK_URL` to test a different local URL. On Linux, use `npx playwright install --with-deps chromium` if Chromium's system dependencies are missing.

The same Chromium check runs in CI. It uses real Tab and Shift+Tab key presses, verifies all three dismissal methods and focus restoration, and checks the mobile viewport at 390px.
