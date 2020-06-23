const EventEmitter = require('events')
const log = require('loglevel')
const { ethErrors, serializeError } = require('eth-json-rpc-errors')
const SafeEventEmitter = require('safe-event-emitter')
const messages = require('./messages')

// utility functions

/**
 * json-rpc-engine middleware that both logs standard and non-standard error
 * messages and ends middleware stack traversal if an error is encountered
 *
 * @returns {Function} json-rpc-engine middleware function
 */
function createErrorMiddleware () {
  return (req, res, next) => {

    // json-rpc-engine will terminate the request when it notices this error
    if (!req.method || typeof req.method !== 'string') {
      res.error = ethErrors.rpc.invalidRequest({
        message: `The request 'method' must be a non-empty string.`,
        data: req,
      })
    }

    next((done) => {
      const { error } = res
      if (!error) {
        return done()
      }
      serializeError(error)
      log.error(`MetaMask - RPC Error: ${error.message}`, error)
      return done()
    })
  }
}

// resolve response.result or response, reject errors
const getRpcPromiseCallback = (resolve, reject, unwrapResult = true) => (error, response) => {
  if (error || response.error) {
    reject(error || response.error)
  } else {
    !unwrapResult || Array.isArray(response)
      ? resolve(response)
      : resolve(response.result)
  }
}

/**
 * Logs a stream disconnection error. Emits an 'error' if bound to an
 * EventEmitter that has listeners for the 'error' event.
 *
 * @param {string} remoteLabel - The label of the disconnected stream.
 * @param {Error} err - The associated error to log.
 */
function logStreamDisconnectWarning (remoteLabel, err) {
  let warningMsg = `MetamaskInpageProvider - lost connection to ${remoteLabel}`
  if (err) {
    warningMsg += `\n${err.stack}`
  }
  log.warn(warningMsg)
  if (this instanceof EventEmitter || this instanceof SafeEventEmitter) {
    if (this.listenerCount('error') > 0) {
      this.emit('error', warningMsg)
    }
  }
}

/**
 * Defines the reload on chain change properties on a provider instance.
 * Intended for use in MetamaskInpageProvider constructor.
 *
 * This helper exists because we want these properties to refer to an internal
 * state value, via get/set handlers, and also be enumerable.
 *
 * @param {MetamaskInpageProvider} instance - The provider instance.
 */
function defineAutoReloadProperties (instance) {

  const autoRefreshWarning = () => {
    if (!instance._state.sentWarnings.autoRefresh) {
      log.warn(messages.warnings.autoRefreshDeprecation)
      instance._state.sentWarnings.autoRefresh = true
    }
  }

  Object.defineProperty(instance, 'autoRefreshOnNetworkChange', {
    enumerable: true,
    get: () => {
      autoRefreshWarning()
      return instance._state.reloadOnChainChange
    },
    set: (value) => {
      autoRefreshWarning()
      instance._state.reloadOnChainChange = Boolean(value)
    },
  })

  Object.defineProperty(instance, 'reloadOnChainChange', {
    enumerable: true,
    get: () => {
      return instance._state.reloadOnChainChange
    },
    set: (value) => {
      instance._state.reloadOnChainChange = Boolean(value)
    },
  })
}

// eslint-disable-next-line no-empty-function
const NOOP = () => {}

// constants

const EMITTED_NOTIFICATIONS = [
  'eth_subscription', // per eth-json-rpc-filters/subscriptionManager
]

module.exports = {
  createErrorMiddleware,
  defineAutoReloadProperties,
  EMITTED_NOTIFICATIONS,
  getRpcPromiseCallback,
  logStreamDisconnectWarning,
  NOOP,
}
