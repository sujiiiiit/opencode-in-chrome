<!-- source: https://wxt.dev/api/reference/wxt/utils/storage/interfaces/WxtStorage.md -->
[API](../../../../packages.md) / [wxt/utils/storage](../index.md) / WxtStorage

# Interface: WxtStorage

Source: packages/storage/dist/index.d.mts:5

## Contents

* [Methods](#methods)
  * [clear()](#clear)
  * [defineItem()](#defineitem)
  * [getItem()](#getitem)
  * [getItems()](#getitems)
  * [getMeta()](#getmeta)
  * [getMetas()](#getmetas)
  * [removeItem()](#removeitem)
  * [removeItems()](#removeitems)
  * [removeMeta()](#removemeta)
  * [restoreSnapshot()](#restoresnapshot)
  * [setItem()](#setitem)
  * [setItems()](#setitems)
  * [setMeta()](#setmeta)
  * [setMetas()](#setmetas)
  * [snapshot()](#snapshot)
  * [unwatch()](#unwatch)
  * [watch()](#watch)
  * [watchMeta()](#watchmeta)

## Methods

### clear()

> **clear**(`base`): `Promise`<`void`>

Source: packages/storage/dist/index.d.mts:109

Removes all items from the provided storage area.

#### Parameters

##### base

[`StorageArea`](../type-aliases/StorageArea.md)

#### Returns

`Promise`<`void`>

***

### defineItem()

#### Call Signature

> **defineItem**<`TValue`, `TMetadata`>(`key`): [`WxtStorageItem`](WxtStorageItem.md)<`TValue` | `null`, `TMetadata`>

Source: packages/storage/dist/index.d.mts:140

Define a storage item with a default value, type, or versioning.

Read full docs: https://wxt.dev/storage.html#defining-storage-items

##### Type Parameters

###### TValue

`TValue`

###### TMetadata

`TMetadata` *extends* `Record`<`string`, `unknown`> = { }

##### Parameters

###### key

`` `local:${string}` `` | `` `session:${string}` `` | `` `sync:${string}` `` | `` `managed:${string}` ``

##### Returns

[`WxtStorageItem`](WxtStorageItem.md)<`TValue` | `null`, `TMetadata`>

#### Call Signature

> **defineItem**<`TValue`, `TMetadata`>(`key`, `options`): [`WxtStorageItem`](WxtStorageItem.md)<`TValue`, `TMetadata`>

Source: packages/storage/dist/index.d.mts:141

##### Type Parameters

###### TValue

`TValue`

###### TMetadata

`TMetadata` *extends* `Record`<`string`, `unknown`> = { }

##### Parameters

###### key

`` `local:${string}` `` | `` `session:${string}` `` | `` `sync:${string}` `` | `` `managed:${string}` ``

###### options

[`WxtStorageItemOptions`](WxtStorageItemOptions.md)<`TValue`> & `object`

##### Returns

[`WxtStorageItem`](WxtStorageItem.md)<`TValue`, `TMetadata`>

#### Call Signature

> **defineItem**<`TValue`, `TMetadata`>(`key`, `options`): [`WxtStorageItem`](WxtStorageItem.md)<`TValue`, `TMetadata`>

Source: packages/storage/dist/index.d.mts:144

##### Type Parameters

###### TValue

`TValue`

###### TMetadata

`TMetadata` *extends* `Record`<`string`, `unknown`> = { }

##### Parameters

###### key

`` `local:${string}` `` | `` `session:${string}` `` | `` `sync:${string}` `` | `` `managed:${string}` ``

###### options

[`WxtStorageItemOptions`](WxtStorageItemOptions.md)<`TValue`> & `object`

##### Returns

[`WxtStorageItem`](WxtStorageItem.md)<`TValue`, `TMetadata`>

#### Call Signature

> **defineItem**<`TValue`, `TMetadata`>(`key`, `options`): [`WxtStorageItem`](WxtStorageItem.md)<`TValue`, `TMetadata`>

Source: packages/storage/dist/index.d.mts:147

##### Type Parameters

###### TValue

`TValue`

###### TMetadata

`TMetadata` *extends* `Record`<`string`, `unknown`> = { }

##### Parameters

###### key

`` `local:${string}` `` | `` `session:${string}` `` | `` `sync:${string}` `` | `` `managed:${string}` ``

###### options

[`WxtStorageItemOptions`](WxtStorageItemOptions.md)<`TValue`> & `object`

##### Returns

[`WxtStorageItem`](WxtStorageItem.md)<`TValue`, `TMetadata`>

#### Call Signature

> **defineItem**<`TValue`, `TMetadata`>(`key`, `options`): [`WxtStorageItem`](WxtStorageItem.md)<`TValue` | `null`, `TMetadata`>

Source: packages/storage/dist/index.d.mts:150

##### Type Parameters

###### TValue

`TValue`

###### TMetadata

`TMetadata` *extends* `Record`<`string`, `unknown`> = { }

##### Parameters

###### key

`` `local:${string}` `` | `` `session:${string}` `` | `` `sync:${string}` `` | `` `managed:${string}` ``

###### options

[`WxtStorageItemOptions`](WxtStorageItemOptions.md)<`TValue`>

##### Returns

[`WxtStorageItem`](WxtStorageItem.md)<`TValue` | `null`, `TMetadata`>

***

### getItem()

#### Call Signature

> **getItem**<`TValue`>(`key`, `opts`): `Promise`<`TValue`>

Source: packages/storage/dist/index.d.mts:12

Get an item from storage, or return `null` if it doesn't exist.

##### Type Parameters

###### TValue

`TValue`

##### Parameters

###### key

`` `local:${string}` `` | `` `session:${string}` `` | `` `sync:${string}` `` | `` `managed:${string}` ``

###### opts

[`GetItemOptions`](GetItemOptions.md)<`TValue`> & `object`

##### Returns

`Promise`<`TValue`>

##### Example

```ts
await storage.getItem<number>('local:installDate');
```

#### Call Signature

> **getItem**<`TValue`>(`key`, `opts?`): `Promise`<`TValue` | `null`>

Source: packages/storage/dist/index.d.mts:15

##### Type Parameters

###### TValue

`TValue`

##### Parameters

###### key

`` `local:${string}` `` | `` `session:${string}` `` | `` `sync:${string}` `` | `` `managed:${string}` ``

###### opts?

[`GetItemOptions`](GetItemOptions.md)<`TValue`>

##### Returns

`Promise`<`TValue` | `null`>

***

### getItems()

> **getItems**(`keys`): `Promise`<`object`\[]>

Source: packages/storage/dist/index.d.mts:23

Get multiple items from storage. The return order is guaranteed to be the
same as the order requested.

#### Parameters

##### keys

(`` `local:${string}` `` | `` `session:${string}` `` | `` `sync:${string}` `` | `` `managed:${string}` `` | [`WxtStorageItem`](WxtStorageItem.md)<`any`, `any`> | { `key`: `` `local:${string}` `` | `` `session:${string}` `` | `` `sync:${string}` `` | `` `managed:${string}` ``; `options?`: [`GetItemOptions`](GetItemOptions.md)<`any`>; })\[]

#### Returns

`Promise`<`object`\[]>

#### Example

```ts
await storage.getItems(['local:installDate', 'session:someCounter']);
```

***

### getMeta()

> **getMeta**<`T`>(`key`): `Promise`<`T`>

Source: packages/storage/dist/index.d.mts:37

Return an object containing metadata about the key. Object is stored at
`key + "$"`. If value is not an object, it returns an empty object.

#### Type Parameters

##### T

`T` *extends* `Record`<`string`, `unknown`>

#### Parameters

##### key

`` `local:${string}` `` | `` `session:${string}` `` | `` `sync:${string}` `` | `` `managed:${string}` ``

#### Returns

`Promise`<`T`>

#### Example

```ts
await storage.getMeta('local:installDate');
```

***

### getMetas()

> **getMetas**(`keys`): `Promise`<`object`\[]>

Source: packages/storage/dist/index.d.mts:44

Get the metadata of multiple storage items.

#### Parameters

##### keys

(`` `local:${string}` `` | `` `session:${string}` `` | `` `sync:${string}` `` | `` `managed:${string}` `` | [`WxtStorageItem`](WxtStorageItem.md)<`any`, `any`>)\[]

List of keys or items to get the metadata of.

#### Returns

`Promise`<`object`\[]>

An array containing storage keys and their metadata.

***

### removeItem()

> **removeItem**(`key`, `opts?`): `Promise`<`void`>

Source: packages/storage/dist/index.d.mts:99

Removes an item from storage.

#### Parameters

##### key

`` `local:${string}` `` | `` `session:${string}` `` | `` `sync:${string}` `` | `` `managed:${string}` ``

##### opts?

[`RemoveItemOptions`](RemoveItemOptions.md)

#### Returns

`Promise`<`void`>

#### Example

```ts
await storage.removeItem('local:installDate');
```

***

### removeItems()

> **removeItems**(`keys`): `Promise`<`void`>

Source: packages/storage/dist/index.d.mts:101

Remove a list of keys from storage.

#### Parameters

##### keys

(`` `local:${string}` `` | `` `session:${string}` `` | `` `sync:${string}` `` | `` `managed:${string}` `` | [`WxtStorageItem`](WxtStorageItem.md)<`any`, `any`> | { `key`: `` `local:${string}` `` | `` `session:${string}` `` | `` `sync:${string}` `` | `` `managed:${string}` ``; `options?`: [`RemoveItemOptions`](RemoveItemOptions.md); } | { `item`: [`WxtStorageItem`](WxtStorageItem.md)<`any`, `any`>; `options?`: [`RemoveItemOptions`](RemoveItemOptions.md); })\[]

#### Returns

`Promise`<`void`>

***

### removeMeta()

> **removeMeta**(`key`, `properties?`): `Promise`<`void`>

Source: packages/storage/dist/index.d.mts:120

Remove the entire metadata for a key, or specific properties by name.

#### Parameters

##### key

`` `local:${string}` `` | `` `session:${string}` `` | `` `sync:${string}` `` | `` `managed:${string}` ``

##### properties?

`string` | `string`\[]

#### Returns

`Promise`<`void`>

#### Example

```ts
// Remove all metadata properties from the item
  await storage.removeMeta('local:installDate');

  // Remove only specific the "v" field
  await storage.removeMeta('local:installDate', 'v');
```

***

### restoreSnapshot()

> **restoreSnapshot**(`base`, `data`): `Promise`<`void`>

Source: packages/storage/dist/index.d.mts:128

Restores the results of `snapshot`. If new properties have been saved since
the snapshot, they are not overridden. Only values existing in the snapshot
are overridden.

#### Parameters

##### base

[`StorageArea`](../type-aliases/StorageArea.md)

##### data

`any`

#### Returns

`Promise`<`void`>

***

### setItem()

> **setItem**<`T`>(`key`, `value`): `Promise`<`void`>

Source: packages/storage/dist/index.d.mts:55

Set a value in storage. Setting a value to `null` or `undefined` is
equivalent to calling `removeItem`.

#### Type Parameters

##### T

`T`

#### Parameters

##### key

`` `local:${string}` `` | `` `session:${string}` `` | `` `sync:${string}` `` | `` `managed:${string}` ``

##### value

`T` | `null`

#### Returns

`Promise`<`void`>

#### Example

```ts
await storage.setItem<number>('local:installDate', Date.now());
```

***

### setItems()

> **setItems**(`values`): `Promise`<`void`>

Source: packages/storage/dist/index.d.mts:66

Set multiple values in storage. If a value is set to `null` or `undefined`,
the key is removed.

#### Parameters

##### values

({ `key`: `` `local:${string}` `` | `` `session:${string}` `` | `` `sync:${string}` `` | `` `managed:${string}` ``; `value`: `any`; } | { `item`: [`WxtStorageItem`](WxtStorageItem.md)<`any`, `any`>; `value`: `any`; })\[]

#### Returns

`Promise`<`void`>

#### Example

```ts
await storage.setItem([
  { key: "local:installDate", value: Date.now() },
  { key: "session:someCounter, value: 5 },
  ]);
```

***

### setMeta()

> **setMeta**<`T`>(`key`, `properties`): `Promise`<`void`>

Source: packages/storage/dist/index.d.mts:80

Sets metadata properties. If some properties are already set, but are not
included in the `properties` parameter, they will not be removed.

#### Type Parameters

##### T

`T` *extends* `Record`<`string`, `unknown`>

#### Parameters

##### key

`` `local:${string}` `` | `` `session:${string}` `` | `` `sync:${string}` `` | `` `managed:${string}` ``

##### properties

`T` | `null`

#### Returns

`Promise`<`void`>

#### Example

```ts
await storage.setMeta('local:installDate', { appVersion });
```

***

### setMetas()

> **setMetas**(`metas`): `Promise`<`void`>

Source: packages/storage/dist/index.d.mts:86

Set the metadata of multiple storage items.

#### Parameters

##### metas

({ `key`: `` `local:${string}` `` | `` `session:${string}` `` | `` `sync:${string}` `` | `` `managed:${string}` ``; `meta`: `Record`<`string`, `any`>; } | { `item`: [`WxtStorageItem`](WxtStorageItem.md)<`any`, `any`>; `meta`: `Record`<`string`, `any`>; })\[]

List of storage keys or items and metadata to set for each.

#### Returns

`Promise`<`void`>

***

### snapshot()

> **snapshot**(`base`, `opts?`): `Promise`<`Record`<`string`, `unknown`>>

Source: packages/storage/dist/index.d.mts:122

Return all the items in storage.

#### Parameters

##### base

[`StorageArea`](../type-aliases/StorageArea.md)

##### opts?

[`SnapshotOptions`](SnapshotOptions.md)

#### Returns

`Promise`<`Record`<`string`, `unknown`>>

***

### unwatch()

> **unwatch**(): `void`

Source: packages/storage/dist/index.d.mts:134

Remove all watch listeners.

#### Returns

`void`

***

### watch()

> **watch**<`T`>(`key`, `cb`): [`Unwatch`](../type-aliases/Unwatch.md)

Source: packages/storage/dist/index.d.mts:130

Watch for changes to a specific key in storage.

#### Type Parameters

##### T

`T`

#### Parameters

##### key

`` `local:${string}` `` | `` `session:${string}` `` | `` `sync:${string}` `` | `` `managed:${string}` ``

##### cb

[`WatchCallback`](../type-aliases/WatchCallback.md)<`T` | `null`>

#### Returns

[`Unwatch`](../type-aliases/Unwatch.md)

***

### watchMeta()

> **watchMeta**<`T`>(`key`, `cb`): [`Unwatch`](../type-aliases/Unwatch.md)

Source: packages/storage/dist/index.d.mts:132

Watch for changes to a specific key's metadata in storage.

#### Type Parameters

##### T

`T` *extends* `Record`<`string`, `unknown`>

#### Parameters

##### key

`` `local:${string}` `` | `` `session:${string}` `` | `` `sync:${string}` `` | `` `managed:${string}` ``

##### cb

[`WatchCallback`](../type-aliases/WatchCallback.md)<`T`>

#### Returns

[`Unwatch`](../type-aliases/Unwatch.md)

***

Generated using [typedoc-plugin-markdown](https://www.npmjs.com/package/typedoc-plugin-markdown) and [TypeDoc](https://typedoc.org/)
