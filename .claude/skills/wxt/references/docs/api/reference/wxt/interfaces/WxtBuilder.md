<!-- source: https://wxt.dev/api/reference/wxt/interfaces/WxtBuilder.md -->
[API](../../packages.md) / [wxt](../index.md) / WxtBuilder

# Interface: WxtBuilder

Source: [packages/wxt/src/types.ts:1258](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L1258)

## Contents

* [Properties](#properties)
  * [name](#name)
  * [version](#version)
* [Methods](#methods)
  * [build()](#build)
  * [createServer()](#createserver)
  * [importEntrypoint()](#importentrypoint)
  * [importEntrypoints()](#importentrypoints)

## Properties

### name

> **name**: `string`

Source: [packages/wxt/src/types.ts:1260](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L1260)

Name of tool used to build. Ex: "Vite" or "Webpack".

***

### version

> **version**: `string`

Source: [packages/wxt/src/types.ts:1262](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L1262)

Version of tool used to build. Ex: "5.0.2"

## Methods

### build()

> **build**(`group`): `Promise`<[`BuildStepOutput`](BuildStepOutput.md)>

Source: [packages/wxt/src/types.ts:1274](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L1274)

Build a single entrypoint group. This is effectively one of the multiple
"steps" during the build process.

#### Parameters

##### group

[`EntrypointGroup`](../type-aliases/EntrypointGroup.md)

#### Returns

`Promise`<[`BuildStepOutput`](BuildStepOutput.md)>

***

### createServer()

> **createServer**(`info`): `Promise`<[`WxtBuilderServer`](WxtBuilderServer.md)>

Source: [packages/wxt/src/types.ts:1276](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L1276)

Start a dev server at the provided port.

#### Parameters

##### info

[`ServerInfo`](ServerInfo.md)

#### Returns

`Promise`<[`WxtBuilderServer`](WxtBuilderServer.md)>

***

### importEntrypoint()

> **importEntrypoint**<`T`>(`this`, `path`): `Promise`<`T`>

Source: [packages/wxt/src/types.ts:1267](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L1267)

Import a JS entrypoint file, returning the default export containing the
options.

#### Type Parameters

##### T

`T`

#### Parameters

##### this

`WxtBuilder`

##### path

`string`

#### Returns

`Promise`<`T`>

***

### importEntrypoints()

> **importEntrypoints**(`paths`): `Promise`<`Record`<`string`, `unknown`>\[]>

Source: [packages/wxt/src/types.ts:1269](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L1269)

Import a list of JS entrypoint files, returning their options.

#### Parameters

##### paths

`string`\[]

#### Returns

`Promise`<`Record`<`string`, `unknown`>\[]>

***

Generated using [typedoc-plugin-markdown](https://www.npmjs.com/package/typedoc-plugin-markdown) and [TypeDoc](https://typedoc.org/)
