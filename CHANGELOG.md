# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [7.0.0] - 2020-09-08

### Changed

- **BREAKING:** Changed casing of `Metamask` in all exports to `MetaMask`
  - A brand is a brand ¯\\_(ツ)_/¯

## [6.3.0] - 2020-09-04

### Added

- Types

### Changed

- `ethereum.networkVersion` and `.chainId` now default to `null` instead of `undefined`
- Improved JSDoc comments and tags

## [6.2.0] - 2020-08-04

### Added

- Package consumers can now provide a `logger` object to the provider constructor, to override the default logger
  - The default logger is the `console` global
  - The following methods are required: `debug`, `error`, `info`, `log`, `trace`

## [6.1.1] - 2020-07-28

### Changed

- Updated dependencies, which produces a smaller bundle size

## [6.1.0] - 2020-07-21

### Changed

- Only emit `data` event for notifications present in `^4.0.0`
([#73](https://github.com/MetaMask/inpage-provider/pull/73))
  - Some consumers make assumptions about the shape of the object emitted with the event that do not hold for all notifications in `^6.0.0`.
- Select icon using `rel~="icon"` when retrieving site metadata
([#76](https://github.com/MetaMask/inpage-provider/pull/76))
  - This is instead of defaulting to `rel="shortcut icon"`.

### Fixed

- Emit `accountsChanged` event _after_ all related state has been updated
([#72](https://github.com/MetaMask/inpage-provider/pull/72))
  - For example, `ethereum.selectedAddress` will now have been updated by the time the event is emitted.
- Enable retrieval of site icons _not_ hosted on the same origin
([#78](https://github.com/MetaMask/inpage-provider/pull/78))
  - For example, icons hosted on `assets.foo.com` that are used on `foo.com` will now be retrieved successfully.

## [6.0.1] - 2020-07-15

### Fixed

- Warning message for the `data` event
  - This deprecated event was added back in `6.0.0`, but the warning message was not defined.
- Restore `publicConfigStore` property as alias for `_publicConfigStore`
  - The `_publicConfigStore` was named `publicConfigStore` before `4.0.0`.
  The original property turned out to be used by consumers.
  The store is scheduled to be removed completely, and accessing `publicConfigStore` emits a warning.

## [6.0.0] - 2020-07-04

### Added

- The `data` event
  - This event was removed in `4.0.0`, as it was thought to only be used internally.
  This assumption was incorrect, and the event is now restored.

### Changed

- Restore the `notification` event value to its pre-`4.0.0` state
  - Prior to `4.0.0` this event was emitted by code in the MetaMask extension.
  Its value was inadvertently changed when it was moved to this package.

## [5.2.1] - 2020-06-29

### Changed

- Un-deprecate `isConnected` method.

## [5.2.0] - 2020-06-24

### Changed

- Remove property protections
  - Unless we lock down the entire provide object, which we can't do, a determined consumer can break our provider. Thus, protected properties are pointless.
- Fix `requests` `params` type checks
- Update deprecation warning messages per most recent deprecation plans

## [5.1.0] - 2020-06-01

### Changed

- Update `request` `params` type to `unknown[] | object`
  - This is not breaking in practice, since no RPC methods with other `params` values exist.

## [5.0.2] - 2020-05-22

### Changed

- Fix `ethereum.send` return value for certain argument combination
  - Reverted to pre-`4.0.0` state
- Stop protecting overwrites of the following properties, that existed prior to `4.0.0`:
  - `ethereum.isMetaMask`
  - `ethereum._metamask`
- Protect the following new, private properties required for `ethereum.request` to work:
  - `ethereum._rpcRequest`
  - `ethereum._rpcEngine`

## [5.0.1] - 2020-05-11

### Changed

- Rename package to [@metamask/inpage-provider](https://www.npmjs.com/package/@metamask/inpage-provider)
- Prevent overwrite of certain properties on the Provider
  - `ethereum.request`
  - `ethereum.isMetaMask`
  - `ethereum._metamask`

## [5.0.0] - 2020-04-22

### Added

- The [most recent EIP 1193 API](https://github.com/ethereum/EIPs/blob/89e373d5d3a62a28f2646830247579f323ef6b40/EIPS/eip-1193.md) ([#30](https://github.com/MetaMask/inpage-provider/pull/30))
  - The method `request`
  - The events `disconnect` and `message`
- A global initialization event, `ethereum#initialized`, for
  asynchronous injection ([#31](https://github.com/MetaMask/inpage-provider/pull/31))
- Helper methods for initializing the provider ([#31](https://github.com/MetaMask/inpage-provider/pull/31))

### Changed

- **BREAKING:** Use named instead of default exports ([#31](https://github.com/MetaMask/inpage-provider/pull/31))
- **BREAKING:** `MetaMaskInpage` constructor now takes a `connectionStream` and an
  options object ([#31](https://github.com/MetaMask/inpage-provider/pull/31))
- **BREAKING:** `_metamask.sendBatch` -> `_metamask.requestBatch` ([#30](https://github.com/MetaMask/inpage-provider/pull/30))
- **BREAKING:** Revert `send` to match provider in v7.7.8 of `metamask-extension` ([#29](https://github.com/MetaMask/inpage-provider/pull/29))
- The `connect` event now emits with a `ProviderConnectInfo` object per EIP 1193 ([#30](https://github.com/MetaMask/inpage-provider/pull/30))
- Deprecated the `send` method ([#30](https://github.com/MetaMask/inpage-provider/pull/30))
- Deprecated the events `close`, `networkChanged`, and `notification`, and
  added deprecation warnings for them ([#30](https://github.com/MetaMask/inpage-provider/pull/30))
- Un-deprecated `sendAsync` ([#29](https://github.com/MetaMask/inpage-provider/pull/29))

[Unreleased]:https://github.com/MetaMask/inpage-provider/compare/v7.0.0...HEAD
[7.0.0]:https://github.com/MetaMask/inpage-provider/compare/v6.3.0...v7.0.0
[6.3.0]:https://github.com/MetaMask/inpage-provider/compare/v6.2.0...v6.3.0
[6.2.0]:https://github.com/MetaMask/inpage-provider/compare/v6.1.1...v6.2.0
[6.1.1]:https://github.com/MetaMask/inpage-provider/compare/v6.1.0...v6.1.1
[6.1.0]:https://github.com/MetaMask/inpage-provider/compare/v6.0.1...v6.1.0
[6.0.1]:https://github.com/MetaMask/inpage-provider/compare/v6.0.0...v6.0.1
[6.0.0]:https://github.com/MetaMask/inpage-provider/compare/v5.2.1...v6.0.0
[5.2.1]:https://github.com/MetaMask/inpage-provider/compare/v5.2.0...v5.2.1
[5.2.0]:https://github.com/MetaMask/inpage-provider/compare/v5.1.0...v5.2.0
[5.1.0]:https://github.com/MetaMask/inpage-provider/compare/v5.0.2...v5.1.0
[5.0.2]:https://github.com/MetaMask/inpage-provider/compare/v5.0.1...v5.0.2
[5.0.1]:https://github.com/MetaMask/inpage-provider/compare/v5.0.0...v5.0.1
[5.0.0]:https://github.com/MetaMask/inpage-provider/compare/v4.1.2...v5.0.0
