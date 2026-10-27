<!-- source: https://wxt.dev/api/reference/wxt/interfaces/ConfigEnv.md -->
[API](../../packages.md) / [wxt](../index.md) / ConfigEnv

# Interface: ConfigEnv

Source: [packages/wxt/src/types.ts:1173](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L1173)

## Contents

* [Properties](#properties)
  * [browser](#browser)
  * [command](#command)
  * [manifestVersion](#manifestversion)
  * [mode](#mode)

## Properties

### browser

> **browser**: `string`

Source: [packages/wxt/src/types.ts:1188](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L1188)

Browser passed in from the CLI via the `-b` or `--browser` flag. Defaults
to `"chrome"` when not passed.

***

### command

> **command**: [`WxtCommand`](../type-aliases/WxtCommand.md)

Source: [packages/wxt/src/types.ts:1183](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L1183)

The command used to run WXT. `"serve"` during development and `"build"` for
any other command.

***

### manifestVersion

> **manifestVersion**: `2` | `3`

Source: [packages/wxt/src/types.ts:1195](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L1195)

Manifest version passed in from the CLI via the `--mv2` or `--mv3` flags.
When not passed, it depends on the target browser. See [the
guide](https://wxt.dev/guide/essentials/target-different-browsers.html#target-a-manifest-version)
for more details.

***

### mode

> **mode**: `string`

Source: [packages/wxt/src/types.ts:1178](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/types.ts#L1178)

The build mode passed into the CLI. By default, `wxt` uses `"development"`
and `wxt build|zip` uses `"production"`.

***

Generated using [typedoc-plugin-markdown](https://www.npmjs.com/package/typedoc-plugin-markdown) and [TypeDoc](https://typedoc.org/)
