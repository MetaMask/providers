const MetaMaskInpageProvider = require('./MetaMaskInpageProvider')
const shimWeb3 = require('./shimWeb3')

/**
 * Initializes a MetaMaskInpageProvider and (optionally) assigns it as window.ethereum.
 *
 * @param {Object} options - An options bag.
 * @param {Object} options.connectionStream - A Node.js stream.
 * @param {string} [options.jsonRpcStreamName] - The name of the internal JSON-RPC stream.
 * @param {number} [options.maxEventListeners] - The maximum number of event listeners.
 * @param {boolean} [options.shouldSendMetadata] - Whether the provider should send page metadata.
 * @param {boolean} [options.shouldSetOnWindow] - Whether the provider should be set as window.ethereum.
 * @param {boolean} [options.shouldShimWeb3] - Whether a window.web3 shim should be injected.
 * @returns {MetaMaskInpageProvider | Proxy} The initialized provider (whether set or not).
 */
function initializeProvider ({
  connectionStream,
  jsonRpcStreamName,
  logger = console,
  maxEventListeners = 100,
  shouldSendMetadata = true,
  shouldSetOnWindow = true,
  shouldShimWeb3 = false,
} = {}) {

  let provider = new MetaMaskInpageProvider(
    connectionStream,
    {
      logger,
      jsonRpcStreamName,
      maxEventListeners,
      shouldSendMetadata,
    },
  )

  provider = new Proxy(provider, {
    // some common libraries, e.g. web3@1.x, mess with our API
    deleteProperty: () => true,
  })

  if (shouldSetOnWindow) {
    setGlobalProvider(provider)
  }

  if (shouldShimWeb3) {
    shimWeb3(provider, logger)
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
  initializeProvider,
  setGlobalProvider,
}
