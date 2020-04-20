const MetamaskInpageProvider = require('./MetamaskInpageProvider')

/**
   * Initializes a MetamaskInpageProvider and (optionally) sets it on window.ethereum.
   *
   * @param {Object} opts - An options bag.
   * @param {Object} opts.connectionStream - A Node.js stream.
   * @param {number} opts.maxEventListeners - The maximum number of event listeners.
   * @param {boolean} opts.preventPropertyDeletion - Whether to wrap the provider in a proxy that prevents property deletion.
   * @param {boolean} opts.shouldSendMetadata - Whether the provider should send page metadata.
   * @param {boolean} opts.shouldSetOnWindow - Whether the provider should be set as window.ethereum
   * @returns {MetamaskInpageProvider | Proxy} The initialized provider (whether set or not).
   */
function initProvider ({
  connectionStream,
  maxEventListeners = 100,
  preventPropertyDeletion = true,
  shouldSendMetadata = true,
  shouldSetOnWindow = true,
}) {

  if (!connectionStream) {
    throw new Error('Must provide a connection stream.')
  }

  let provider = new MetamaskInpageProvider(
    connectionStream, { shouldSendMetadata, maxEventListeners },
  )

  if (preventPropertyDeletion) {
    // Workaround for web3@1.0 deleting the bound `sendAsync` but not the unbound
    // `sendAsync` method on the prototype, causing `this` reference issues
    provider = new Proxy(provider, {
      deleteProperty: () => true,
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
