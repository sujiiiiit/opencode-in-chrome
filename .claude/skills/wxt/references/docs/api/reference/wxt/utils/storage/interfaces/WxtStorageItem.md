<!-- source: https://wxt.dev/api/reference/wxt/utils/storage/interfaces/WxtStorageItem.md -->
[API](../../../../packages.md) / [wxt/utils/storage](../index.md) / WxtStorageItem

# Interface: WxtStorageItem\<TValue, TMetadata>

Source: packages/storage/dist/index.d.mts:152

## Contents

* [Type Parameters](#type-parameters)
  * [TValue](#tvalue)
  * [TMetadata](#tmetadata)
* [Properties](#properties)
  * [defaultValue](#defaultvalue)
  * [fallback](#fallback)
  * [key](#key)
* [Methods](#methods)
  * [getMeta()](#getmeta)
  * [getValue()](#getvalue)
  * [migrate()](#migrate)
  * [removeMeta()](#removemeta)
  * [removeValue()](#removevalue)
  * [setMeta()](#setmeta)
  * [setValue()](#setvalue)
  * [watch()](#watch)
  * [watchMeta()](#watchmeta)

## Type Parameters

### TValue

`TValue`

### TMetadata

`TMetadata` *extends* `Record`<`string`, `unknown`>

## Properties

### ~~defaultValue~~

> **defaultValue**: `TValue`

Source: packages/storage/dist/index.d.mts:156

#### Deprecated

Renamed to fallback, use it instead.

***

### fallback

> **fallback**: `TValue`

Source: packages/storage/dist/index.d.mts:158

The value provided by the `fallback` option.

***

### key

> **key**: `` `local:${string}` `` | `` `session:${string}` `` | `` `sync:${string}` `` | `` `managed:${string}` ``

Source: packages/storage/dist/index.d.mts:154

The storage key passed when creating the storage item.

## Methods

### getMeta()

> **getMeta**(): `Promise`<`NullablePartial`<`TMetadata`>>

Source: packages/storage/dist/index.d.mts:162

Get metadata.

#### Returns

`Promise`<`NullablePartial`<`TMetadata`>>

***

### getValue()

> **getValue**(): `Promise`<`TValue`>

Source: packages/storage/dist/index.d.mts:160

Get the latest value from storage.

#### Returns

`Promise`<`TValue`>

***

### migrate()

> **migrate**(): `Promise`<`void`>

Source: packages/storage/dist/index.d.mts:182

If there are migrations defined on the storage item, migrate to the latest
version.

**This function is ran automatically whenever the extension updates**, so
you don't have to call it manually.

#### Returns

`Promise`<`void`>

***

### removeMeta()

> **removeMeta**(`properties?`): `Promise`<`void`>

Source: packages/storage/dist/index.d.mts:170

Remove all metadata or certain properties from metadata.

#### Parameters

##### properties?

`string`\[]

#### Returns

`Promise`<`void`>

***

### removeValue()

> **removeValue**(`opts?`): `Promise`<`void`>

Source: packages/storage/dist/index.d.mts:168

Remove the value from storage.

#### Parameters

##### opts?

[`RemoveItemOptions`](RemoveItemOptions.md)

#### Returns

`Promise`<`void`>

***

### setMeta()

> **setMeta**(`properties`): `Promise`<`void`>

Source: packages/storage/dist/index.d.mts:166

Set metadata properties.

#### Parameters

##### properties

`NullablePartial`<`TMetadata`>

#### Returns

`Promise`<`void`>

***

### setValue()

> **setValue**(`value`): `Promise`<`void`>

Source: packages/storage/dist/index.d.mts:164

Set the value in storage.

#### Parameters

##### value

`TValue`

#### Returns

`Promise`<`void`>

***

### watch()

> **watch**(`cb`): [`Unwatch`](../type-aliases/Unwatch.md)

Source: packages/storage/dist/index.d.mts:172

Listen for changes to the value in storage.

#### Parameters

##### cb

[`WatchCallback`](../type-aliases/WatchCallback.md)<`TValue`>

#### Returns

[`Unwatch`](../type-aliases/Unwatch.md)

***

### watchMeta()

> **watchMeta**(`cb`): [`Unwatch`](../type-aliases/Unwatch.md)

Source: packages/storage/dist/index.d.mts:174

Listen for changes to the metadata in storage.

#### Parameters

##### cb

[`WatchCallback`](../type-aliases/WatchCallback.md)<`NullablePartial`<`TMetadata`>>

#### Returns

[`Unwatch`](../type-aliases/Unwatch.md)

***

Generated using [typedoc-plugin-markdown](https://www.npmjs.com/package/typedoc-plugin-markdown) and [TypeDoc](https://typedoc.org/)
