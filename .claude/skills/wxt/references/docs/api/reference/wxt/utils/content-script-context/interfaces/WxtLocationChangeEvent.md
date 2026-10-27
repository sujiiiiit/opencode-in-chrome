<!-- source: https://wxt.dev/api/reference/wxt/utils/content-script-context/interfaces/WxtLocationChangeEvent.md -->
[API](../../../../packages.md) / [wxt/utils/content-script-context](../index.md) / WxtLocationChangeEvent

# Interface: WxtLocationChangeEvent

Source: [packages/wxt/src/utils/internal/custom-events.ts:7](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/utils/internal/custom-events.ts#L7)

Fired on `window` as `wxt:locationchange` when a content script detects a
same-document URL change.

## Contents

* [Extends](#extends)
* [Properties](#properties)
  * [AT\TARGET](#at-target)
  * [bubbles](#bubbles)
  * [BUBBLING\PHASE](#bubbling-phase)
  * [cancelable](#cancelable)
  * [cancelBubble](#cancelbubble)
  * [CAPTURING\PHASE](#capturing-phase)
  * [composed](#composed)
  * [currentTarget](#currenttarget)
  * [defaultPrevented](#defaultprevented)
  * [eventPhase](#eventphase)
  * [isTrusted](#istrusted)
  * [newUrl](#newurl)
  * [NONE](#none)
  * [oldUrl](#oldurl)
  * [returnValue](#returnvalue)
  * [srcElement](#srcelement)
  * [target](#target)
  * [timeStamp](#timestamp)
  * [type](#type)
* [Methods](#methods)
  * [composedPath()](#composedpath)
  * [initEvent()](#initevent)
  * [preventDefault()](#preventdefault)
  * [stopImmediatePropagation()](#stopimmediatepropagation)
  * [stopPropagation()](#stoppropagation)

## Extends

* `Event`

## Properties

### AT\_TARGET

> `readonly` **AT\_TARGET**: `2`

Source: node\_modules/.bun/typescript@6.0.3/node\_modules/typescript/lib/lib.dom.d.ts:14273

#### Inherited from

`Event.AT_TARGET`

***

### bubbles

> `readonly` **bubbles**: `boolean`

Source: node\_modules/.bun/typescript@6.0.3/node\_modules/typescript/lib/lib.dom.d.ts:14164

The **`bubbles`** read-only property of the Event interface indicates whether the event bubbles up through the DOM tree or not.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/bubbles)

#### Inherited from

`Event.bubbles`

***

### BUBBLING\_PHASE

> `readonly` **BUBBLING\_PHASE**: `3`

Source: node\_modules/.bun/typescript@6.0.3/node\_modules/typescript/lib/lib.dom.d.ts:14274

#### Inherited from

`Event.BUBBLING_PHASE`

***

### cancelable

> `readonly` **cancelable**: `boolean`

Source: node\_modules/.bun/typescript@6.0.3/node\_modules/typescript/lib/lib.dom.d.ts:14177

The **`cancelable`** read-only property of the Event interface indicates whether the event can be canceled, and therefore prevented as if the event never happened.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/cancelable)

#### Inherited from

`Event.cancelable`

***

### ~~cancelBubble~~

> **cancelBubble**: `boolean`

Source: node\_modules/.bun/typescript@6.0.3/node\_modules/typescript/lib/lib.dom.d.ts:14171

The **`cancelBubble`** property of the Event interface is deprecated. Use Event.stopPropagation() instead. Setting its value to true before returning from an event handler prevents propagation of the event. In later implementations, setting this to false does nothing. See Browser compatibility for details.

#### Deprecated

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/cancelBubble)

#### Inherited from

`Event.cancelBubble`

***

### CAPTURING\_PHASE

> `readonly` **CAPTURING\_PHASE**: `1`

Source: node\_modules/.bun/typescript@6.0.3/node\_modules/typescript/lib/lib.dom.d.ts:14272

#### Inherited from

`Event.CAPTURING_PHASE`

***

### composed

> `readonly` **composed**: `boolean`

Source: node\_modules/.bun/typescript@6.0.3/node\_modules/typescript/lib/lib.dom.d.ts:14183

The read-only **`composed`** property of the Event interface returns a boolean value which indicates whether or not the event will propagate across the shadow DOM boundary into the standard DOM.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/composed)

#### Inherited from

`Event.composed`

***

### currentTarget

> `readonly` **currentTarget**: `EventTarget` | `null`

Source: node\_modules/.bun/typescript@6.0.3/node\_modules/typescript/lib/lib.dom.d.ts:14189

The **`currentTarget`** read-only property of the Event interface identifies the element to which the event handler has been attached.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/currentTarget)

#### Inherited from

`Event.currentTarget`

***

### defaultPrevented

> `readonly` **defaultPrevented**: `boolean`

Source: node\_modules/.bun/typescript@6.0.3/node\_modules/typescript/lib/lib.dom.d.ts:14195

The **`defaultPrevented`** read-only property of the Event interface returns a boolean value indicating whether or not the call to Event.preventDefault() canceled the event.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/defaultPrevented)

#### Inherited from

`Event.defaultPrevented`

***

### eventPhase

> `readonly` **eventPhase**: `number`

Source: node\_modules/.bun/typescript@6.0.3/node\_modules/typescript/lib/lib.dom.d.ts:14201

The **`eventPhase`** read-only property of the Event interface indicates which phase of the event flow is currently being evaluated.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/eventPhase)

#### Inherited from

`Event.eventPhase`

***

### isTrusted

> `readonly` **isTrusted**: `boolean`

Source: node\_modules/.bun/typescript@6.0.3/node\_modules/typescript/lib/lib.dom.d.ts:14207

The **`isTrusted`** read-only property of the Event interface is a boolean value that is true when the event was generated by the user agent (including via user actions and programmatic methods such as HTMLElement.focus()), and false when the event was dispatched via EventTarget.dispatchEvent(). The only exception is the click event, which initializes the isTrusted property to false in user agents.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/isTrusted)

#### Inherited from

`Event.isTrusted`

***

### newUrl

> `readonly` **newUrl**: `URL`

Source: [packages/wxt/src/utils/internal/custom-events.ts:12](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/utils/internal/custom-events.ts#L12)

The URL after the change.

***

### NONE

> `readonly` **NONE**: `0`

Source: node\_modules/.bun/typescript@6.0.3/node\_modules/typescript/lib/lib.dom.d.ts:14271

#### Inherited from

`Event.NONE`

***

### oldUrl

> `readonly` **oldUrl**: `URL`

Source: [packages/wxt/src/utils/internal/custom-events.ts:14](https://github.com/wxt-dev/wxt/blob/3978edb026a90a7fd3097613e041cb728895bb28/packages/wxt/src/utils/internal/custom-events.ts#L14)

The URL before the change.

***

### ~~returnValue~~

> **returnValue**: `boolean`

Source: node\_modules/.bun/typescript@6.0.3/node\_modules/typescript/lib/lib.dom.d.ts:14214

The Event property **`returnValue`** indicates whether the default action for this event has been prevented or not.

#### Deprecated

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/returnValue)

#### Inherited from

`Event.returnValue`

***

### ~~srcElement~~

> `readonly` **srcElement**: `EventTarget` | `null`

Source: node\_modules/.bun/typescript@6.0.3/node\_modules/typescript/lib/lib.dom.d.ts:14221

The deprecated **`Event.srcElement`** is an alias for the Event.target property. Use Event.target instead.

#### Deprecated

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/srcElement)

#### Inherited from

`Event.srcElement`

***

### target

> `readonly` **target**: `EventTarget` | `null`

Source: node\_modules/.bun/typescript@6.0.3/node\_modules/typescript/lib/lib.dom.d.ts:14227

The read-only **`target`** property of the Event interface is a reference to the object onto which the event was dispatched. It is different from Event.currentTarget when the event handler is called during the bubbling or capturing phase of the event.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/target)

#### Inherited from

`Event.target`

***

### timeStamp

> `readonly` **timeStamp**: `number`

Source: node\_modules/.bun/typescript@6.0.3/node\_modules/typescript/lib/lib.dom.d.ts:14233

The **`timeStamp`** read-only property of the Event interface returns the time (in milliseconds) at which the event was created.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/timeStamp)

#### Inherited from

`Event.timeStamp`

***

### type

> `readonly` **type**: `string`

Source: node\_modules/.bun/typescript@6.0.3/node\_modules/typescript/lib/lib.dom.d.ts:14239

The **`type`** read-only property of the Event interface returns a string containing the event's type. It is set when the event is constructed and is the name commonly used to refer to the specific event, such as click, load, or error.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/type)

#### Inherited from

`Event.type`

## Methods

### composedPath()

#### Call Signature

> **composedPath**(): `EventTarget`\[]

Source: node\_modules/.bun/typescript@6.0.3/node\_modules/typescript/lib/lib.dom.d.ts:14245

The **`composedPath()`** method of the Event interface returns the event's path which is an array of the objects on which listeners will be invoked. This does not include nodes in shadow trees if the shadow root was created with its ShadowRoot.mode closed.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/composedPath)

##### Returns

`EventTarget`\[]

##### Inherited from

`Event.composedPath`

#### Call Signature

> **composedPath**(): `EventTarget`\[]

Source: node\_modules/.bun/typescript@6.0.3/node\_modules/typescript/lib/lib.webworker.d.ts:4378

The **`composedPath()`** method of the Event interface returns the event's path which is an array of the objects on which listeners will be invoked. This does not include nodes in shadow trees if the shadow root was created with its ShadowRoot.mode closed.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/composedPath)

##### Returns

`EventTarget`\[]

##### Inherited from

`Event.composedPath`

***

### ~~initEvent()~~

#### Call Signature

> **initEvent**(`type`, `bubbles?`, `cancelable?`): `void`

Source: node\_modules/.bun/typescript@6.0.3/node\_modules/typescript/lib/lib.dom.d.ts:14252

The **`Event.initEvent()`** method is used to initialize the value of an event created using Document.createEvent().

##### Parameters

###### type

`string`

###### bubbles?

`boolean`

###### cancelable?

`boolean`

##### Returns

`void`

##### Deprecated

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/initEvent)

##### Inherited from

`Event.initEvent`

#### Call Signature

> **initEvent**(`type`, `bubbles?`, `cancelable?`): `void`

Source: node\_modules/.bun/typescript@6.0.3/node\_modules/typescript/lib/lib.webworker.d.ts:4385

The **`Event.initEvent()`** method is used to initialize the value of an event created using Document.createEvent().

##### Parameters

###### type

`string`

###### bubbles?

`boolean`

###### cancelable?

`boolean`

##### Returns

`void`

##### Deprecated

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/initEvent)

##### Inherited from

`Event.initEvent`

***

### preventDefault()

#### Call Signature

> **preventDefault**(): `void`

Source: node\_modules/.bun/typescript@6.0.3/node\_modules/typescript/lib/lib.dom.d.ts:14258

The **`preventDefault()`** method of the Event interface tells the user agent that the event is being explicitly handled, so its default action, such as page scrolling, link navigation, or pasting text, should not be taken.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/preventDefault)

##### Returns

`void`

##### Inherited from

`Event.preventDefault`

#### Call Signature

> **preventDefault**(): `void`

Source: node\_modules/.bun/typescript@6.0.3/node\_modules/typescript/lib/lib.webworker.d.ts:4391

The **`preventDefault()`** method of the Event interface tells the user agent that the event is being explicitly handled, so its default action, such as page scrolling, link navigation, or pasting text, should not be taken.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/preventDefault)

##### Returns

`void`

##### Inherited from

`Event.preventDefault`

***

### stopImmediatePropagation()

#### Call Signature

> **stopImmediatePropagation**(): `void`

Source: node\_modules/.bun/typescript@6.0.3/node\_modules/typescript/lib/lib.dom.d.ts:14264

The **`stopImmediatePropagation()`** method of the Event interface prevents other listeners of the same event from being called.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/stopImmediatePropagation)

##### Returns

`void`

##### Inherited from

`Event.stopImmediatePropagation`

#### Call Signature

> **stopImmediatePropagation**(): `void`

Source: node\_modules/.bun/typescript@6.0.3/node\_modules/typescript/lib/lib.webworker.d.ts:4397

The **`stopImmediatePropagation()`** method of the Event interface prevents other listeners of the same event from being called.

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/stopImmediatePropagation)

##### Returns

`void`

##### Inherited from

`Event.stopImmediatePropagation`

***

### stopPropagation()

#### Call Signature

> **stopPropagation**(): `void`

Source: node\_modules/.bun/typescript@6.0.3/node\_modules/typescript/lib/lib.dom.d.ts:14270

The **`stopPropagation()`** method of the Event interface prevents further propagation of the current event in the capturing and bubbling phases. It does not, however, prevent any default behaviors from occurring; for instance, clicks on links are still processed. If you want to stop those behaviors, see the preventDefault() method. It also does not prevent propagation to other event-handlers of the current element. If you want to stop those, see stopImmediatePropagation().

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/stopPropagation)

##### Returns

`void`

##### Inherited from

`Event.stopPropagation`

#### Call Signature

> **stopPropagation**(): `void`

Source: node\_modules/.bun/typescript@6.0.3/node\_modules/typescript/lib/lib.webworker.d.ts:4403

The **`stopPropagation()`** method of the Event interface prevents further propagation of the current event in the capturing and bubbling phases. It does not, however, prevent any default behaviors from occurring; for instance, clicks on links are still processed. If you want to stop those behaviors, see the preventDefault() method. It also does not prevent propagation to other event-handlers of the current element. If you want to stop those, see stopImmediatePropagation().

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/stopPropagation)

##### Returns

`void`

##### Inherited from

`Event.stopPropagation`

***

Generated using [typedoc-plugin-markdown](https://www.npmjs.com/package/typedoc-plugin-markdown) and [TypeDoc](https://typedoc.org/)
