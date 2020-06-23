const MetamaskInpageProvider = require('./MetamaskInpageProvider')

/**
   * Initializes a MetamaskInpageProvider and (optionally) sets it on window.ethereum.
   *
   * @param {Object} opts - An options bag.
   * @param {Object} opts.connectionStream - A Node.js stream.
   * @param {number} opts.maxEventListeners - The maximum number of event listeners.
   * @param {boolean} opts.shouldSendMetadata - Whether the provider should send page metadata.
   * @param {boolean} opts.shouldSetOnWindow - Whether the provider should be set as window.ethereum
   * @returns {MetamaskInpageProvider | Proxy} The initialized provider (whether set or not).
   */
function initProvider ({
  connectionStream,
  maxEventListeners = 100,
  shouldSendMetadata = true,
  shouldSetOnWindow = true,
} = {}) {

  if (!connectionStream) {
    throw new Error('Must provide a connection stream.')
  }

  let provider = new MetamaskInpageProvider(
    connectionStream, { shouldSendMetadata, maxEventListeners },
  )

  provider = new Proxy(provider, {
    deleteProperty: () => true, // some libraries, e.g. web3@1.x, mess with our API
  })

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
