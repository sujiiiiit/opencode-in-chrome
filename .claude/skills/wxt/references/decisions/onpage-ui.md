# On-page UI: `createIntegratedUi` vs `createShadowRootUi` vs `createIframeUi`

| | Integrated | Shadow Root | IFrame |
|---|---|---|---|
| Page CSS leaks into your UI | yes | no | no |
| Your CSS leaks into page | yes | no (except hoisted `@property`/`@font-face`) | no |
| Events isolated | no | opt-in `isolateEvents` | yes |
| HMR in dev | no | no | **yes** |
| Access to page DOM from UI code | direct | direct | no (separate document, needs messaging) |
| Extra setup | none | `cssInjectionMode: 'ui'`, async | an HTML entrypoint + `web_accessible_resources` |

**Recommend:** **Shadow root** for almost all injected UIs (React + Tailwind works well there).
**Why:** the host site's CSS will otherwise restyle your UI in unpredictable ways on each site, and your CSS can break the site.
**Deviate when:** you deliberately want to blend into the page's styling (integrated); the UI is large or app-like and you want HMR, or it must be fully isolated from the page's JS (iframe); a component library absolutely can't render into a shadow root (iframe).
