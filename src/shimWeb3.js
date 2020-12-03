/**
 * If no existing window.web3 is found, this function injects a web3 "shim" to
 * not break dapps that rely on window.web3.currentProvider.
 *
 * @param {import('./MetaMaskInpageProvider')} provider - The provider to set as window.web3.currentProvider.
 * @param {typeof console} log - The logging API to use.
 */
module.exports = function shimWeb3 (provider, log = console) {
  if (!window.web3) {
    const SHIM_IDENTIFIER = '__isMetaMaskShim__'

    let web3Shim = { currentProvider: provider }
    Object.defineProperty(web3Shim, SHIM_IDENTIFIER, {
      value: true,
      enumerable: true,
      configurable: false,
      writable: false,
    })

    web3Shim = new Proxy(
      web3Shim,
      {
        get: (target, property, ...args) => {
          if (property === 'currentProvider') {
            log.warn(
              'You are accessing the MetaMask window.web3.currentProvider shim. This property is deprecated; use window.ethereum instead. For details, see: https://docs.metamask.io/guide/provider-migration.html#replacing-window-web3',
            )
          } else if (property !== SHIM_IDENTIFIER) {
            log.error(
              `MetaMask no longer injects web3. For details, see: https://docs.metamask.io/guide/provider-migration.html#replacing-window-web3`,
            )
            provider.request({ method: 'metamask_logWeb3ShimUsage' })
              .catch((error) => {
                log.debug('MetaMask: Failed to log web3 shim usage.', error)
              })
          }
          return Reflect.get(target, property, ...args)
        },
        set: (...args) => {
          log.warn(
            'You are accessing the MetaMask window.web3 shim. This object is deprecated; use window.ethereum instead. For details, see: https://docs.metamask.io/guide/provider-migration.html#replacing-window-web3',
          )
          return Reflect.set(...args)
        },
      },
    )

    Object.defineProperty(window, 'web3', {
      value: web3Shim,
      enumerable: false,
      configurable: true,
      writable: true,
    })
  }
}
