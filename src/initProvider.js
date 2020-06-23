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

  let wasAccessed = false
  let lastTimeUsed

  if (!connectionStream) {
    throw new Error('Must provide a connection stream.')
  }

  const provider = new MetamaskInpageProvider(
    connectionStream, { shouldSendMetadata, maxEventListeners },
  )

  // listener added here to not trigger proxy handlers
  provider.once('chainChanged', () => {
    if (wasAccessed && provider.reloadOnChainChange) {
      const timeSinceUse = lastTimeUsed ? Date.now() - lastTimeUsed : 0
      if (timeSinceUse > 500) {
        window.location.reload()
      } else {
        setTimeout(() => window.location.reload(), 500)
      }
    }
  })

  const recordProviderAccess = () => {
    if (!wasAccessed) {
      wasAccessed = true
    }
    lastTimeUsed = Date.now()
  }

  const providerProxy = new Proxy(provider, {
    deleteProperty: () => true, // Some libraries, e.g. web3@1.x, mess with our API.
    get: (target, prop, receiver) => {
      recordProviderAccess()
      return Reflect.get(target, prop, receiver)
    },
    set: (target, prop, value, receiver) => {
      recordProviderAccess()
      return Reflect.set(target, prop, value, receiver)
    },
  })

  if (shouldSetOnWindow) {
    setGlobalProvider(providerProxy)
  }

  return providerProxy
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
