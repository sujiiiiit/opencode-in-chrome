<!-- source: https://wxt.dev/api/reference/wxt/utils/storage/interfaces/WxtStorageItemOptions.md -->
[API](../../../../packages.md) / [wxt/utils/storage](../index.md) / WxtStorageItemOptions

# Interface: WxtStorageItemOptions\<T>

Source: packages/storage/dist/index.d.mts:207

## Contents

* [Type Parameters](#type-parameters)
  * [T](#t)
* [Properties](#properties)
  * [debug?](#debug)
  * [defaultValue?](#defaultvalue)
  * [fallback?](#fallback)
  * [init?](#init)
  * [migrations?](#migrations)
  * [onMigrationComplete?](#onmigrationcomplete)
  * [version?](#version)

## Type Parameters

### T

`T`

## Properties

### debug?

> `optional` **debug?**: `boolean`

Source: packages/storage/dist/index.d.mts:235

Print debug logs, such as migration process.

#### Default

```ts
false
```

***

### ~~defaultValue?~~

> `optional` **defaultValue?**: `T`

Source: packages/storage/dist/index.d.mts:209

#### Deprecated

Renamed to `fallback`, use it instead.

***

### fallback?

> `optional` **fallback?**: `T`

Source: packages/storage/dist/index.d.mts:211

Default value returned when `getValue` would otherwise return `null`.

***

### init?

> `optional` **init?**: () => `T` | `Promise`<`T`>

Source: packages/storage/dist/index.d.mts:218

If passed, a value in storage will be initialized immediately after
defining the storage item. This function returns the value that will be
saved to storage during the initialization process if a value doesn't
already exist.

#### Returns

`T` | `Promise`<`T`>

***

### migrations?

> `optional` **migrations?**: `Record`<`number`, (`oldValue`) => `any`>

Source: packages/storage/dist/index.d.mts:229

A map of version numbers to the functions used to migrate the data to that
version.

***

### onMigrationComplete?

> `optional` **onMigrationComplete?**: (`migratedValue`, `targetVersion`) => `void`

Source: packages/storage/dist/index.d.mts:237

A callback function that runs on migration complete.

#### Parameters

##### migratedValue

`T`

##### targetVersion

`number`

#### Returns

`void`

***

### version?

> `optional` **version?**: `number`

Source: packages/storage/dist/index.d.mts:224

Provide a version number for the storage item to enable migrations. When
changing the version in the future, migration functions will be ran on
application startup.

***

Generated using [typedoc-plugin-markdown](https://www.npmjs.com/package/typedoc-plugin-markdown) and [TypeDoc](https://typedoc.org/)
