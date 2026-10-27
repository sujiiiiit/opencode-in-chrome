<!-- source: https://wxt.dev/api/reference/wxt/interfaces/BaseEntrypointOptions.md -->
[API](../../packages.md) / [wxt](../index.md) / BaseEntrypointOptions

# Interface: BaseEntrypointOptions

Source: [packages/wxt/src/types.ts:658](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L658)

## Contents

* [Extended by](#extended-by)
* [Properties](#properties)
  * [exclude?](#exclude)
  * [include?](#include)

## Extended by

* [`BackgroundEntrypointOptions`](BackgroundEntrypointOptions.md)
* [`BaseScriptEntrypointOptions`](BaseScriptEntrypointOptions.md)
* [`PopupEntrypointOptions`](PopupEntrypointOptions.md)
* [`OptionsEntrypointOptions`](OptionsEntrypointOptions.md)
* [`SidepanelEntrypointOptions`](SidepanelEntrypointOptions.md)

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

***

Generated using [typedoc-plugin-markdown](https://www.npmjs.com/package/typedoc-plugin-markdown) and [TypeDoc](https://typedoc.org/)
