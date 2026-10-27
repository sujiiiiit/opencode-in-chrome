<!-- source: https://wxt.dev/api/reference/wxt/utils/define-app-config/functions/defineAppConfig.md -->
[API](../../../../packages.md) / [wxt/utils/define-app-config](../index.md) / defineAppConfig

# Function: defineAppConfig()

> **defineAppConfig**(`config`): [`WxtAppConfig`](../interfaces/WxtAppConfig.md)

Source: [packages/wxt/src/utils/define-app-config.ts:21](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/utils/define-app-config.ts#L21)

Runtime app config defined in `<srcDir>/app.config.ts`.

You can add fields to this interface via ["Module
Augmentation"](https://www.typescriptlang.org/docs/handbook/declaration-merging.html#module-augmentation):

```ts
// app.config.ts
import 'wxt/utils/define-app-config';

declare module 'wxt/utils/define-app-config' {
  export interface WxtAppConfig {
    analytics: AnalyticsConfig;
  }
}
```

## Parameters

### config

[`WxtAppConfig`](../interfaces/WxtAppConfig.md)

## Returns

[`WxtAppConfig`](../interfaces/WxtAppConfig.md)

***

Generated using [typedoc-plugin-markdown](https://www.npmjs.com/package/typedoc-plugin-markdown) and [TypeDoc](https://typedoc.org/)
