<!-- source: https://wxt.dev/api/reference/wxt/utils/inject-script/interfaces/InjectScriptResult.md -->
[API](../../../../packages.md) / [wxt/utils/inject-script](../index.md) / InjectScriptResult

# Interface: InjectScriptResult

Source: [packages/wxt/src/utils/inject-script.ts:96](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/utils/inject-script.ts#L96)

## Properties

### script

> **script**: `HTMLScriptElement`

Source: [packages/wxt/src/utils/inject-script.ts:102](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/utils/inject-script.ts#L102)

The created script element. It can be used to e.g. send messages to the
script in the form of custom events. The script can add an event listener
for them via `document.currentScript`.

***

Generated using [typedoc-plugin-markdown](https://www.npmjs.com/package/typedoc-plugin-markdown) and [TypeDoc](https://typedoc.org/)
