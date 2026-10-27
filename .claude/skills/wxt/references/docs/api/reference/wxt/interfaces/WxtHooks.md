<!-- source: https://wxt.dev/api/reference/wxt/interfaces/WxtHooks.md -->
[API](../../packages.md) / [wxt](../index.md) / WxtHooks

# Interface: WxtHooks

Source: [packages/wxt/src/types.ts:523](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L523)

## Contents

* [Properties](#properties)
  * [build:before](#build-before)
  * [build:done](#build-done)
  * [build:manifestGenerated](#build-manifestgenerated)
  * [build:publicAssets](#build-publicassets)
  * [config:resolved](#config-resolved)
  * [entrypoints:found](#entrypoints-found)
  * [entrypoints:grouped](#entrypoints-grouped)
  * [entrypoints:resolved](#entrypoints-resolved)
  * [prepare:publicPaths](#prepare-publicpaths)
  * [prepare:tsconfig](#prepare-tsconfig)
  * [prepare:types](#prepare-types)
  * [ready](#ready)
  * [server:closed](#server-closed)
  * [server:created](#server-created)
  * [server:started](#server-started)
  * [vite:build:extendConfig](#vite-build-extendconfig)
  * [vite:devServer:extendConfig](#vite-devserver-extendconfig)
  * [zip:done](#zip-done)
  * [zip:extension:done](#zip-extension-done)
  * [zip:extension:start](#zip-extension-start)
  * [zip:sources:done](#zip-sources-done)
  * [zip:sources:start](#zip-sources-start)
  * [zip:start](#zip-start)

## Properties

### build:before

> **build:before**: (`wxt`) => [`HookResult`](../type-aliases/HookResult.md)

Source: [packages/wxt/src/types.ts:1396](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L1396)

Called before the build is started in both dev mode and build mode.

#### Parameters

##### wxt

[`Wxt`](Wxt.md)

The configured WXT object

#### Returns

[`HookResult`](../type-aliases/HookResult.md)

***

### build:done

> **build:done**: (`wxt`, `output`) => [`HookResult`](../type-aliases/HookResult.md)

Source: [packages/wxt/src/types.ts:1404](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L1404)

Called once the build process has finished. You can add files to the build
summary here by pushing to `output.publicAssets`.

#### Parameters

##### wxt

[`Wxt`](Wxt.md)

The configured WXT object

##### output

`Readonly`<[`BuildOutput`](BuildOutput.md)>

The results of the build

#### Returns

[`HookResult`](../type-aliases/HookResult.md)

***

### build:manifestGenerated

> **build:manifestGenerated**: (`wxt`, `manifest`) => [`HookResult`](../type-aliases/HookResult.md)

Source: [packages/wxt/src/types.ts:1412](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L1412)

Called once the manifest has been generated. Used to transform the manifest
by reference before it is written to the output directory.

#### Parameters

##### wxt

[`Wxt`](Wxt.md)

The configured WXT object

##### manifest

`Manifest`

The manifest that was generated

#### Returns

[`HookResult`](../type-aliases/HookResult.md)

***

### build:publicAssets

> **build:publicAssets**: (`wxt`, `files`) => [`HookResult`](../type-aliases/HookResult.md)

Source: [packages/wxt/src/types.ts:1448](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L1448)

Called when public assets are found. You can modify the `files` list by
reference to add or remove public files.

#### Parameters

##### wxt

[`Wxt`](Wxt.md)

The configured WXT object

##### files

[`ResolvedPublicFile`](../type-aliases/ResolvedPublicFile.md)\[]

The list of files that will be copied into the output
directory

#### Returns

[`HookResult`](../type-aliases/HookResult.md)

***

### config:resolved

> **config:resolved**: (`wxt`) => [`HookResult`](../type-aliases/HookResult.md)

Source: [packages/wxt/src/types.ts:1338](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L1338)

Called whenever config is loaded or reloaded. Use this hook to modify
config by modifying `wxt.config`.

#### Parameters

##### wxt

[`Wxt`](Wxt.md)

The configured WXT object

#### Returns

[`HookResult`](../type-aliases/HookResult.md)

***

### entrypoints:found

> **entrypoints:found**: (`wxt`, `infos`) => [`HookResult`](../type-aliases/HookResult.md)

Source: [packages/wxt/src/types.ts:1423](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L1423)

Called once the names and paths of all entrypoints have been resolved.

#### Parameters

##### wxt

[`Wxt`](Wxt.md)

The configured WXT object

##### infos

[`EntrypointInfo`](EntrypointInfo.md)\[]

List of entrypoints found in the project's `entrypoints`
directory

#### Returns

[`HookResult`](../type-aliases/HookResult.md)

***

### entrypoints:grouped

> **entrypoints:grouped**: (`wxt`, `groups`) => [`HookResult`](../type-aliases/HookResult.md)

Source: [packages/wxt/src/types.ts:1439](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L1439)

Called once all entrypoints have been grouped into their build groups.

#### Parameters

##### wxt

[`Wxt`](Wxt.md)

The configured WXT object

##### groups

[`EntrypointGroup`](../type-aliases/EntrypointGroup.md)\[]

The list of groups to build in each build step

#### Returns

[`HookResult`](../type-aliases/HookResult.md)

***

### entrypoints:resolved

> **entrypoints:resolved**: (`wxt`, `entrypoints`) => [`HookResult`](../type-aliases/HookResult.md)

Source: [packages/wxt/src/types.ts:1432](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L1432)

Called once all entrypoints have been loaded from the `entrypointsDir`. Use
`wxt.builder.importEntrypoint` to load entrypoint options from the file, or
manually define them.

#### Parameters

##### wxt

[`Wxt`](Wxt.md)

The configured WXT object

##### entrypoints

[`Entrypoint`](../type-aliases/Entrypoint.md)\[]

The list of entrypoints to be built

#### Returns

[`HookResult`](../type-aliases/HookResult.md)

***

### prepare:publicPaths

> **prepare:publicPaths**: (`wxt`, `paths`) => [`HookResult`](../type-aliases/HookResult.md)

Source: [packages/wxt/src/types.ts:1390](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L1390)

Called before generating the list of public paths inside
`.wxt/types/paths.d.ts`. Use this hook to add additional paths (relative to
output directory) WXT doesn't add automatically.

#### Parameters

##### wxt

[`Wxt`](Wxt.md)

The configured WXT object

##### paths

[`PublicPathEntry`](../type-aliases/PublicPathEntry.md)\[]

This list of paths TypeScript allows `browser.runtime.getURL`
to be called with.

#### Returns

[`HookResult`](../type-aliases/HookResult.md)

#### Example

```ts
wxt.hooks.hook('prepare:publicPaths', (wxt, paths) => {
    paths.push('icons/128.png');
    paths.push({
      type: 'templateLiteral',
      path: '_favicon/?${string}',
    });
  });
```

***

### prepare:tsconfig

> **prepare:tsconfig**: (`wxt`, `configs`) => [`HookResult`](../type-aliases/HookResult.md)

Source: [packages/wxt/src/types.ts:1371](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L1371)

Called before WXT writes your tsconfig to the disk, allowing full
customization by modifying the object by reference.

#### Parameters

##### wxt

[`Wxt`](Wxt.md)

##### configs

[`PrepareTsconfigs`](../type-aliases/PrepareTsconfigs.md)

#### Returns

[`HookResult`](../type-aliases/HookResult.md)

#### Since

0.20.28

#### Example

```ts
wxt.hooks.hook('prepare:tsconfig', (wxt, { tsconfig }) => {
    tsconfig.compilerOptions.lib.push('WebWorker');
  });
```

***

### prepare:types

> **prepare:types**: (`wxt`, `entries`) => [`HookResult`](../type-aliases/HookResult.md)

Source: [packages/wxt/src/types.ts:1360](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L1360)

Called before WXT writes .wxt/tsconfig.json and .wxt/wxt.d.ts, allowing
addition of custom references and declarations in wxt.d.ts, or directly
modifying the options in `tsconfig.json`.

#### Parameters

##### wxt

[`Wxt`](Wxt.md)

##### entries

[`WxtDirEntry`](../type-aliases/WxtDirEntry.md)\[]

#### Returns

[`HookResult`](../type-aliases/HookResult.md)

#### Example

```ts
wxt.hooks.hook('prepare:types', (wxt, entries) => {
    // Add a file, ".wxt/types/example.d.ts", that defines a global
    // variable called "example" in the TS project.
    entries.push({
      path: 'types/example.d.ts',
      text: 'declare const a: string;',
      tsReference: true,
    });
    // use module to add Triple-Slash Directive in .wxt/wxt.d.ts
    // eg: /// <reference types="@types/example" />
    entries.push({
      module: '@types/example',
    });
  });
```

***

### ready

> **ready**: (`wxt`) => [`HookResult`](../type-aliases/HookResult.md)

Source: [packages/wxt/src/types.ts:1331](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L1331)

Called after WXT modules are initialized, when the WXT instance is ready to
be used. `wxt.server` isn't available yet, use `server:created` to get it.

#### Parameters

##### wxt

[`Wxt`](Wxt.md)

The configured WXT object

#### Returns

[`HookResult`](../type-aliases/HookResult.md)

***

### server:closed

> **server:closed**: (`wxt`, `server`) => [`HookResult`](../type-aliases/HookResult.md)

Source: [packages/wxt/src/types.ts:1512](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L1512)

Called when the dev server is stopped.

#### Parameters

##### wxt

[`Wxt`](Wxt.md)

The configured WXT object

##### server

[`WxtDevServer`](WxtDevServer.md)

Same as `wxt.server`, the object WXT uses to control the dev
server.

#### Returns

[`HookResult`](../type-aliases/HookResult.md)

***

### server:created

> **server:created**: (`wxt`, `server`) => [`HookResult`](../type-aliases/HookResult.md)

Source: [packages/wxt/src/types.ts:1496](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L1496)

Called when the dev server is created (and `wxt.server` is assigned).
Server has not been started yet.

#### Parameters

##### wxt

[`Wxt`](Wxt.md)

The configured WXT object

##### server

[`WxtDevServer`](WxtDevServer.md)

Same as `wxt.server`, the object WXT uses to control the dev
server.

#### Returns

[`HookResult`](../type-aliases/HookResult.md)

***

### server:started

> **server:started**: (`wxt`, `server`) => [`HookResult`](../type-aliases/HookResult.md)

Source: [packages/wxt/src/types.ts:1504](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L1504)

Called when the dev server is started.

#### Parameters

##### wxt

[`Wxt`](Wxt.md)

The configured WXT object

##### server

[`WxtDevServer`](WxtDevServer.md)

Same as `wxt.server`, the object WXT uses to control the dev
server.

#### Returns

[`HookResult`](../type-aliases/HookResult.md)

***

### vite:build:extendConfig

> **vite:build:extendConfig**: (`entrypoints`, `viteConfig`) => [`HookResult`](../type-aliases/HookResult.md)

Source: [packages/wxt/src/types.ts:532](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L532)

Called when WXT has created Vite's config for a build step. Useful if you
want to add plugins or update the vite config per entrypoint group.

#### Parameters

##### entrypoints

readonly [`Entrypoint`](../type-aliases/Entrypoint.md)\[]

The list of entrypoints being built with the provided
config.

##### viteConfig

`InlineConfig`

The config that will be used for the dev server.

#### Returns

[`HookResult`](../type-aliases/HookResult.md)

***

### vite:devServer:extendConfig

> **vite:devServer:extendConfig**: (`config`) => [`HookResult`](../type-aliases/HookResult.md)

Source: [packages/wxt/src/types.ts:543](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L543)

Called when WXT has created Vite's config for the dev server. Useful if you
want to add plugins or update the vite config per entrypoint group.

#### Parameters

##### config

`InlineConfig`

The config that will be used to build the entrypoints. Can be
updated by reference.

#### Returns

[`HookResult`](../type-aliases/HookResult.md)

***

### zip:done

> **zip:done**: (`wxt`, `zipFiles`) => [`HookResult`](../type-aliases/HookResult.md)

Source: [packages/wxt/src/types.ts:1487](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L1487)

Called after the entire zip process is complete.

#### Parameters

##### wxt

[`Wxt`](Wxt.md)

The configured WXT object

##### zipFiles

`string`\[]

An array of paths to all created zip files

#### Returns

[`HookResult`](../type-aliases/HookResult.md)

***

### zip:extension:done

> **zip:extension:done**: (`wxt`, `zipPath`) => [`HookResult`](../type-aliases/HookResult.md)

Source: [packages/wxt/src/types.ts:1467](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L1467)

Called after zipping the extension files.

#### Parameters

##### wxt

[`Wxt`](Wxt.md)

The configured WXT object

##### zipPath

`string`

The path to the created extension zip file

#### Returns

[`HookResult`](../type-aliases/HookResult.md)

***

### zip:extension:start

> **zip:extension:start**: (`wxt`) => [`HookResult`](../type-aliases/HookResult.md)

Source: [packages/wxt/src/types.ts:1460](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L1460)

Called before zipping the extension files.

#### Parameters

##### wxt

[`Wxt`](Wxt.md)

The configured WXT object

#### Returns

[`HookResult`](../type-aliases/HookResult.md)

***

### zip:sources:done

> **zip:sources:done**: (`wxt`, `zipPath`) => [`HookResult`](../type-aliases/HookResult.md)

Source: [packages/wxt/src/types.ts:1480](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L1480)

Called after zipping the source files (for Firefox).

#### Parameters

##### wxt

[`Wxt`](Wxt.md)

The configured WXT object

##### zipPath

`string`

The path to the created sources zip file

#### Returns

[`HookResult`](../type-aliases/HookResult.md)

***

### zip:sources:start

> **zip:sources:start**: (`wxt`) => [`HookResult`](../type-aliases/HookResult.md)

Source: [packages/wxt/src/types.ts:1473](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L1473)

Called before zipping the source files (for Firefox).

#### Parameters

##### wxt

[`Wxt`](Wxt.md)

The configured WXT object

#### Returns

[`HookResult`](../type-aliases/HookResult.md)

***

### zip:start

> **zip:start**: (`wxt`) => [`HookResult`](../type-aliases/HookResult.md)

Source: [packages/wxt/src/types.ts:1454](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L1454)

Called before the zip process starts.

#### Parameters

##### wxt

[`Wxt`](Wxt.md)

The configured WXT object

#### Returns

[`HookResult`](../type-aliases/HookResult.md)

***

Generated using [typedoc-plugin-markdown](https://www.npmjs.com/package/typedoc-plugin-markdown) and [TypeDoc](https://typedoc.org/)
