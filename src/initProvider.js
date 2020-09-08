const MetaMaskInpageProvider = require('./MetaMaskInpageProvider')

/**
 * Initializes a MetaMaskInpageProvider and (optionally) assigns it as window.ethereum.
 *
 * @param {Object} options - An options bag.
 * @param {Object} options.connectionStream - A Node.js stream.
 * @param {number} options.maxEventListeners - The maximum number of event listeners.
 * @param {boolean} options.shouldSendMetadata - Whether the provider should send page metadata.
 * @param {boolean} options.shouldSetOnWindow - Whether the provider should be set as window.ethereum
 * @returns {MetaMaskInpageProvider | Proxy} The initialized provider (whether set or not).
 */
function initProvider ({
  connectionStream,
  maxEventListeners = 100,
  shouldSendMetadata = true,
  shouldSetOnWindow = true,
} = {}) {

  let provider = new MetaMaskInpageProvider(
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
 * @param {MetaMaskInpageProvider} providerInstance - The provider instance.
 */
function setGlobalProvider (providerInstance) {
  window.ethereum = providerInstance
  window.dispatchEvent(new Event('ethereum#initialized'))
}

module.exports = {
  initProvider,
  setGlobalProvider,
}
