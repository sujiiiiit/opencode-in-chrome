<!-- source: https://wxt.dev/api/reference/wxt/interfaces/BaseContentScriptEntrypointOptions.md -->
[API](../../packages.md) / [wxt](../index.md) / BaseContentScriptEntrypointOptions

# Interface: BaseContentScriptEntrypointOptions

Source: [packages/wxt/src/types.ts:716](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L716)

## Contents

* [Extends](#extends)
* [Extended by](#extended-by)
* [Properties](#properties)
  * [allFrames?](#allframes)
  * [cssInjectionMode?](#cssinjectionmode)
  * [exclude?](#exclude)
  * [excludeGlobs?](#excludeglobs)
  * [excludeMatches?](#excludematches)
  * [globalName?](#globalname)
  * [include?](#include)
  * [includeGlobs?](#includeglobs)
  * [matchAboutBlank?](#matchaboutblank)
  * [matches?](#matches)
  * [matchOriginAsFallback?](#matchoriginasfallback)
  * [noScriptStartedPostMessage?](#noscriptstartedpostmessage)
  * [registration?](#registration)
  * [runAt?](#runat)

## Extends

* [`BaseScriptEntrypointOptions`](BaseScriptEntrypointOptions.md)

## Extended by

* [`MainWorldContentScriptEntrypointOptions`](MainWorldContentScriptEntrypointOptions.md)
* [`IsolatedWorldContentScriptEntrypointOptions`](IsolatedWorldContentScriptEntrypointOptions.md)

## Properties

### allFrames?

> `optional` **allFrames?**: [`PerBrowserOption`](../type-aliases/PerBrowserOption.md)<`boolean` | `undefined`>

Source: [packages/wxt/src/types.ts:755](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L755)

See https://developer.chrome.com/docs/extensions/mv3/content\_scripts/

#### Default

```ts
false
```

***

### cssInjectionMode?

> `optional` **cssInjectionMode?**: [`PerBrowserOption`](../type-aliases/PerBrowserOption.md)<`"manifest"` | `"manual"` | `"ui"`>

Source: [packages/wxt/src/types.ts:778](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L778)

Customize how imported/generated styles are injected with the content
script. Regardless of the mode selected, CSS will always be built and
included in the output directory.

* `"manifest"` - Include the CSS in the manifest, under the content script's
  `css` array.
* `"manual"` - Exclude the CSS from the manifest. You are responsible for
  manually loading it onto the page. Use
  `browser.runtime.getURL("content-scripts/<name>.css")` to get the file's
  URL
* `"ui"` - Exclude the CSS from the manifest. CSS will be automatically added
  to your UI when calling `createShadowRootUi`

#### Default

```ts
'manifest'
```

***

### exclude?

> `optional` **exclude?**: `string`\[]

Source: [packages/wxt/src/types.ts:673](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L673)

List of target browsers to exclude this entrypoint from. Cannot be used
with `include`. You must choose one of the two options.

#### Default

```ts
undefined
```

#### Inherited from

[`BaseScriptEntrypointOptions`](BaseScriptEntrypointOptions.md).[`exclude`](BaseScriptEntrypointOptions.md#exclude)

***

### excludeGlobs?

> `optional` **excludeGlobs?**: [`PerBrowserOption`](../type-aliases/PerBrowserOption.md)<`string`\[] | `undefined`>

Source: [packages/wxt/src/types.ts:749](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L749)

See https://developer.chrome.com/docs/extensions/mv3/content\_scripts/

#### Default

```ts
[ ]
```

***

### excludeMatches?

> `optional` **excludeMatches?**: [`PerBrowserOption`](../type-aliases/PerBrowserOption.md)<`string`\[] | `undefined`>

Source: [packages/wxt/src/types.ts:737](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L737)

See https://developer.chrome.com/docs/extensions/mv3/content\_scripts/

#### Default

```ts
[ ]
```

***

### globalName?

> `optional` **globalName?**: `string` | `boolean` | ((`entrypoint`) => `string`)

Source: [packages/wxt/src/types.ts:713](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L713)

The variable name for the IIFE in the output bundle.

This option is relevant for scripts inserted into the page context where
the default IIFE variable name may conflict with an existing variable on
the target page. This applies to content scripts with world=MAIN, and
others, such as unlisted scripts, that could be dynamically injected into
the page with a `<script>` tag.

Available options:

* `true`: automatically generate a name for the IIFE based on the entrypoint
  name
* `false`: Output the IIFE without a variable name, making it anonymous. This
  is the safest option to avoid conflicts with existing variables on the
  page.
* `string`: Use the provided string as the global variable name.
* `function`: A function that receives the entrypoint and returns a string to
  use as the variable name.

#### Default

```ts
false
```

#### Inherited from

[`BaseScriptEntrypointOptions`](BaseScriptEntrypointOptions.md).[`globalName`](BaseScriptEntrypointOptions.md#globalname)

***

### include?

> `optional` **include?**: `string`\[]

Source: [packages/wxt/src/types.ts:666](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L666)

List of target browsers to include this entrypoint in. Defaults to being
included in all builds. Cannot be used with `exclude`. You must choose one
of the two options.

#### Default

```ts
undefined
```

#### Inherited from

[`BaseScriptEntrypointOptions`](BaseScriptEntrypointOptions.md).[`include`](BaseScriptEntrypointOptions.md#include)

***

### includeGlobs?

> `optional` **includeGlobs?**: [`PerBrowserOption`](../type-aliases/PerBrowserOption.md)<`string`\[] | `undefined`>

Source: [packages/wxt/src/types.ts:743](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L743)

See https://developer.chrome.com/docs/extensions/mv3/content\_scripts/

#### Default

```ts
[ ]
```

***

### matchAboutBlank?

> `optional` **matchAboutBlank?**: [`PerBrowserOption`](../type-aliases/PerBrowserOption.md)<`boolean` | `undefined`>

Source: [packages/wxt/src/types.ts:729](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L729)

See https://developer.chrome.com/docs/extensions/mv3/content\_scripts/

#### Default

```ts
false
```

***

### matches?

> `optional` **matches?**: [`PerBrowserOption`](../type-aliases/PerBrowserOption.md)<`string`\[]>

Source: [packages/wxt/src/types.ts:717](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L717)

***

### matchOriginAsFallback?

> `optional` **matchOriginAsFallback?**: [`PerBrowserOption`](../type-aliases/PerBrowserOption.md)<`boolean`>

Source: [packages/wxt/src/types.ts:761](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L761)

See https://developer.chrome.com/docs/extensions/mv3/content\_scripts/

#### Default

```ts
false
```

***

### noScriptStartedPostMessage?

> `optional` **noScriptStartedPostMessage?**: `boolean`

Source: [packages/wxt/src/types.ts:807](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L807)

Do not send the `wxt:content-script-started` message via
`window.postMessage`.

This has been replaced with custom events. The `postMessage` call is kept
for backwards compatibility. For some websites the `postMessage` call is
undesirable, such as those with poorly written message event listeners.

Setting this to `true` opts into the behavior that will become the default
in a future version of WXT, where the `postMessage` call is removed
entirely.

See https://github.com/wxt-dev/wxt/pull/1938 and
https://github.com/wxt-dev/wxt/pull/2035 for a detailed discussion.

***

### registration?

> `optional` **registration?**: [`PerBrowserOption`](../type-aliases/PerBrowserOption.md)<`"runtime"` | `"manifest"`>

Source: [packages/wxt/src/types.ts:791](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L791)

Specify how the content script is registered.

* `"manifest"`: The content script will be added to the `content_scripts`
  entry in the manifest. This is the normal and most well known way of
  registering a content script.
* `"runtime"`: The content script's `matches` is added to `host_permissions`
  and you are responsible for using the scripting API to register/execute
  the content script dynamically at runtime.

#### Default

```ts
'manifest'
```

***

### runAt?

> `optional` **runAt?**: [`PerBrowserOption`](../type-aliases/PerBrowserOption.md)<`RunAt` | `undefined`>

Source: [packages/wxt/src/types.ts:723](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L723)

See https://developer.chrome.com/docs/extensions/mv3/content\_scripts/

#### Default

```ts
'documentIdle'
```

***

Generated using [typedoc-plugin-markdown](https://www.npmjs.com/package/typedoc-plugin-markdown) and [TypeDoc](https://typedoc.org/)
