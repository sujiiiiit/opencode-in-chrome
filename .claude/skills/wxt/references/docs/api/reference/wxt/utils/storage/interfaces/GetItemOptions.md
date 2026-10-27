<!-- source: https://wxt.dev/api/reference/wxt/utils/storage/interfaces/GetItemOptions.md -->
[API](../../../../packages.md) / [wxt/utils/storage](../index.md) / GetItemOptions

# Interface: GetItemOptions\<T>

Source: packages/storage/dist/index.d.mts:186

## Contents

* [Type Parameters](#type-parameters)
  * [T](#t)
* [Properties](#properties)
  * [defaultValue?](#defaultvalue)
  * [fallback?](#fallback)

## Type Parameters

### T

`T`

## Properties

### ~~defaultValue?~~

> `optional` **defaultValue?**: `T`

Source: packages/storage/dist/index.d.mts:188

#### Deprecated

Renamed to `fallback`, use it instead.

***

### fallback?

> `optional` **fallback?**: `T`

Source: packages/storage/dist/index.d.mts:190

Default value returned when `getItem` would otherwise return `null`.

***

Generated using [typedoc-plugin-markdown](https://www.npmjs.com/package/typedoc-plugin-markdown) and [TypeDoc](https://typedoc.org/)
