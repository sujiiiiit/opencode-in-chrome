<!-- source: https://wxt.dev/api/reference/wxt/utils/inject-script/interfaces/InjectScriptOptions.md -->
[API](../../../../packages.md) / [wxt/utils/inject-script](../index.md) / InjectScriptOptions

# Interface: InjectScriptOptions

Source: [packages/wxt/src/utils/inject-script.ts:80](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/utils/inject-script.ts#L80)

## Contents

* [Properties](#properties)
  * [keepInDom?](#keepindom)
  * [modifyScript?](#modifyscript)

## Properties

### keepInDom?

> `optional` **keepInDom?**: `boolean`

Source: [packages/wxt/src/utils/inject-script.ts:85](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/utils/inject-script.ts#L85)

By default, the injected script is removed from the DOM after being
injected. To disable this behavior, set this flag to true.

***

### modifyScript?

> `optional` **modifyScript?**: (`script`) => `void` | `Promise`<`void`>

Source: [packages/wxt/src/utils/inject-script.ts:93](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/utils/inject-script.ts#L93)

Modify the script element just before it is added to the DOM.

It can be used to e.g. modify `script.async`/`script.defer`, add event
listeners to the element, or pass data to the script via `script.dataset`
(which can be accessed by the script via `document.currentScript`).

#### Parameters

##### script

`HTMLScriptElement`

#### Returns

`void` | `Promise`<`void`>

***

Generated using [typedoc-plugin-markdown](https://www.npmjs.com/package/typedoc-plugin-markdown) and [TypeDoc](https://typedoc.org/)
