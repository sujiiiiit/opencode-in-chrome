<!-- source: https://wxt.dev/api/reference/wxt/interfaces/BaseScriptEntrypointOptions.md -->
[API](../../packages.md) / [wxt](../index.md) / BaseScriptEntrypointOptions

# Interface: BaseScriptEntrypointOptions

Source: [packages/wxt/src/types.ts:690](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L690)

## Contents

* [Extends](#extends)
* [Extended by](#extended-by)
* [Properties](#properties)
  * [exclude?](#exclude)
  * [globalName?](#globalname)
  * [include?](#include)

## Extends

* [`BaseEntrypointOptions`](BaseEntrypointOptions.md)

## Extended by

* [`BaseContentScriptEntrypointOptions`](BaseContentScriptEntrypointOptions.md)
* [`UnlistedScriptDefinition`](UnlistedScriptDefinition.md)

## Properties

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

[`BaseEntrypointOptions`](BaseEntrypointOptions.md).[`exclude`](BaseEntrypointOptions.md#exclude)

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

[`BaseEntrypointOptions`](BaseEntrypointOptions.md).[`include`](BaseEntrypointOptions.md#include)

***

Generated using [typedoc-plugin-markdown](https://www.npmjs.com/package/typedoc-plugin-markdown) and [TypeDoc](https://typedoc.org/)
