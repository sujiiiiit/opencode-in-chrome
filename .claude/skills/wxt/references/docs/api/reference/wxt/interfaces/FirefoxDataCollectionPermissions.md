<!-- source: https://wxt.dev/api/reference/wxt/interfaces/FirefoxDataCollectionPermissions.md -->
[API](../../packages.md) / [wxt](../index.md) / FirefoxDataCollectionPermissions

# Interface: FirefoxDataCollectionPermissions

Source: [packages/wxt/src/types.ts:1092](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L1092)

Firefox data collection permissions configuration. See:
https://extensionworkshop.com/documentation/develop/firefox-builtin-data-consent/#specifying-data-types

## Contents

* [Properties](#properties)
  * [optional?](#optional)
  * [required?](#required)

## Properties

### optional?

> `optional` **optional?**: ([`FirefoxDataCollectionType`](../type-aliases/FirefoxDataCollectionType.md) | `"technicalAndInteraction"`)\[]

Source: [packages/wxt/src/types.ts:1104](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L1104)

Optional data collection permissions. Users can opt in after installation.
Can include personal data types or "technicalAndInteraction" (which can
only be optional).

***

### required?

> `optional` **required?**: (`"none"` | [`FirefoxDataCollectionType`](../type-aliases/FirefoxDataCollectionType.md))\[]

Source: [packages/wxt/src/types.ts:1098](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L1098)

Required data collection permissions. Users must opt in to use the
extension. Can include personal data types or "none" to explicitly indicate
no data collection.

***

Generated using [typedoc-plugin-markdown](https://www.npmjs.com/package/typedoc-plugin-markdown) and [TypeDoc](https://typedoc.org/)
