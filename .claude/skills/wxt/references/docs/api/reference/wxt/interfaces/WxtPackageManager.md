<!-- source: https://wxt.dev/api/reference/wxt/interfaces/WxtPackageManager.md -->
[API](../../packages.md) / [wxt](../index.md) / WxtPackageManager

# Interface: WxtPackageManager

Source: [packages/wxt/src/types.ts:1817](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L1817)

Package management utils built on top of
[`nypm`](https://npmjs.org/package/nypm)

## Contents

* [Extends](#extends)
* [Properties](#properties)
  * [addDependency](#adddependency)
  * [addDevDependency](#adddevdependency)
  * [buildMeta?](#buildmeta)
  * [command](#command)
  * [downloadDependency](#downloaddependency)
  * [ensureDependencyInstalled](#ensuredependencyinstalled)
  * [files?](#files)
  * [installDependencies](#installdependencies)
  * [listDependencies](#listdependencies)
  * [lockFile?](#lockfile)
  * [majorVersion?](#majorversion)
  * [name](#name)
  * [overridesKey](#overrideskey)
  * [removeDependency](#removedependency)
  * [version?](#version)

## Extends

* `PackageManager`

## Properties

### addDependency

> **addDependency**: (`name`, `options?`) => `Promise`<`OperationResult`>

Source: [packages/wxt/src/types.ts:1818](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L1818)

Adds dependency to the project.

#### Parameters

##### name

`string` | `string`\[]

Name of the dependency to add.

##### options?

`OperationOptions`

Options to pass to the API call.

#### Returns

`Promise`<`OperationResult`>

***

### addDevDependency

> **addDevDependency**: (`name`, `options?`) => `Promise`<`OperationResult`>

Source: [packages/wxt/src/types.ts:1819](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L1819)

Adds dev dependency to the project.

#### Parameters

##### name

`string` | `string`\[]

Name of the dev dependency to add.

##### options?

`Omit`<`OperationOptions`, `"dev"`>

Options to pass to the API call.

#### Returns

`Promise`<`OperationResult`>

***

### buildMeta?

> `optional` **buildMeta?**: `string`

Source: node\_modules/.bun/nypm@0.6.5/node\_modules/nypm/dist/index.d.mts:7

#### Inherited from

`Nypm.PackageManager.buildMeta`

***

### command

> **command**: `string`

Source: node\_modules/.bun/nypm@0.6.5/node\_modules/nypm/dist/index.d.mts:5

#### Inherited from

`Nypm.PackageManager.command`

***

### downloadDependency

> **downloadDependency**: (`id`, `downloadDir`) => `Promise`<`string`>

Source: [packages/wxt/src/types.ts:1833](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L1833)

Download a package's TGZ file and move it into the `downloadDir`. Use's
`npm pack <name>`, so you must have setup authorization in `.npmrc` file,
regardless of the package manager used.

#### Parameters

##### id

`string`

Name of the package to download, can include a version (like
`wxt@0.17.1`)

##### downloadDir

`string`

Where to store the package.

#### Returns

`Promise`<`string`>

Absolute path to downloaded file.

***

### ensureDependencyInstalled

> **ensureDependencyInstalled**: (`name`, `options?`) => `Promise`<`true` | `undefined`>

Source: [packages/wxt/src/types.ts:1820](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L1820)

Ensures dependency is installed.

#### Parameters

##### name

`string`

Name of the dependency.

##### options?

`Pick`<`OperationOptions`, `"workspace"` | `"cwd"` | `"dev"`>

Options to pass to the API call.

#### Returns

`Promise`<`true` | `undefined`>

***

### files?

> `optional` **files?**: `string`\[]

Source: node\_modules/.bun/nypm@0.6.5/node\_modules/nypm/dist/index.d.mts:10

#### Inherited from

`Nypm.PackageManager.files`

***

### installDependencies

> **installDependencies**: (`options?`) => `Promise`<`OperationResult`>

Source: [packages/wxt/src/types.ts:1821](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L1821)

Installs project dependencies.

#### Parameters

##### options?

`Pick`<`OperationOptions`, `"silent"` | `"cwd"` | `"packageManager"` | `"dry"` | `"corepack"`> & `object`

Options to pass to the API call.

#### Returns

`Promise`<`OperationResult`>

***

### listDependencies

> **listDependencies**: (`options?`) => `Promise`<[`Dependency`](Dependency.md)\[]>

Source: [packages/wxt/src/types.ts:1840](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L1840)

Run `npm ls`, `pnpm ls`, or `bun pm ls`, or `yarn list` and return the
results.

WARNING: Yarn always returns all dependencies

#### Parameters

##### options?

###### all?

`boolean`

###### cwd?

`string`

#### Returns

`Promise`<[`Dependency`](Dependency.md)\[]>

***

### lockFile?

> `optional` **lockFile?**: `string` | `string`\[]

Source: node\_modules/.bun/nypm@0.6.5/node\_modules/nypm/dist/index.d.mts:9

#### Inherited from

`Nypm.PackageManager.lockFile`

***

### majorVersion?

> `optional` **majorVersion?**: `string`

Source: node\_modules/.bun/nypm@0.6.5/node\_modules/nypm/dist/index.d.mts:8

#### Inherited from

`Nypm.PackageManager.majorVersion`

***

### name

> **name**: `PackageManagerName`

Source: node\_modules/.bun/nypm@0.6.5/node\_modules/nypm/dist/index.d.mts:4

#### Inherited from

`Nypm.PackageManager.name`

***

### overridesKey

> **overridesKey**: `string`

Source: [packages/wxt/src/types.ts:1845](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L1845)

Key used to override package versions. Sometimes called "resolutions".

***

### removeDependency

> **removeDependency**: (`name`, `options?`) => `Promise`<`OperationResult`>

Source: [packages/wxt/src/types.ts:1822](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L1822)

Removes dependency from the project.

#### Parameters

##### name

`string` | `string`\[]

Name of the dependency to remove.

##### options?

`OperationOptions`

Options to pass to the API call.

#### Returns

`Promise`<`OperationResult`>

***

### version?

> `optional` **version?**: `string`

Source: node\_modules/.bun/nypm@0.6.5/node\_modules/nypm/dist/index.d.mts:6

#### Inherited from

`Nypm.PackageManager.version`

***

Generated using [typedoc-plugin-markdown](https://www.npmjs.com/package/typedoc-plugin-markdown) and [TypeDoc](https://typedoc.org/)
