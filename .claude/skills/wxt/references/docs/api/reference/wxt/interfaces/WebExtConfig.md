<!-- source: https://wxt.dev/api/reference/wxt/interfaces/WebExtConfig.md -->
[API](../../packages.md) / [wxt](../index.md) / WebExtConfig

# Interface: WebExtConfig

Source: [packages/wxt/src/types.ts:1204](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L1204)

Options for how [`web-ext`](https://github.com/mozilla/web-ext) starts the
browser.

## Contents

* [Properties](#properties)
  * [binaries?](#binaries)
  * [chromiumArgs?](#chromiumargs)
  * [chromiumPort?](#chromiumport)
  * [chromiumPref?](#chromiumpref)
  * [chromiumProfile?](#chromiumprofile)
  * [disabled?](#disabled)
  * [firefoxArgs?](#firefoxargs)
  * [firefoxPref?](#firefoxpref)
  * [firefoxProfile?](#firefoxprofile)
  * [keepProfileChanges?](#keepprofilechanges)
  * [openConsole?](#openconsole)
  * [openDevtools?](#opendevtools)
  * [startUrls?](#starturls)

## Properties

### binaries?

> `optional` **binaries?**: `Record`<`string`, `string`>

Source: [packages/wxt/src/types.ts:1223](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L1223)

List of browser names and the binary that should be used to open the
browser.

#### See

* https://extensionworkshop.com/documentation/develop/web-ext-command-reference/#chromium-binary
* https://extensionworkshop.com/documentation/develop/web-ext-command-reference/#firefox

***

### chromiumArgs?

> `optional` **chromiumArgs?**: `string`\[]

Source: [packages/wxt/src/types.ts:1251](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L1251)

#### See

https://extensionworkshop.com/documentation/develop/web-ext-command-reference/#args

***

### chromiumPort?

> `optional` **chromiumPort?**: `number`

Source: [packages/wxt/src/types.ts:1245](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L1245)

By default, chrome opens a random port for debugging. Set this value to use
a specific port.

***

### chromiumPref?

> `optional` **chromiumPref?**: `Record`<`string`, `any`>

Source: [packages/wxt/src/types.ts:1240](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L1240)

An map of chrome preferences from
https://chromium.googlesource.com/chromium/src/+/main/chrome/common/pref\_names.h

#### Example

```ts
// change your downloads directory
  {
  download: {
  default_directory: "/my/custom/dir",
  },
  }
```

***

### chromiumProfile?

> `optional` **chromiumProfile?**: `string`

Source: [packages/wxt/src/types.ts:1227](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L1227)

#### See

https://extensionworkshop.com/documentation/develop/web-ext-command-reference/#chromium-profile

***

### disabled?

> `optional` **disabled?**: `boolean`

Source: [packages/wxt/src/types.ts:1211](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L1211)

Whether or not to open the browser with the extension installed in dev
mode.

#### Default

```ts
false
```

***

### firefoxArgs?

> `optional` **firefoxArgs?**: `string`\[]

Source: [packages/wxt/src/types.ts:1249](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L1249)

#### See

https://extensionworkshop.com/documentation/develop/web-ext-command-reference/#args

***

### firefoxPref?

> `optional` **firefoxPref?**: `Record`<`string`, `string` | `number` | `boolean`>

Source: [packages/wxt/src/types.ts:1247](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L1247)

#### See

https://extensionworkshop.com/documentation/develop/web-ext-command-reference/#pref

***

### firefoxProfile?

> `optional` **firefoxProfile?**: `string`

Source: [packages/wxt/src/types.ts:1225](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L1225)

#### See

https://extensionworkshop.com/documentation/develop/web-ext-command-reference/#firefox-profile

***

### keepProfileChanges?

> `optional` **keepProfileChanges?**: `boolean`

Source: [packages/wxt/src/types.ts:1255](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L1255)

#### See

https://extensionworkshop.com/documentation/develop/web-ext-command-reference/#keep-profile-changes

***

### openConsole?

> `optional` **openConsole?**: `boolean`

Source: [packages/wxt/src/types.ts:1213](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L1213)

#### See

https://extensionworkshop.com/documentation/develop/web-ext-command-reference/#browser-console

***

### openDevtools?

> `optional` **openDevtools?**: `boolean`

Source: [packages/wxt/src/types.ts:1215](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L1215)

#### See

https://extensionworkshop.com/documentation/develop/web-ext-command-reference/#devtools

***

### startUrls?

> `optional` **startUrls?**: `string`\[]

Source: [packages/wxt/src/types.ts:1253](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L1253)

#### See

https://extensionworkshop.com/documentation/develop/web-ext-command-reference/#start-url

***

Generated using [typedoc-plugin-markdown](https://www.npmjs.com/package/typedoc-plugin-markdown) and [TypeDoc](https://typedoc.org/)
