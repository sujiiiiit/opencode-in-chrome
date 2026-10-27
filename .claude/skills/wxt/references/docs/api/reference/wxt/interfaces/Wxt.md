<!-- source: https://wxt.dev/api/reference/wxt/interfaces/Wxt.md -->
[API](../../packages.md) / [wxt](../index.md) / Wxt

# Interface: Wxt

Source: [packages/wxt/src/types.ts:1515](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L1515)

## Contents

* [Properties](#properties)
  * [builder](#builder)
  * [config](#config)
  * [entrypointFinder](#entrypointfinder)
  * [hook](#hook)
  * [hooks](#hooks)
  * [logger](#logger)
  * [pm](#pm)
  * [reloadConfig](#reloadconfig)
  * [runner](#runner)
  * [server?](#server)

## Properties

### builder

> **builder**: [`WxtBuilder`](WxtBuilder.md)

Source: [packages/wxt/src/types.ts:1538](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L1538)

The module in charge of executing all the build steps.

To override the entire builder process, set this value in a module's
`setup` function or during the `config:resolved` hook.

```ts
wxt.build = new MyBuilder(wxt.config);
```

***

### config

> **config**: [`ResolvedConfig`](ResolvedConfig.md)

Source: [packages/wxt/src/types.ts:1516](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L1516)

***

### entrypointFinder

> **entrypointFinder**: [`EntrypointFinder`](EntrypointFinder.md)

Source: [packages/wxt/src/types.ts:1549](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L1549)

Service responsible for discovering entrypoints in a project.

To override how entrypoints are discovered, set this value in a module's
`setup` function or during the `config:resolved` hook.

```ts
wxt.entrypointFinder = new MyEntrypointFinder(wxt.config);
```

***

### hook

> **hook**: <`NameT`>(`name`, `function_`, `options?`) => () => `void`

Source: [packages/wxt/src/types.ts:1519](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L1519)

Alias for `wxt.hooks.hook(...)`.

#### Type Parameters

##### NameT

`NameT` *extends* `HookKeys`<[`WxtHooks`](WxtHooks.md)>

#### Parameters

##### name

`NameT`

##### function\_

`InferCallback`<[`WxtHooks`](WxtHooks.md), `NameT`>

##### options?

###### allowDeprecated?

`boolean`

#### Returns

() => `void`

***

### hooks

> **hooks**: `Hookable`<[`WxtHooks`](WxtHooks.md)>

Source: [packages/wxt/src/types.ts:1517](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L1517)

***

### logger

> **logger**: [`WxtLogger`](WxtLogger.md)

Source: [packages/wxt/src/types.ts:1521](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L1521)

Alias for `config.logger`.

***

### pm

> **pm**: [`WxtPackageManager`](WxtPackageManager.md)

Source: [packages/wxt/src/types.ts:1525](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L1525)

Package manager utilities.

***

### reloadConfig

> **reloadConfig**: () => `Promise`<`void`>

Source: [packages/wxt/src/types.ts:1523](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L1523)

Reload config file and update `wxt.config` with the result.

#### Returns

`Promise`<`void`>

***

### runner

> **runner**: [`ExtensionRunner`](ExtensionRunner.md)

Source: [packages/wxt/src/types.ts:1560](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L1560)

Service responsible for opening the browser during dev mode.

To override how the browser is opened, set this value in a module's `setup`
function or during the `config:resolved` hook.

```ts
wxt.runner = new MyRunner(wxt.config);
```

***

### server?

> `optional` **server?**: [`WxtDevServer`](WxtDevServer.md)

Source: [packages/wxt/src/types.ts:1527](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L1527)

If the dev server was started, it will be available.

***

Generated using [typedoc-plugin-markdown](https://www.npmjs.com/package/typedoc-plugin-markdown) and [TypeDoc](https://typedoc.org/)
