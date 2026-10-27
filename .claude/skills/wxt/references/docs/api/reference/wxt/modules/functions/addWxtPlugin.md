<!-- source: https://wxt.dev/api/reference/wxt/modules/functions/addWxtPlugin.md -->
[API](../../../packages.md) / [wxt/modules](../index.md) / addWxtPlugin

# Function: addWxtPlugin()

> **addWxtPlugin**(`wxt`, `plugin`, `apply?`): `void`

Source: [packages/wxt/src/modules/index.ts:145](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/modules/index.ts#L145)

Add a runtime plugin to the project. In each entrypoint, before executing the
`main` function, plugins are executed.

## Parameters

### wxt

[`Wxt`](../../interfaces/Wxt.md)

The wxt instance provided by the module's setup function.

### plugin

`string`

An import from an NPM module, or an absolute file path to the
file to load at runtime.

### apply?

(`entrypoint`) => `boolean`

Optional. Return `true` to load the plugin in the given
entrypoint. Defaults to loading the plugin in every entrypoint.

## Returns

`void`

## Example

```ts
export default defineWxtModule((wxt) => {
    addWxtPlugin(
      wxt,
      'wxt-module-analytics/background-plugin',
      (entrypoint) => entrypoint.type === 'background',
    );
  });
```

***

Generated using [typedoc-plugin-markdown](https://www.npmjs.com/package/typedoc-plugin-markdown) and [TypeDoc](https://typedoc.org/)
