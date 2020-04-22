# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [5.0.0] - 2020-04-22

### Added

- The [most recent EIP 1193 API](https://github.com/ethereum/EIPs/blob/89e373d5d3a62a28f2646830247579f323ef6b40/EIPS/eip-1193.md) ([#30](https://github.com/MetaMask/metamask-inpage-provider/pull/30))
  - The method `request`
  - The events `disconnect` and `message`
- A global initialization event, `ethereum#initialized`, for
  asynchronous injection ([#31](https://github.com/MetaMask/metamask-inpage-provider/pull/31))
- Helper methods for initializing the provider ([#31](https://github.com/MetaMask/metamask-inpage-provider/pull/31))

### Changed

- **BREAKING:** Use named instead of default exports ([#31](https://github.com/MetaMask/metamask-inpage-provider/pull/31))
- **BREAKING:** `MetaMaskInpage` constructor now takes a `connectionStream` and an
  options object ([#31](https://github.com/MetaMask/metamask-inpage-provider/pull/31))
- **BREAKING:** `_metamask.sendBatch` -> `_metamask.requestBatch` ([#30](https://github.com/MetaMask/metamask-inpage-provider/pull/30))
- The `connect` event now emits with a `ProviderConnectInfo` object per EIP 1193 ([#30](https://github.com/MetaMask/metamask-inpage-provider/pull/30))
- Deprecated the `send` method ([#30](https://github.com/MetaMask/metamask-inpage-provider/pull/30))
- Deprecated the events `close`, `networkChanged`, and `notification`, and
  added deprecation warnings for them ([#30](https://github.com/MetaMask/metamask-inpage-provider/pull/30))
- Un-deprecated `sendAsync` ([#29](https://github.com/MetaMask/metamask-inpage-provider/pull/29))
- Revert `send` to `3.x` state ([#29](https://github.com/MetaMask/metamask-inpage-provider/pull/29))
