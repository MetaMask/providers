# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
- Stop protecting overwrites of the following properties, that existing pre-`4.0.0`:
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
