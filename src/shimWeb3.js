/**
 * If no existing window.web3 is found, this function injects a web3 "shim" to
 * not break dapps that rely on window.web3.currentProvider.
 *
 * @param {import('./MetaMaskInpageProvider')} provider - The provider to set as window.web3.currentProvider.
 */
module.exports = function shimWeb3 (provider) {
  if (!window.web3) {
    const SHIM_IDENTIFIER = '__isMetaMaskShim__'
    const web3Shim = new Proxy(
      {
        currentProvider: provider,
        [SHIM_IDENTIFIER]: true,
      },
      {
        get: (target, property, ...args) => {
          if (property === 'currentProvider') {
            console.warn(
              'You are accessing the MetaMask window.web3.currentProvider shim. Just use window.ethereum instead. For details, see: https://docs.metamask.io/guide/provider-migration.html#replacing-window-web3',
            )
          } else if (property !== SHIM_IDENTIFIER) {
            console.error(
              `MetaMask no longer injects web3. For details, see: https://docs.metamask.io/guide/provider-migration.html#replacing-window-web3`,
            )
          }
          return Reflect.get(target, property, ...args)
        },
      },
    )

    Object.defineProperty(window, 'web3', {
      value: Object.freeze(web3Shim),
      enumerable: false,
      configurable: true,
      writable: true,
    })
  }
}
