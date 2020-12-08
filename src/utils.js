const { ethErrors } = require('eth-rpc-errors')

// utility functions

/**
 * json-rpc-engine middleware that logs RPC errors and and validates req.method.
 *
 * @param {Object} log - The logging API to use.
 * @returns {Function} json-rpc-engine middleware function
 */
function createErrorMiddleware (log) {
  return (req, res, next) => {

    // json-rpc-engine will terminate the request when it notices this error
    if (typeof req.method !== 'string' || !req.method) {
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
 * Logs a stream disconnection error. Emits an 'error' if given an
 * EventEmitter that has listeners for the 'error' event.
 *
 * @param {typeof console} log - The logging API to use.
 * @param {string} remoteLabel - The label of the disconnected stream.
 * @param {Error} [err] - The associated error to log.
 * @param {import('@metamask/safe-event-emitter').default} [emitter] - The logging API to use.
 */
function logStreamDisconnectWarning (log, remoteLabel, err, emitter) {
  let warningMsg = `MetaMask: Lost connection to "${remoteLabel}".`
  if (err && err.stack) {
    warningMsg += `\n${err.stack}`
  }
  log.warn(warningMsg)
  if (emitter && emitter.listenerCount('error') > 0) {
    emitter.emit('error', warningMsg)
  }
}

const NOOP = () => undefined

// constants

const EMITTED_NOTIFICATIONS = [
  'eth_subscription', // per eth-json-rpc-filters/subscriptionManager
]

module.exports = {
  createErrorMiddleware,
  EMITTED_NOTIFICATIONS,
  getRpcPromiseCallback,
  logStreamDisconnectWarning,
  NOOP,
}
