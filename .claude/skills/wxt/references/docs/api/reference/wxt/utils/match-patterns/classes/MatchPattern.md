<!-- source: https://wxt.dev/api/reference/wxt/utils/match-patterns/classes/MatchPattern.md -->
[API](../../../../packages.md) / [wxt/utils/match-patterns](../index.md) / MatchPattern

# Class: MatchPattern

Source: node\_modules/.bun/@webext-core+match-patterns@2.0.0/node\_modules/@webext-core/match-patterns/dist/index.d.mts:11

Class for parsing and performing operations on match patterns.

## Contents

* [Example](#example)
* [Constructors](#constructors)
  * [Constructor](#constructor)
* [Properties](#properties)
  * [PROTOCOLS](#protocols)
* [Methods](#methods)
  * [includes()](#includes)

## Example

```ts
const pattern = new MatchPattern('*://google.com/*');

  pattern.includes('https://google.com'); // true
  pattern.includes('http://youtube.com/watch?v=123'); // false
```

## Constructors

### Constructor

> **new MatchPattern**(`matchPattern`): `MatchPattern`

Source: node\_modules/.bun/@webext-core+match-patterns@2.0.0/node\_modules/@webext-core/match-patterns/dist/index.d.mts:23

Parse a match pattern string. If it is invalid, the constructor will throw an
`InvalidMatchPattern` error.

#### Parameters

##### matchPattern

`string`

The match pattern to parse.

#### Returns

`MatchPattern`

## Properties

### PROTOCOLS

> `static` **PROTOCOLS**: `string`\[]

Source: node\_modules/.bun/@webext-core+match-patterns@2.0.0/node\_modules/@webext-core/match-patterns/dist/index.d.mts:12

## Methods

### includes()

> **includes**(`url`): `boolean`

Source: node\_modules/.bun/@webext-core+match-patterns@2.0.0/node\_modules/@webext-core/match-patterns/dist/index.d.mts:25

Check if a URL is included in a pattern.

#### Parameters

##### url

`string` | `URL` | `Location`

#### Returns

`boolean`

***

Generated using [typedoc-plugin-markdown](https://www.npmjs.com/package/typedoc-plugin-markdown) and [TypeDoc](https://typedoc.org/)
