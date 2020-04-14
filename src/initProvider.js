const MetamaskInpageProvider = require('./MetamaskInpageProvider')

/**
   * Initializes a MetamaskInpageProvider and (optionally) sets it on window.ethereum.
   *
   * @param {Object} opts - An options bag.
   * @param {Object} opts.connectionStream - A Node.js stream.
   * @param {number} opts.maxEventListeners - The maximum number of event listeners.
   * @param {boolean} opts.shouldSendMetadata - Whether the provider should send page metadata.
   * @param {Object} opts.proxyHandler - A proxy handler object. The provider is proxied if present.
   * @param {boolean} opts.shouldSet - Whether the provider should be set as window.ethereum
   * @returns {MetamaskInpageProvider | Proxy} The initialized provider (whether set or not).
   */
function initProvider ({
  connectionStream,
  shouldSendMetadata = true,
  maxEventListeners = 100,
  proxyHandler,
  shouldSet = true,
}) {

  if (!connectionStream) {
    throw new Error('Must provide a connection stream.')
  }

  let provider = new MetamaskInpageProvider(
    connectionStream, { shouldSendMetadata, maxEventListeners },
  )

  if (proxyHandler) {
    provider = new Proxy(provider, proxyHandler)
  }

  if (shouldSet) {
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
