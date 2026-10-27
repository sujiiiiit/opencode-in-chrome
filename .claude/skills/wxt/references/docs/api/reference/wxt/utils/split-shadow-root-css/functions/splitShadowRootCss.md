<!-- source: https://wxt.dev/api/reference/wxt/utils/split-shadow-root-css/functions/splitShadowRootCss.md -->
[API](../../../../packages.md) / [wxt/utils/split-shadow-root-css](../index.md) / splitShadowRootCss

# Function: splitShadowRootCss()

> **splitShadowRootCss**(`css`): `object`

Source: [packages/wxt/src/utils/split-shadow-root-css.ts:15](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/utils/split-shadow-root-css.ts#L15)

Given a CSS string that will be loaded into a shadow root, split it into two
parts:

* `documentCss`: CSS that needs to be applied to the document (like
  `@property`)
* `shadowCss`: CSS that needs to be applied to the shadow root

## Parameters

### css

`string`

## Returns

`object`

### documentCss

> **documentCss**: `string`

### shadowCss

> **shadowCss**: `string`

***

Generated using [typedoc-plugin-markdown](https://www.npmjs.com/package/typedoc-plugin-markdown) and [TypeDoc](https://typedoc.org/)
