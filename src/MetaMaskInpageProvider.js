const pump = require('pump')
const { JsonRpcEngine, createIdRemapMiddleware } = require('json-rpc-engine')
const createJsonRpcStream = require('json-rpc-middleware-stream')
const ObjectMultiplex = require('obj-multiplex')
const { default: SafeEventEmitter } = require('@metamask/safe-event-emitter')
const dequal = require('fast-deep-equal')
const { ethErrors, EthereumRpcError } = require('eth-rpc-errors')
const { duplex: isDuplex } = require('is-stream')

const messages = require('./messages')
const { sendSiteMetadata } = require('./siteMetadata')
const {
  createErrorMiddleware,
  EMITTED_NOTIFICATIONS,
  getRpcPromiseCallback,
  logStreamDisconnectWarning,
  NOOP,
} = require('./utils')

/**
 * @typedef {Object} ConsoleLike
 * @property {function} debug - Like console.debug
 * @property {function} error - Like console.error
 * @property {function} info - Like console.info
 * @property {function} log - Like console.log
 * @property {function} trace - Like console.trace
 * @property {function} warn - Like console.warn
 */

module.exports = class MetaMaskInpageProvider extends SafeEventEmitter {

  /**
   * @param {Object} connectionStream - A Node.js duplex stream
   * @param {Object} options - An options bag
   * @param {string} [options.jsonRpcStreamName] - The name of the internal JSON-RPC stream.
   * Default: metamask-provider
   * @param {ConsoleLike} [options.logger] - The logging API to use. Default: console
   * @param {number} [options.maxEventListeners] - The maximum number of event
   * listeners. Default: 100
   * @param {boolean} [options.shouldSendMetadata] - Whether the provider should
   * send page metadata. Default: true
   */
  constructor (
    connectionStream,
    {
      jsonRpcStreamName = 'metamask-provider',
      logger = console,
      maxEventListeners = 100,
      shouldSendMetadata = true,
    } = {},
  ) {
    if (!isDuplex(connectionStream)) {
      throw new Error(messages.errors.invalidDuplexStream())
    }

    if (
      typeof maxEventListeners !== 'number' ||
      typeof shouldSendMetadata !== 'boolean'
    ) {
      throw new Error(messages.errors.invalidOptions(
        maxEventListeners, shouldSendMetadata,
      ))
    }

    validateLoggerObject(logger)

    super()

    this._log = logger
    this.isMetaMask = true

    this.setMaxListeners(maxEventListeners)

    // private state
    this._state = {
      sentWarnings: {
        // methods
        enable: false,
        experimentalMethods: false,
        send: false,
        // events
        events: {
          close: false,
          data: false,
          networkChanged: false,
          notification: false,
        },
      },
      accounts: null,
      isConnected: false,
      isUnlocked: false,
      initialized: false,
      isPermanentlyDisconnected: false,
    }

    this._metamask = this._getExperimentalApi()

    // public state
    this.selectedAddress = null
    this.networkVersion = null
    this.chainId = null

    // bind functions (to prevent consumers from making unbound calls)
    this._handleAccountsChanged = this._handleAccountsChanged.bind(this)
    this._handleConnect = this._handleConnect.bind(this)
    this._handleChainChanged = this._handleChainChanged.bind(this)
    this._handleDisconnect = this._handleDisconnect.bind(this)
    this._handleStreamDisconnect = this._handleStreamDisconnect.bind(this)
    this._handleUnlockStateChanged = this._handleUnlockStateChanged.bind(this)
    this._sendSync = this._sendSync.bind(this)
    this._rpcRequest = this._rpcRequest.bind(this)
    this._warnOfDeprecation = this._warnOfDeprecation.bind(this)
    this.enable = this.enable.bind(this)
    this.request = this.request.bind(this)
    this.send = this.send.bind(this)
    this.sendAsync = this.sendAsync.bind(this)

    // setup connectionStream multiplexing
    const mux = new ObjectMultiplex()
    pump(
      connectionStream,
      mux,
      connectionStream,
      this._handleStreamDisconnect.bind(this, 'MetaMask'),
    )

    // ignore phishing warning message (handled elsewhere)
    mux.ignoreStream('phishing')

    // setup own event listeners

    // EIP-1193 connect
    this.on('connect', () => {
      this._state.isConnected = true
    })

    // setup RPC connection

    const jsonRpcConnection = createJsonRpcStream()
    pump(
      jsonRpcConnection.stream,
      mux.createStream(jsonRpcStreamName),
      jsonRpcConnection.stream,
      this._handleStreamDisconnect.bind(this, 'MetaMask RpcProvider'),
    )

    // handle RPC requests via dapp-side rpc engine
    const rpcEngine = new JsonRpcEngine()
    rpcEngine.push(createIdRemapMiddleware())
    rpcEngine.push(createErrorMiddleware(this._log))
    rpcEngine.push(jsonRpcConnection.middleware)
    this._rpcEngine = rpcEngine

    this._initializeState()

    // handle JSON-RPC notifications
    jsonRpcConnection.events.on('notification', (payload) => {
      const { method, params } = payload

      if (method === 'metamask_accountsChanged') {
        this._handleAccountsChanged(params)

      } else if (method === 'metamask_unlockStateChanged') {
        this._handleUnlockStateChanged(params)
      } else if (method === 'metamask_chainChanged') {
        this._handleChainChanged(params)
      } else if (EMITTED_NOTIFICATIONS.includes(method)) {
        this.emit('message', {
          type: method,
          data: params,
        })

        // deprecated
        this.emit('notification', payload.params.result)
      } else if (method === 'METAMASK_STREAM_FAILURE') {
        connectionStream.destroy(
          new Error(messages.errors.permanentlyDisconnected()),
        )
      }
    })

    // miscellanea

    // send website metadata
    if (shouldSendMetadata) {
      if (document.readyState === 'complete') {
        sendSiteMetadata(this._rpcEngine, this._log)
      } else {
        const domContentLoadedHandler = () => {
          sendSiteMetadata(this._rpcEngine, this._log)
          window.removeEventListener('DOMContentLoaded', domContentLoadedHandler)
        }
        window.addEventListener('DOMContentLoaded', domContentLoadedHandler)
      }
    }
  }

  //====================
  // Public Methods
  //====================

  /**
   * Returns whether the provider can process RPC requests.
   */
  isConnected () {
    return this._state.isConnected
  }

  /**
   * Submits an RPC request for the given method, with the given params.
   * Resolves with the result of the method call, or rejects on error.
   *
   * @param {Object} args - The RPC request arguments.
   * @param {string} args.method - The RPC method name.
   * @param {unknown[] | Object} [args.params] - The parameters for the RPC method.
   * @returns {Promise<unknown>} A Promise that resolves with the result of the RPC method,
   * or rejects if an error is encountered.
   */
  async request (args) {
    if (!args || typeof args !== 'object' || Array.isArray(args)) {
      throw ethErrors.rpc.invalidRequest({
        message: messages.errors.invalidRequestArgs(),
        data: args,
      })
    }

    const { method, params } = args

    if (typeof method !== 'string' || method.length === 0) {
      throw ethErrors.rpc.invalidRequest({
        message: messages.errors.invalidRequestMethod(),
        data: args,
      })
    }

    if (
      params !== undefined && !Array.isArray(params) &&
      (typeof params !== 'object' || params === null)
    ) {
      throw ethErrors.rpc.invalidRequest({
        message: messages.errors.invalidRequestParams(),
        data: args,
      })
    }

    return new Promise((resolve, reject) => {
      this._rpcRequest(
        { method, params },
        getRpcPromiseCallback(resolve, reject),
      )
    })
  }

  /**
   * Submits an RPC request per the given JSON-RPC request object.
   *
   * @param {Object} payload - The RPC request object.
   * @param {Function} cb - The callback function.
   */
  sendAsync (payload, cb) {
    this._rpcRequest(payload, cb)
  }

  /**
   * We override the following event methods so that we can warn consumers
   * about deprecated events:
   *   addListener, on, once, prependListener, prependOnceListener
   */

  /**
   * @inheritdoc
   */
  addListener (eventName, listener) {
    this._warnOfDeprecation(eventName)
    return super.addListener(eventName, listener)
  }

  /**
   * @inheritdoc
   */
  on (eventName, listener) {
    this._warnOfDeprecation(eventName)
    return super.on(eventName, listener)
  }

  /**
   * @inheritdoc
   */
  once (eventName, listener) {
    this._warnOfDeprecation(eventName)
    return super.once(eventName, listener)
  }

  /**
   * @inheritdoc
   */
  prependListener (eventName, listener) {
    this._warnOfDeprecation(eventName)
    return super.prependListener(eventName, listener)
  }

  /**
   * @inheritdoc
   */
  prependOnceListener (eventName, listener) {
    this._warnOfDeprecation(eventName)
    return super.prependOnceListener(eventName, listener)
  }

  //====================
  // Private Methods
  //====================

  /**
   * Constructor helper.
   * Populates initial state by calling 'metamask_getProviderState' and emits
   * necessary events.
   *
   * @private
   */
  async _initializeState () {
    try {
      const {
        accounts,
        chainId,
        isUnlocked,
        networkVersion,
      } = await this.request({
        method: 'metamask_getProviderState',
      })

      // indicate that we've connected, for EIP-1193 compliance
      this.emit('connect', { chainId })

      this._handleChainChanged({ chainId, networkVersion })
      this._handleUnlockStateChanged({ accounts, isUnlocked })
      this._handleAccountsChanged(accounts)
    } catch (error) {
      this._log.error(
        'MetaMask: Failed to get initial state. Please report this bug.',
        error,
      )
    } finally {
      this._state.initialized = true
      this.emit('_initialized')
    }
  }

  /**
   * Internal RPC method. Forwards requests to background via the RPC engine.
   * Also remap ids inbound and outbound.
   *
   * @private
   * @param {Object} payload - The RPC request object.
   * @param {Function} callback - The consumer's callback.
   */
  _rpcRequest (payload, callback) {
    let cb = callback

    if (!Array.isArray(payload)) {

      if (!payload.jsonrpc) {
        payload.jsonrpc = '2.0'
      }

      if (
        payload.method === 'eth_accounts' ||
        payload.method === 'eth_requestAccounts'
      ) {

        // handle accounts changing
        cb = (err, res) => {
          this._handleAccountsChanged(
            res.result || [],
            payload.method === 'eth_accounts',
          )
          callback(err, res)
        }
      }
    }
    this._rpcEngine.handle(payload, cb)
  }

  /**
   * When the provider becomes connected, updates internal state and emits
   * required events. Idempotent.
   *
   * @param {string} chainId - The ID of the newly connected chain.
   * @emits MetaMaskInpageProvider#connect
   */
  _handleConnect (chainId) {
    if (!this._state.isConnected) {
      this._state.isConnected = true
      this.emit('connect', { chainId })
      this._log.debug(messages.info.connected(chainId))
    }
  }

  /**
   * When the provider becomes disconnected, updates internal state and emits
   * required events. Idempotent with respect to the isRecoverable parameter.
   *
   * Error codes per the CloseEvent status codes as required by EIP-1193:
   * https://developer.mozilla.org/en-US/docs/Web/API/CloseEvent#Status_codes
   *
   * @param {boolean} isRecoverable - Whether the disconnection is recoverable.
   * @param {string} [errorMessage] - A custom error message.
   * @emits MetaMaskInpageProvider#disconnect
   */
  _handleDisconnect (isRecoverable, errorMessage) {
    if (
      this._state.isConnected ||
      (!this._state.isPermanentlyDisconnected && !isRecoverable)
    ) {
      this._state.isConnected = false

      let error
      if (isRecoverable) {
        error = new EthereumRpcError(
          1013, // Try again later
          errorMessage || messages.errors.disconnected(),
        )
        this._log.debug(error)
      } else {
        error = new EthereumRpcError(
          1011, // Internal error
          errorMessage || messages.errors.permanentlyDisconnected(),
        )
        this._log.error(error)
        this.chainId = null
        this.networkVersion = null
        this._state.accounts = null
        this.selectedAddress = null
        this._state.isUnlocked = null
        this._state.isPermanentlyDisconnected = true
      }

      this.emit('disconnect', error)
      this.emit('close', error) // deprecated
    }
  }

  /**
   * Called when connection is lost to critical streams.
   *
   * @private
   * @emits MetamaskInpageProvider#disconnect
   */
  _handleStreamDisconnect (streamName, error) {
    logStreamDisconnectWarning(this._log, streamName, error, this)
    this._handleDisconnect(false, error ? error.message : undefined)
  }

  /**
   * Upon receipt of a new chainId and networkVersion, emits corresponding
   * events and sets relevant public state.
   * Does nothing if neither the chainId nor the networkVersion are different
   * from existing values.
   *
   * @private
   * @emits MetamaskInpageProvider#chainChanged
   * @param {Object} networkInfo - An object with network info.
   * @param {string} networkInfo.chainId - The latest chain ID.
   * @param {string} networkInfo.networkVersion - The latest network ID.
   */
  _handleChainChanged ({ chainId, networkVersion } = {}) {
    if (
      !chainId || typeof chainId !== 'string' || !chainId.startsWith('0x') ||
      !networkVersion || typeof networkVersion !== 'string'
    ) {
      this._log.error(
        'MetaMask: Received invalid network parameters. Please report this bug.',
        { chainId, networkVersion },
      )
      return
    }

    if (networkVersion === 'loading') {
      this._handleDisconnect(true)
    } else {
      this._handleConnect(chainId)

      if (chainId !== this.chainId) {
        this.chainId = chainId
        if (this._state.initialized) {
          this.emit('chainChanged', this.chainId)
        }
      }

      if (networkVersion !== this.networkVersion) {
        this.networkVersion = networkVersion
        if (this._state.initialized) {
          this.emit('networkChanged', this.networkVersion)
        }
      }
    }
  }

  /**
   * Called when accounts may have changed. Diffs the new accounts value with
   * the current one, updates all state as necessary, and emits the
   * accountsChanged event.
   *
   * @private
   * @param {string[]} accounts - The new accounts value.
   * @param {boolean} isEthAccounts - Whether the accounts value was returned by
   * a call to eth_accounts.
   */
  _handleAccountsChanged (accounts, isEthAccounts = false) {
    let _accounts = accounts

    if (!Array.isArray(accounts)) {
      this._log.error(
        'MetaMask: Received invalid accounts parameter. Please report this bug.',
        accounts,
      )
      _accounts = []
    }

    // emit accountsChanged if anything about the accounts array has changed
    if (!dequal(this._state.accounts, _accounts)) {

      // we should always have the correct accounts even before eth_accounts
      // returns
      if (isEthAccounts && this._state.accounts !== null) {
        this._log.error(
          `MetaMask: 'eth_accounts' unexpectedly updated accounts. Please report this bug.`,
          _accounts,
        )
      }

      this._state.accounts = _accounts

      // handle selectedAddress
      if (this.selectedAddress !== _accounts[0]) {
        this.selectedAddress = _accounts[0] || null
      }

      // finally, after all state has been updated, emit the event
      if (this._state.initialized) {
        this.emit('accountsChanged', _accounts)
      }
    }
  }

  /**
   * Upon receipt of a new isUnlocked state, sets relevant public state.
   * Calls the accounts changed handler with the received accounts, or an empty
   * array.
   *
   * Does nothing if the received value is equal to the existing value.
   * There are no lock/unlock events.
   *
   * @private
   * @param {Object} opts - Options bag.
   * @param {string[]} [opts.accounts] - The exposed accounts, if any.
   * @param {boolean} opts.isUnlocked - The latest isUnlocked value.
   */
  _handleUnlockStateChanged ({ accounts, isUnlocked }) {
    if (typeof isUnlocked !== 'boolean') {
      this._log.error('MetaMask: Received invalid isUnlocked parameter. Please report this bug.')
      return
    }

    if (isUnlocked !== this._state.isUnlocked) {
      this._state.isUnlocked = isUnlocked
      this._handleAccountsChanged(accounts || [])
    }
  }

  /**
   * Warns of deprecation for the given event, if applicable.
   *
   * @private
   */
  _warnOfDeprecation (eventName) {
    if (this._state.sentWarnings.events[eventName] === false) {
      this._log.warn(messages.warnings.events[eventName])
      this._state.sentWarnings.events[eventName] = true
    }
  }

  /**
   * Constructor helper.
   * Gets experimental _metamask API as Proxy, so that we can warn consumers
   * about its experiment nature.
   *
   * @private
   */
  _getExperimentalApi () {
    return new Proxy(
      {

        /**
         * Determines if MetaMask is unlocked by the user.
         *
         * @returns {Promise<boolean>} - Promise resolving to true if MetaMask is currently unlocked
         */
        isUnlocked: async () => {
          if (!this._state.initialized) {
            await new Promise((resolve) => {
              this.on('_initialized', () => resolve())
            })
          }
          return this._state.isUnlocked
        },

        /**
         * Make a batch RPC request.
         */
        requestBatch: async (requests) => {
          if (!Array.isArray(requests)) {
            throw ethErrors.rpc.invalidRequest({
              message: 'Batch requests must be made with an array of request objects.',
              data: requests,
            })
          }

          return new Promise((resolve, reject) => {
            this._rpcRequest(
              requests,
              getRpcPromiseCallback(resolve, reject),
            )
          })
        },
      },
      {
        get: (obj, prop) => {

          if (!this._state.sentWarnings.experimentalMethods) {
            this._log.warn(messages.warnings.experimentalMethods)
            this._state.sentWarnings.experimentalMethods = true
          }
          return obj[prop]
        },
      },
    )
  }

  //====================
  // Deprecated Methods
  //====================

  /**
   * Equivalent to: ethereum.request('eth_requestAccounts')
   *
   * @deprecated
   * @returns {Promise<Array<string>>} - A promise that resolves to an array of addresses.
   */
  enable () {
    if (!this._state.sentWarnings.enable) {
      this._log.warn(messages.warnings.enableDeprecation)
      this._state.sentWarnings.enable = true
    }

    return new Promise((resolve, reject) => {
      try {
        this._rpcRequest(
          { method: 'eth_requestAccounts', params: [] },
          getRpcPromiseCallback(resolve, reject),
        )
      } catch (error) {
        reject(error)
      }
    })
  }

  /**
   * Sends an RPC request to MetaMask.
   * Many different return types, which is why this method should not be used.
   *
   * @deprecated
   * @param {(string | Object)} methodOrPayload - The method name, or the RPC request object.
   * @param {Array<any> | Function} [callbackOrArgs] - If given a method name, the method's parameters.
   * @returns {unknown} - The method result, or a JSON RPC response object.
   */
  send (methodOrPayload, callbackOrArgs) {
    if (!this._state.sentWarnings.send) {
      this._log.warn(messages.warnings.sendDeprecation)
      this._state.sentWarnings.send = true
    }

    if (
      typeof methodOrPayload === 'string' &&
      (!callbackOrArgs || Array.isArray(callbackOrArgs))
    ) {
      return new Promise((resolve, reject) => {
        try {
          this._rpcRequest(
            { method: methodOrPayload, params: callbackOrArgs },
            getRpcPromiseCallback(resolve, reject, false),
          )
        } catch (error) {
          reject(error)
        }
      })
    } else if (
      typeof methodOrPayload === 'object' &&
      typeof callbackOrArgs === 'function'
    ) {
      return this._rpcRequest(methodOrPayload, callbackOrArgs)
    }
    return this._sendSync(methodOrPayload)
  }

  /**
   * Internal backwards compatibility method, used in send.
   *
   * @deprecated
   */
  _sendSync (payload) {
    let result
    switch (payload.method) {

      case 'eth_accounts':
        result = this.selectedAddress ? [this.selectedAddress] : []
        break

      case 'eth_coinbase':
        result = this.selectedAddress || null
        break

      case 'eth_uninstallFilter':
        this._rpcRequest(payload, NOOP)
        result = true
        break

      case 'net_version':
        result = this.networkVersion || null
        break

      default:
        throw new Error(messages.errors.unsupportedSync(payload.method))
    }

    return {
      id: payload.id,
      jsonrpc: payload.jsonrpc,
      result,
    }
  }
}

function validateLoggerObject (logger) {
  if (logger !== console) {
    if (typeof logger === 'object') {
      const methodKeys = ['log', 'warn', 'error', 'debug', 'info', 'trace']
      for (const key of methodKeys) {
        if (typeof logger[key] !== 'function') {
          throw new Error(messages.errors.invalidLoggerMethod(key))
        }
      }
      return
    }
    throw new Error(messages.errors.invalidLoggerObject())
  }
}
