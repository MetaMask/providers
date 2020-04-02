const EventEmitter = require('events')
const log = require('loglevel')
const { ethErrors, serializeError } = require('eth-json-rpc-errors')
const SafeEventEmitter = require('safe-event-emitter')

/**
 * Middleware configuration object
 *
 * @typedef {Object} MiddlewareConfig
 */

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
 * TODO:deprecate:2020-Q1
 * Adds hidden "then" and "catch" properties to the given object. When returned
 * from a function, the given object will appear unchanged. If, however, the
 * caller expects a Promise, it will behave like a Promise that resolves to
 * the value of the indicated property.
 *
 * @param {Object} obj - The object to make thenable.
 * @param {string} prop - The property whose value the object's then function resolves to.
 * @returns {Object} - The secretly thenable object.
 */
function makeThenable (obj, prop) {

  // don't do anything to Promises
  if (obj instanceof Promise) {
    return obj
  }

  const defineOpts = {
    configurable: true, writable: true, enumerable: false,
  }

  // strange wrapping of Promise functions to fully emulate .then behavior,
  // specifically Promise chaining
  // there may be a simpler way of doing it, but this works
  const thenFunction = (consumerResolve, consumerCatch) => {
    return Promise.resolve().then(() => consumerResolve(obj[prop]), consumerCatch)
  }

  Object.defineProperty(obj, 'then', { ...defineOpts, value: thenFunction })

  // the Promise will never fail in our usage, so just make a no-op "catch"
  Object.defineProperty(obj, 'catch', { ...defineOpts, value: Promise.prototype.catch })

  Object.defineProperty(obj, 'finally', { ...defineOpts, value: Promise.prototype.finally })

  return obj
}

const EMITTED_NOTIFICATIONS = [
  'eth_subscription', // per eth-json-rpc-filters/subscriptionManager
]

// eslint-disable-next-line no-empty-function
const NOOP = () => {}

module.exports = {
  createErrorMiddleware,
  EMITTED_NOTIFICATIONS,
  logStreamDisconnectWarning,
  makeThenable,
  NOOP,
}
