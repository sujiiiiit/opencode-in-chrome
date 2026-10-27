<!-- source: https://wxt.dev/api/reference/wxt/interfaces/InlineConfig.md -->
[API](../../packages.md) / [wxt](../index.md) / InlineConfig

# Interface: InlineConfig

Source: [packages/wxt/src/types.ts:12](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L12)

## Contents

* [Properties](#properties)
  * [alias?](#alias)
  * [analysis?](#analysis)
  * [browser?](#browser)
  * [configFile?](#configfile)
  * [debug?](#debug)
  * [dev?](#dev)
  * [entrypointsDir?](#entrypointsdir)
  * [experimental?](#experimental)
  * [filterEntrypoints?](#filterentrypoints)
  * [hooks?](#hooks)
  * [imports?](#imports)
  * [logger?](#logger)
  * [manifest?](#manifest)
  * [manifestVersion?](#manifestversion)
  * [mode?](#mode)
  * [modules?](#modules)
  * [modulesDir?](#modulesdir)
  * [outDir?](#outdir)
  * [outDirTemplate?](#outdirtemplate)
  * [publicDir?](#publicdir)
  * [root?](#root)
  * [srcDir?](#srcdir)
  * [suppressWarnings?](#suppresswarnings)
  * [targetBrowsers?](#targetbrowsers)
  * [vite?](#vite)
  * [watchOptions?](#watchoptions)
  * [webExt?](#webext)
  * [zip?](#zip)

## Properties

### alias?

> `optional` **alias?**: `Record`<`string`, `string`>

Source: [packages/wxt/src/types.ts:421](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L421)

Add additional paths to the `.wxt/tsconfig.json`. Use this instead of
overwriting the `paths` in the root `tsconfig.json` if you want to add new
paths.

The key is the import alias and the value is either a relative path to the
root directory or an absolute path.

#### Example

```ts
{ "testing": "src/utils/testing.ts" }
```

***

### analysis?

> `optional` **analysis?**: `object`

Source: [packages/wxt/src/types.ts:363](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L363)

#### enabled?

> `optional` **enabled?**: `boolean`

Explicitly include bundle analysis when running `wxt build`. This can be
overridden by the command line `--analyze` option.

##### Default

```ts
false
```

#### keepArtifacts?

> `optional` **keepArtifacts?**: `boolean`

By default, the `stats-*.json` artifacts generated during bundle analysis
are deleted. Set to `true` to keep them.

One stats file is output per build step.

##### Default

```ts
false
```

#### open?

> `optional` **open?**: `boolean`

Set to true to automatically open the `stats.html` file when the build is
finished. When building in CI, the browser will never open.

##### Default

```ts
false
```

#### outputFile?

> `optional` **outputFile?**: `string`

Name of the output HTML file. Relative to the project's root directory.

Changing the filename of the outputFile also effects the names of the
artifacts generated when setting `keepArtifacts` to true:

* "stats.html" => "stats-\*.json"
* "stats/bundle.html" => "bundle-\*.json"
* ".analysis/index.html" => "index-\*.json"

##### Default

```ts
'stats.html'
```

#### template?

> `optional` **template?**: `TemplateType`

When running `wxt build --analyze` or setting `analysis.enabled` to true,
customize how the bundle will be visualized. See
[`rollup-plugin-visualizer`](https://github.com/btd/rollup-plugin-visualizer#how-to-use-generated-files)
for more details.

##### Default

```ts
'treemap'
```

***

### browser?

> `optional` **browser?**: `string`

Source: [packages/wxt/src/types.ts:119](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L119)

Explicitly set a browser to build for. This will override the default
browser for each command, and can be overridden by the command line
`--browser` option.

#### Default

```ts
"chrome"
```

***

### configFile?

> `optional` **configFile?**: `string` | `false`

Source: [packages/wxt/src/types.ts:84](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L84)

> Only available when using the JS API. Not available in `wxt.config.ts`
> files

Path to `wxt.config.ts` file or `false` to disable config file discovery.

#### Default

```ts
'wxt.config.ts'
```

***

### debug?

> `optional` **debug?**: `boolean`

Source: [packages/wxt/src/types.ts:91](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L91)

Set to `true` to show debug logs. Overridden by the command line `--debug`
option.

#### Default

```ts
false
```

***

### dev?

> `optional` **dev?**: `object`

Source: [packages/wxt/src/types.ts:441](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L441)

Config effecting dev mode only.

#### reloadCommand?

> `optional` **reloadCommand?**: `string` | `false`

Controls whether a custom keyboard shortcut command, `Alt+R`, is added
during dev mode to quickly reload the extension.

If false, the shortcut is not added during development.

If set to a custom string, you can override the key combo used. See
[Chrome's command
docs](https://developer.chrome.com/docs/extensions/reference/api/commands)
for available options.

##### Default

```ts
'Alt+R'
```

#### server?

> `optional` **server?**: `object`

##### server.host?

> `optional` **host?**: `string`

Host to bind the dev server to.

###### Default

```ts
'localhost'
```

##### server.origin?

> `optional` **origin?**: `string`

Origin to use to connect from the extension ui runtime to the dev
server.

###### Default

```ts
'http://localhost:3000'
```

##### server.port?

> `optional` **port?**: `number`

Port to run the dev server on. Defaults to the first open port from
3000 to 3010.

##### server.strictPort?

> `optional` **strictPort?**: `boolean`

Whether the dev server should fail if the specified port is already in
use. When `false` and a `port` is specified, the next available port
will be used instead of throwing an error.

###### Default

```ts
false
```

***

### entrypointsDir?

> `optional` **entrypointsDir?**: `string`

Source: [packages/wxt/src/types.ts:38](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L38)

#### Default

```ts
'${config.srcDir}/entrypoints'
```

***

### experimental?

> `optional` **experimental?**: `object`

Source: [packages/wxt/src/types.ts:423](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L423)

Experimental settings - use with caution.

#### escapeUnicode?

> `optional` **escapeUnicode?**: `boolean`

Some libraries include unicode characters Chrome does not allow in
extensions. If you receive "Could not load content script... it is not
UTF-8 encoded", enable this setting.

It is not enabled by default because it will slow down your build, and
because it's very rare to have the problematic characters in JS. So not
every extension needs this flag enabled.

For more details, see:

* https://github.com/wxt-dev/wxt/issues/353
* https://github.com/wxt-dev/wxt/issues/2535

***

### filterEntrypoints?

> `optional` **filterEntrypoints?**: `string`\[]

Source: [packages/wxt/src/types.ts:48](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L48)

A list of entrypoint names (`"popup"`, `"options"`, etc.) to build. Will
speed up the build if your extension has lots of entrypoints, and you don't
need to build all of them to develop a feature. If specified, this
completely overrides the `include`/`exclude` option provided
per-entrypoint.

***

### hooks?

> `optional` **hooks?**: `NestedHooks`<[`WxtHooks`](WxtHooks.md)>

Source: [packages/wxt/src/types.ts:486](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L486)

Project hooks for running logic during the build process.

***

### imports?

> `optional` **imports?**: `false` | [`WxtUnimportOptions`](../type-aliases/WxtUnimportOptions.md)

Source: [packages/wxt/src/types.ts:110](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L110)

Customize auto-import options. Set to `false` to disable auto-imports.

For example, to add a directory to auto-import from, you can use:

```ts
export default defineConfig({
  imports: {
    dirs: ['some-directory'],
  },
});
```

***

### logger?

> `optional` **logger?**: [`Logger`](Logger.md)

Source: [packages/wxt/src/types.ts:154](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L154)

Override the logger used.

#### Default

```ts
consola
```

***

### manifest?

> `optional` **manifest?**: [`UserManifest`](../type-aliases/UserManifest.md) | `Promise`<[`UserManifest`](../type-aliases/UserManifest.md)> | [`UserManifestFn`](../type-aliases/UserManifestFn.md)

Source: [packages/wxt/src/types.ts:159](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L159)

Customize the `manifest.json` output. Can be an object, promise, or
function that returns an object or promise.

***

### manifestVersion?

> `optional` **manifestVersion?**: [`TargetManifestVersion`](../type-aliases/TargetManifestVersion.md)

Source: [packages/wxt/src/types.ts:133](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L133)

Explicitly set a manifest version to target. This will override the default
manifest version for each command, and can be overridden by the command
line `--mv2` or `--mv3` option.

***

### mode?

> `optional` **mode?**: `string`

Source: [packages/wxt/src/types.ts:96](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L96)

Explicitly set a mode to run in. This will override the default mode for
each command, and can be overridden by the command line `--mode` option.

***

### modules?

> `optional` **modules?**: `string`\[]

Source: [packages/wxt/src/types.ts:492](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L492)

List of WXT module names to include. Can be the full package name
("wxt-module-analytics"), or just the suffix ("analytics" would resolve to
"wxt-module-analytics").

***

### modulesDir?

> `optional` **modulesDir?**: `string`

Source: [packages/wxt/src/types.ts:40](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L40)

#### Default

```ts
'${config.root}/modules'
```

***

### outDir?

> `optional` **outDir?**: `string`

Source: [packages/wxt/src/types.ts:54](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L54)

Output directory that stored build folders and ZIPs.

#### Default

```ts
'.output'
```

***

### outDirTemplate?

> `optional` **outDirTemplate?**: `string`

Source: [packages/wxt/src/types.ts:75](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L75)

Template string for customizing the output directory structure. Available
variables:

* `{{browser}}`: The target browser (e.g., 'chrome',
  'firefox')
* `{{manifestVersion}}`: The manifest version (e.g., 2 or
  3\)
* `{{mode}}`: The build mode (e.g., 'development',
  'production')
* `{{modeSuffix}}`: A suffix based on the mode ('-dev' for
  development, '' for production)
* `{{command}}`: The WXT command being run (e.g., 'build',
  'serve')

#### Example

```ts
'{{browser}}-mv{{manifestVersion}}';
```

#### Default

`"{{browser}}-mv{{manifestVersion}}{{modeSuffix}}"`

***

### publicDir?

> `optional` **publicDir?**: `string`

Source: [packages/wxt/src/types.ts:36](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L36)

Directory containing files that will be copied to the output directory
as-is.

#### Default

```ts
'${config.root}/public'
```

***

### root?

> `optional` **root?**: `string`

Source: [packages/wxt/src/types.ts:19](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L19)

Your project's root directory containing the `package.json` used to fill
out the `manifest.json`.

#### Default

```ts
process.cwd()
```

***

### srcDir?

> `optional` **srcDir?**: `string`

Source: [packages/wxt/src/types.ts:29](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L29)

Directory containing all source code. Set to `"src"` to move all source
code to a `src/` directory.

After changing, remember to move the `public/` and `entrypoints/`
directories into the new source dir.

#### Default

```ts
config.root
```

***

### suppressWarnings?

> `optional` **suppressWarnings?**: `object`

Source: [packages/wxt/src/types.ts:170](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L170)

Suppress specific warnings during the build process.

#### firefoxDataCollection?

> `optional` **firefoxDataCollection?**: `boolean`

Suppress warnings for:
https://extensionworkshop.com/documentation/develop/firefox-builtin-data-consent

#### firefoxId?

> `optional` **firefoxId?**: `boolean`

Suppress warnings when the Firefox extension ID is missing.
https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/browser\_specific\_settings#id

#### Example

```ts
export default defineConfig({
    suppressWarnings: {
      firefoxDataCollection: true,
    },
  });
```

***

### targetBrowsers?

> `optional` **targetBrowsers?**: `string`\[]

Source: [packages/wxt/src/types.ts:127](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L127)

Target browsers to support. When set, `import.meta.env.BROWSER` will be
narrowed to a string literal type containing only the specified browser
names.

#### Default

```ts
[ ]
```

***

### vite?

> `optional` **vite?**: (`env`) => [`WxtViteConfig`](../type-aliases/WxtViteConfig.md) | `Promise`<[`WxtViteConfig`](../type-aliases/WxtViteConfig.md)>

Source: [packages/wxt/src/types.ts:508](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L508)

Return custom Vite options from a function. See
<https://vitejs.dev/config/shared-options.html>.

[`root`](#root), [`configFile`](#configfile), and [`mode`](#mode) should be
set in WXT's config instead of Vite's.

This is a function because any vite plugins added need to be recreated for
each individual build step, in case they have internal state causing them
to fail when reused.

#### Parameters

##### env

[`ConfigEnv`](ConfigEnv.md)

#### Returns

[`WxtViteConfig`](../type-aliases/WxtViteConfig.md) | `Promise`<[`WxtViteConfig`](../type-aliases/WxtViteConfig.md)>

***

### watchOptions?

> `optional` **watchOptions?**: `WatchOptions`

Source: [packages/wxt/src/types.ts:147](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L147)

Chokidar options used by dev-mode file watchers. This is useful in
containers, WSL, and network file systems where native file events can be
unreliable.

#### Example

```ts
export default defineConfig({
    watchOptions: {
      usePolling: true,
      interval: 1000,
    },
  });
```

***

### webExt?

> `optional` **webExt?**: [`WebExtConfig`](WebExtConfig.md)

Source: [packages/wxt/src/types.ts:186](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L186)

Configure browser startup. Options set here can be overridden in a
`web-ext.config.ts` file.

***

### zip?

> `optional` **zip?**: `object`

Source: [packages/wxt/src/types.ts:187](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L187)

#### artifactTemplate?

> `optional` **artifactTemplate?**: `string`

Configure the filename output when zipping files.

Available template variables:

* `{{name}}` - The project's name converted to
  kebab-case
* `{{version}}` - The version from the manifest
* `{{versionName}}` - The `version_name` from the
  manifest or, if not set (i.e. if built for Firefox), the `version` from
  the manifest
* `{{packageVersion}}` - The version from the
  package.json
* `{{browser}}` - The target browser from the
  `--browser` CLI flag
* `{{mode}}` - The current mode
* `{{modeSuffix}}`: A suffix based on the mode ('-dev'
  for development, '' for production)
* `{{manifestVersion}}` - Either "2" or "3"

##### Default

```ts
'{{name}}-{{packageVersion}}-{{browser}}{{modeSuffix}}.zip'
```

#### compressionLevel?

> `optional` **compressionLevel?**: `0` | `7` | `3` | `1` | `2` | `8` | `4` | `5` | `6` | `9`

Compression level to use when zipping files.

Levels: 0 (no compression) to 9 (maximum compression).

##### Default

```ts
9
```

#### dotSources?

> `optional` **dotSources?**: `boolean`

Include hidden files/directories in your sources ZIP.

[Tinyglobby](https://npmjs.org/tinyglobby) does not match against files
and directory that start with a `.` by default. For example, if you need
to include a `.env` file, you need to set this to `true`, then exclude
other hidden files/directories in `excludeSources`.

**Be very careful when this is enabled - WXT may include files with
secrets in your ZIP you did not intend to share with Mozilla or upload to
other places**. Make sure all hidden files you don't want to include are
added to `excludeSources`.

##### Default

```ts
false
```

#### downloadPackages?

> `optional` **downloadPackages?**: `string`\[]

The Firefox review process requires the extension be buildable from
source to make reviewing easier. This field allows you to use private
packages without exposing your auth tokens.

Just list the name of all the packages you want to download and include
in the sources zip. Usually, these will be private packages behind auth
tokens, but they don't have to be.

All packages listed here will be downloaded to in `.wxt/local_modules/`
and an `overrides` or `resolutions` field (depending on your package
manager) will be added to the `package.json`, pointing to the downloaded
packages.

> ***DO NOT include versions or version filters.*** Just the package name.
> If multiple versions of a package are present in the project, all
> versions will be downloaded and referenced in the package.json
> correctly.

##### Example

```ts
// Correct:
  ['@scope/package-name', 'package-name'];

  // Incorrect, don't include versions!!!
  ['@scope/package-name@1.1.3', 'package-name@^2'];
```

##### Default

```ts
[ ]
```

#### exclude?

> `optional` **exclude?**: `string`\[]

[Tinyglobby](https://npmjs.org/tinyglobby) patterns of files to exclude
when zipping the extension.

##### Example

```ts
[
    '**/*.map', // Exclude all sourcemaps
  ];
```

##### Default

```ts
[ ]
```

#### excludeSources?

> `optional` **excludeSources?**: `string`\[]

[Tinyglobby](https://npmjs.org/tinyglobby) patterns of files to exclude
when creating a ZIP of all your source code for Firefox. Patterns are
relative to your `config.zip.sourcesRoot`.

By default, WXT excludes some files:

* `node_modules`
* Tests files and directories
* Output directory

Any values specified in this option will be merged with the ones above -
you cannot replace the default values, only add to them.

##### Example

```ts
[
    'coverage', // Ignore the coverage directory in the `sourcesRoot`
  ];
```

#### includeSources?

> `optional` **includeSources?**: `string`\[]

[Tinyglobby](https://npmjs.org/tinyglobby) patterns of files to include
when creating a ZIP of all your source code for Firefox. Patterns are
relative to your `config.zip.sourcesRoot`.

Sources ZIP files are created using standard allowlist/blocklist
behavior:

* You specify a pattern to "include" (via `includeSources`), then a pattern
  to "exclude" from the included files (via `excludeSources`).

By default, this option includes all files except for hidden files and
directories (files/directories starting with a `.`).

If you want to include hidden files/directories in your sources ZIP, see
`InlineConfig.zip.dotSources`.

##### Example

```ts
['entrypoints/**', 'wxt.config.ts', 'package.json', 'tsconfig.json'];
```

#### name?

> `optional` **name?**: `string`

Override the artifactTemplate's `{name}` template variable. Defaults to
the `package.json`'s name, or if that doesn't exist, the current working
directories name.

#### sourcesRoot?

> `optional` **sourcesRoot?**: `string`

Root directory to ZIP when generating the sources ZIP.

##### Default

```ts
config.root
```

#### sourcesTemplate?

> `optional` **sourcesTemplate?**: `string`

Configure the filename output when zipping files.

Available template variables:

* `{{name}}` - The project's name converted to
  kebab-case
* `{{version}}` - The version from the manifest
* `{{versionName}}` - The `version_name` from the
  manifest or, if not set (i.e. if built for Firefox), the `version` from
  the manifest
* `{{packageVersion}}` - The version from the
  package.json
* `{{browser}}` - The target browser from the
  `--browser` CLI flag
* `{{mode}}` - The current mode
* `{{modeSuffix}}`: A suffix based on the mode ('-dev'
  for development, '' for production)
* `{{manifestVersion}}` - Either "2" or "3"

##### Default

```ts
'{{name}}-{{packageVersion}}-sources{{modeSuffix}}.zip'
```

#### zipSources?

> `optional` **zipSources?**: `boolean`

When zipping the extension, also zip sources.

* `undefined`: zip sources if the target browser is "firefox" or "opera"
* `true`: always zip sources
* `false`: never zip sources

##### Default

```ts
undefined
```

***

Generated using [typedoc-plugin-markdown](https://www.npmjs.com/package/typedoc-plugin-markdown) and [TypeDoc](https://typedoc.org/)
