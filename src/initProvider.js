const MetamaskInpageProvider = require('./MetamaskInpageProvider')

/**
   * Initializes a MetamaskInpageProvider and (optionally) sets it on window.ethereum.
   *
   * @param {Object} opts - An options bag.
   * @param {Object} opts.connectionStream - A Node.js stream.
   * @param {number} opts.maxEventListeners - The maximum number of event listeners.
   * @param {boolean} opts.protectProperties - Whether to wrap the provider
   * in a proxy that prevents property deletion and some property overwrites.
   * @param {boolean} opts.shouldSendMetadata - Whether the provider should send page metadata.
   * @param {boolean} opts.shouldSetOnWindow - Whether the provider should be set as window.ethereum
   * @returns {MetamaskInpageProvider | Proxy} The initialized provider (whether set or not).
   */
function initProvider ({
  connectionStream,
  maxEventListeners = 100,
  protectProperties = true,
  shouldSendMetadata = true,
  shouldSetOnWindow = true,
}) {

  const PROTECTED_PROPERTIES = new Set([
    '_handleAccountsChanged',
    '_handleDisconnect',
    '_metamask',
    '_publicConfigStore',
    '_rpcEngine',
    '_rpcRequest',
    '_sendSync',
    '_state',
    'isMetaMask',
    'request',
  ])

  if (!connectionStream) {
    throw new Error('Must provide a connection stream.')
  }

  let provider = new MetamaskInpageProvider(
    connectionStream, { shouldSendMetadata, maxEventListeners },
  )

  if (protectProperties) {
    // Some libraries, e.g. web3@1.x, mess with our API.
    provider = new Proxy(provider, {
      deleteProperty: () => true,
      set: (target, prop, value, receiver) => {
        if (PROTECTED_PROPERTIES.has(prop)) {
          throw new Error(`MetaMask: Overwriting 'ethereum.${prop}' is forbidden.`)
        } else {
          return Reflect.set(target, prop, value, receiver)
        }
      },
    })
  }

  if (shouldSetOnWindow) {
    setGlobalProvider(provider)
  }

  return provider
}

/**
 * Sets the given provider instance as window.ethereum and dispatches the
 * 'ethereum#initialized' event on window.
 *
 * @param {MetamaskInpageProvider} providerInstance - The provider instance.
 */
function setGlobalProvider (providerInstance) {
  window.ethereum = providerInstance
  window.dispatchEvent(new Event('ethereum#initialized'))
}

module.exports = {
  initProvider,
  setGlobalProvider,
}
