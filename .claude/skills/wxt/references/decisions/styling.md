# Styling approach

- Extension pages (popup/options/side panel): anything Vite supports. Tailwind v4 via `@tailwindcss/vite` is the common default with React.
- Content-script UIs: shadow root + Tailwind v4 works (WXT rewrites `:root`→`:host` and hoists `@property` rules to the document). Convert `rem` to `px` if the UI must look identical on every site. See `styling-react.md`.
- UnoCSS: `@wxt-dev/unocss` module + `import 'virtual:uno.css'`.

**Recommend:** Tailwind v4 everywhere, with one shared `assets/tailwind.css`, plus the rem→px PostCSS step for content-script UIs.
