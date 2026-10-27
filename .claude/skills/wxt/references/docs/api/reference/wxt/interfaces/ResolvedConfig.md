<!-- source: https://wxt.dev/api/reference/wxt/interfaces/ResolvedConfig.md -->
[API](../../packages.md) / [wxt](../index.md) / ResolvedConfig

# Interface: ResolvedConfig

Source: [packages/wxt/src/types.ts:512](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L512)

## Contents

* [Properties](#properties)
  * [alias](#alias)
  * [analysis](#analysis)
  * [browser](#browser)
  * [builtinModules](#builtinmodules)
  * [command](#command)
  * [debug](#debug)
  * [dev](#dev)
  * [entrypointsDir](#entrypointsdir)
  * [env](#env)
  * [experimental](#experimental)
  * [filterEntrypoints?](#filterentrypoints)
  * [fsCache](#fscache)
  * [hooks](#hooks)
  * [imports](#imports)
  * [logger](#logger)
  * [manifest](#manifest)
  * [manifestVersion](#manifestversion)
  * [mode](#mode)
  * [modulesDir](#modulesdir)
  * [outBaseDir](#outbasedir)
  * [outDir](#outdir)
  * [plugins](#plugins)
  * [publicDir](#publicdir)
  * [root](#root)
  * [runner](#runner)
  * [srcDir](#srcdir)
  * [suppressWarnings](#suppresswarnings)
  * [targetBrowsers](#targetbrowsers)
  * [typesDir](#typesdir)
  * [userConfigMetadata](#userconfigmetadata)
  * [userModules](#usermodules)
  * [vite](#vite)
  * [watchOptions](#watchoptions)
  * [webExt](#webext)
  * [wxtDir](#wxtdir)
  * [wxtModuleDir](#wxtmoduledir)
  * [zip](#zip)

## Properties

### alias

> **alias**: `Record`<`string`, `string`>

Source: [packages/wxt/src/types.ts:1640](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L1640)

Import aliases to absolute paths.

***

### analysis

> **analysis**: `object`

Source: [packages/wxt/src/types.ts:1626](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L1626)

#### enabled

> **enabled**: `boolean`

#### keepArtifacts

> **keepArtifacts**: `boolean`

#### open

> **open**: `boolean`

#### outputDir

> **outputDir**: `string`

The directory where the final `stats.html` file is located

#### outputFile

> **outputFile**: `string`

Absolute file path to the `stats.html` file

#### outputName

> **outputName**: `string`

Name of the `stats.html` file, minus ".html"

#### template

> **template**: `NonNullable`<`TemplateType` | `undefined`>

***

### browser

> **browser**: `string`

Source: [packages/wxt/src/types.ts:1600](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L1600)

***

### builtinModules

> **builtinModules**: [`WxtModule`](WxtModule.md)<`any`>\[]

Source: [packages/wxt/src/types.ts:1681](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L1681)

***

### command

> **command**: [`WxtCommand`](../type-aliases/WxtCommand.md)

Source: [packages/wxt/src/types.ts:1599](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L1599)

***

### debug

> **debug**: `boolean`

Source: [packages/wxt/src/types.ts:1592](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L1592)

***

### dev

> **dev**: `object`

Source: [packages/wxt/src/types.ts:1651](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L1651)

#### reloadCommand

> **reloadCommand**: `string` | `false`

#### server?

> `optional` **server?**: `object`

Only defined during dev command

##### server.host

> **host**: `string`

##### server.origin

> **origin**: `string`

##### server.port

> **port**: `number`

##### server.strictPort

> **strictPort**: `boolean`

##### server.watchDebounce

> **watchDebounce**: `number`

The milliseconds to debounce when a file is saved before reloading. The
only way to set this option is to set the `WXT_WATCH_DEBOUNCE`
environment variable, either globally (like in `.bashrc` file) or
per-project (in `.env` file).

For example:

```
# ~/.zshrc
export WXT_WATCH_DEBOUNCE=1000
```

Or

```
# .env
WXT_WATCH_DEBOUNCE=1000
```

###### Default

```ts
800
```

***

### entrypointsDir

> **entrypointsDir**: `string`

Source: [packages/wxt/src/types.ts:1575](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L1575)

***

### env

> **env**: [`ConfigEnv`](ConfigEnv.md)

Source: [packages/wxt/src/types.ts:1603](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L1603)

***

### experimental

> **experimental**: `object`

Source: [packages/wxt/src/types.ts:1641](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L1641)

#### escapeUnicode

> **escapeUnicode**: `boolean`

***

### filterEntrypoints?

> `optional` **filterEntrypoints?**: `Set`<`string`>

Source: [packages/wxt/src/types.ts:1577](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L1577)

***

### fsCache

> **fsCache**: [`FsCache`](FsCache.md)

Source: [packages/wxt/src/types.ts:1607](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L1607)

***

### hooks

> **hooks**: `NestedHooks`<[`WxtHooks`](WxtHooks.md)>

Source: [packages/wxt/src/types.ts:1680](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L1680)

***

### imports

> **imports**: [`WxtResolvedUnimportOptions`](../type-aliases/WxtResolvedUnimportOptions.md)

Source: [packages/wxt/src/types.ts:1605](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L1605)

***

### logger

> **logger**: [`WxtLogger`](WxtLogger.md)

Source: [packages/wxt/src/types.ts:1604](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L1604)

***

### manifest

> **manifest**: [`UserManifest`](../type-aliases/UserManifest.md)

Source: [packages/wxt/src/types.ts:1606](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L1606)

***

### manifestVersion

> **manifestVersion**: [`TargetManifestVersion`](../type-aliases/TargetManifestVersion.md)

Source: [packages/wxt/src/types.ts:1602](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L1602)

***

### mode

> **mode**: `string`

Source: [packages/wxt/src/types.ts:1598](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L1598)

***

### modulesDir

> **modulesDir**: `string`

Source: [packages/wxt/src/types.ts:1576](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L1576)

***

### outBaseDir

> **outBaseDir**: `string`

Source: [packages/wxt/src/types.ts:1584](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L1584)

Absolute path to the `.output` directory

#### Example

```ts
'/path/to/project/.output';
```

***

### outDir

> **outDir**: `string`

Source: [packages/wxt/src/types.ts:1591](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L1591)

Absolute path to the target output directory.

#### Example

```ts
'/path/to/project/.output/chrome-mv3';
```

***

### plugins

> **plugins**: (`string` | [`WxtPluginEntry`](WxtPluginEntry.md))\[]

Source: [packages/wxt/src/types.ts:1691](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L1691)

Plugins registered via `addWxtPlugin`. Each entry's `module` should be
resolvable by vite, and should `export default defineWxtPlugin(...)`. An
optional `apply` function restricts which entrypoints the plugin loads in.

#### Example

```ts
[{ module: '@wxt-dev/module-vue/plugin' }];
```

***

### publicDir

> **publicDir**: `string`

Source: [packages/wxt/src/types.ts:1566](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L1566)

***

### root

> **root**: `string`

Source: [packages/wxt/src/types.ts:1564](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L1564)

***

### ~~runner~~

> **runner**: [`ExtensionRunner`](ExtensionRunner.md)

Source: [packages/wxt/src/types.ts:1610](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L1610)

#### Deprecated

Use `wxt.runner` instead of `wxt.config.runner`

***

### srcDir

> **srcDir**: `string`

Source: [packages/wxt/src/types.ts:1565](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L1565)

***

### suppressWarnings

> **suppressWarnings**: `object`

Source: [packages/wxt/src/types.ts:1645](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L1645)

List of warning identifiers to suppress during the build process.

#### firefoxDataCollection?

> `optional` **firefoxDataCollection?**: `boolean`

#### firefoxId?

> `optional` **firefoxId?**: `boolean`

***

### targetBrowsers

> **targetBrowsers**: `string`\[]

Source: [packages/wxt/src/types.ts:1601](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L1601)

***

### typesDir

> **typesDir**: `string`

Source: [packages/wxt/src/types.ts:1574](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L1574)

***

### userConfigMetadata

> **userConfigMetadata**: `Omit`<`C12ResolvedConfig`<[`UserConfig`](../type-aliases/UserConfig.md)>, `"config"`>

Source: [packages/wxt/src/types.ts:1638](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L1638)

***

### userModules

> **userModules**: [`WxtModuleWithMetadata`](WxtModuleWithMetadata.md)<`any`>\[]

Source: [packages/wxt/src/types.ts:1682](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L1682)

***

### vite

> **vite**: (`env`) => [`WxtViteConfig`](../type-aliases/WxtViteConfig.md) | `Promise`<[`WxtViteConfig`](../type-aliases/WxtViteConfig.md)>

Source: [packages/wxt/src/types.ts:513](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L513)

#### Parameters

##### env

[`ConfigEnv`](ConfigEnv.md)

#### Returns

[`WxtViteConfig`](../type-aliases/WxtViteConfig.md) | `Promise`<[`WxtViteConfig`](../type-aliases/WxtViteConfig.md)>

***

### watchOptions

> **watchOptions**: `WatchOptions`

Source: [packages/wxt/src/types.ts:1650](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L1650)

Chokidar options used by dev-mode file watchers.

***

### webExt

> **webExt**: `ResolvedConfig`<[`WebExtConfig`](WebExtConfig.md)>

Source: [packages/wxt/src/types.ts:1608](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L1608)

***

### wxtDir

> **wxtDir**: `string`

Source: [packages/wxt/src/types.ts:1573](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L1573)

Absolute path pointing to `.wxt` directory in project root.

#### Example

```ts
'/path/to/project/.wxt';
```

***

### wxtModuleDir

> **wxtModuleDir**: `string`

Source: [packages/wxt/src/types.ts:1597](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L1597)

Absolute path pointing to the `node_modules/wxt` directory, wherever WXT is
installed.

***

### zip

> **zip**: `object`

Source: [packages/wxt/src/types.ts:1611](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L1611)

#### artifactTemplate

> **artifactTemplate**: `string`

#### compressionLevel

> **compressionLevel**: `0` | `1` | `2` | `3` | `4` | `5` | `6` | `7` | `8` | `9`

#### dotSources

> **dotSources**: `boolean`

#### downloadedPackagesDir

> **downloadedPackagesDir**: `string`

#### downloadPackages

> **downloadPackages**: `string`\[]

#### exclude

> **exclude**: `string`\[]

#### excludeSources

> **excludeSources**: `string`\[]

#### includeSources

> **includeSources**: `string`\[]

#### name?

> `optional` **name?**: `string`

#### sourcesRoot

> **sourcesRoot**: `string`

#### sourcesTemplate

> **sourcesTemplate**: `string`

#### zipSources

> **zipSources**: `boolean`

If true, when zipping the extension, also zip the sources.

***

Generated using [typedoc-plugin-markdown](https://www.npmjs.com/package/typedoc-plugin-markdown) and [TypeDoc](https://typedoc.org/)
