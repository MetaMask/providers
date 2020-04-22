# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [5.0.0] - 2020-04-22

### Added

- (#30) The [most recent EIP 1193 API](https://github.com/ethereum/EIPs/blob/89e373d5d3a62a28f2646830247579f323ef6b40/EIPS/eip-1193.md), including:
  - The method `request`
  - The events `disconnect` and `message`
- (#31) A global initialization event, `ethereum#initialized`, for
  asynchronous injection
- (#31) Helper methods for initializing the provider
- This CHANGELOG file to hopefully serve as an evolving example of a
  standardized open source project CHANGELOG

### Changed

- (#30) The `connect` event now emits with a `ProviderConnectInfo` object per EIP 1193
- (#30) Deprecated the `send` method
- (#30) Deprecated the events `close`, `networkChanged`, and `notification`, and
  added deprecation warnings for them
- (#30) `_metamask.sendBatch` -> `_metamask.requestBatch`
- (#31) Use named instead of default exports
- (#31) `MetaMaskInpage` constructor now takes a `connectionStream` and an
  options object
- (#29) Un-deprecated `sendAsync`
