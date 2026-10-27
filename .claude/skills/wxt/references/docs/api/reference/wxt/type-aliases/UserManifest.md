<!-- source: https://wxt.dev/api/reference/wxt/type-aliases/UserManifest.md -->
[API](../../packages.md) / [wxt](../index.md) / UserManifest

# Type Alias: UserManifest

> **UserManifest** = { \[key in keyof Browser.runtime.ManifestV3 as key extends "action" | "background" | "chrome\_url\_overrides" | "devtools\_page" | "manifest\_version" | "options\_page" | "options\_ui" | "permissions" | "sandbox" | "web\_accessible\_resources" ? never : key]?: Browser.runtime.ManifestV3\[key] } & `object`

Source: [packages/wxt/src/types.ts:1111](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L1111)

Manifest customization available in the `wxt.config.ts` file. You cannot
configure entrypoints here, they are configured inline.

## Type Declaration

### action?

> `optional` **action?**: `Browser.runtime.ManifestV3`\[`"action"`] & `object`

#### Type Declaration

##### default\_area?

> `optional` **default\_area?**: `"navbar"` | `"menupanel"` | `"tabstrip"` | `"personaltoolbar"`

##### theme\_icons?

> `optional` **theme\_icons?**: [`ThemeIcon`](../interfaces/ThemeIcon.md)\[]

### browser\_action?

> `optional` **browser\_action?**: `Browser.runtime.ManifestV2`\[`"browser_action"`] & `object`

#### Type Declaration

##### browser\_style?

> `optional` **browser\_style?**: `boolean`

##### default\_area?

> `optional` **default\_area?**: `"navbar"` | `"menupanel"` | `"tabstrip"` | `"personaltoolbar"`

##### theme\_icons?

> `optional` **theme\_icons?**: [`ThemeIcon`](../interfaces/ThemeIcon.md)\[]

### browser\_specific\_settings?

> `optional` **browser\_specific\_settings?**: `object`

#### browser\_specific\_settings.gecko?

> `optional` **gecko?**: `object`

#### browser\_specific\_settings.gecko.data\_collection\_permissions?

> `optional` **data\_collection\_permissions?**: [`FirefoxDataCollectionPermissions`](../interfaces/FirefoxDataCollectionPermissions.md)

Firefox data collection permissions configuration. See:
https://extensionworkshop.com/documentation/develop/firefox-builtin-data-consent/#specifying-data-types

#### browser\_specific\_settings.gecko.id?

> `optional` **id?**: `string`

#### browser\_specific\_settings.gecko.strict\_max\_version?

> `optional` **strict\_max\_version?**: `string`

#### browser\_specific\_settings.gecko.strict\_min\_version?

> `optional` **strict\_min\_version?**: `string`

#### browser\_specific\_settings.gecko.update\_url?

> `optional` **update\_url?**: `string`

#### browser\_specific\_settings.gecko\_android?

> `optional` **gecko\_android?**: `object`

#### browser\_specific\_settings.gecko\_android.strict\_max\_version?

> `optional` **strict\_max\_version?**: `string`

#### browser\_specific\_settings.gecko\_android.strict\_min\_version?

> `optional` **strict\_min\_version?**: `string`

#### browser\_specific\_settings.safari?

> `optional` **safari?**: `object`

#### browser\_specific\_settings.safari.strict\_max\_version?

> `optional` **strict\_max\_version?**: `string`

#### browser\_specific\_settings.safari.strict\_min\_version?

> `optional` **strict\_min\_version?**: `string`

### page\_action?

> `optional` **page\_action?**: `Browser.runtime.ManifestV2`\[`"page_action"`] & `object`

#### Type Declaration

##### browser\_style?

> `optional` **browser\_style?**: `boolean`

### permissions?

> `optional` **permissions?**: (`Browser.runtime.ManifestPermission` | `string` & `Record`<`never`, `never`>)\[]

### web\_accessible\_resources?

> `optional` **web\_accessible\_resources?**: `string`\[] | `Browser.runtime.ManifestV3`\[`"web_accessible_resources"`]

***

Generated using [typedoc-plugin-markdown](https://www.npmjs.com/package/typedoc-plugin-markdown) and [TypeDoc](https://typedoc.org/)
