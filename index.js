const pump = require('pump')
const RpcEngine = require('json-rpc-engine')
const createIdRemapMiddleware = require('json-rpc-engine/src/idRemapMiddleware')
const createJsonRpcStream = require('json-rpc-middleware-stream')
const ObservableStore = require('obs-store')
const asStream = require('obs-store/lib/asStream')
const ObjectMultiplex = require('obj-multiplex')
const SafeEventEmitter = require('safe-event-emitter')
const dequal = require('fast-deep-equal')
const { ethErrors } = require('eth-json-rpc-errors')
const log = require('loglevel')

const messages = require('./src/messages')
const { sendSiteMetadata } = require('./src/siteMetadata')
const {
  createErrorMiddleware,
  logStreamDisconnectWarning,
  makeThenable,
} = require('./src/utils')

// resolve response.result, reject errors
const getRpcPromiseCallback = (resolve, reject) => (error, response) => {
  if (error || response.error) {
    reject(error || response.error)
  } else if (Array.isArray(response)) {
    resolve(response)
  } else {
    resolve(response.result)
  }
}

module.exports = class MetamaskInpageProvider extends SafeEventEmitter {

  constructor (connectionStream, shouldSendMetadata = true) {

    super()

    this.isMetaMask = true

    // private state, kept here in part for use in the _metamask proxy
    this._state = {
      sentWarnings: {
        enable: false,
        experimentalMethods: false,
        isConnected: false,
        sendAsync: false,
        // TODO:deprecate:2020-Q1
        autoReload: false,
        sendSync: false,
      },
      isConnected: undefined,
      accounts: undefined,
      isUnlocked: undefined,
    }

    this._metamask = getExperimentalApi(this)

    // public state
    this.selectedAddress = null
    this.networkVersion = undefined
    this.chainId = undefined

    // bind functions (to prevent e.g. web3@1.x from making unbound calls)
    this._handleAccountsChanged = this._handleAccountsChanged.bind(this)
    this._handleDisconnect = this._handleDisconnect.bind(this)
    this._sendAsync = this._sendAsync.bind(this)
    this._sendSync = this._sendSync.bind(this)
    this.enable = this.enable.bind(this)
    this.send = this.send.bind(this)
    this.sendAsync = this.sendAsync.bind(this)

    // setup connectionStream multiplexing
    const mux = new ObjectMultiplex()
    pump(
      connectionStream,
      mux,
      connectionStream,
      this._handleDisconnect.bind(this, 'MetaMask'),
    )

    // subscribe to metamask public config (one-way)
    this._publicConfigStore = new ObservableStore({ storageKey: 'MetaMask-Config' })

    // handle isUnlocked changes, and chainChanged and networkChanged events
    this._publicConfigStore.subscribe((state) => {

      if ('isUnlocked' in state && state.isUnlocked !== this._state.isUnlocked) {
        this._state.isUnlocked = state.isUnlocked
        if (this._state.isUnlocked) {
          // this will get the exposed accounts, if any
          try {
            this._sendAsync(
              { method: 'eth_accounts', params: [] },
              noop,
              true, // indicating that eth_accounts _should_ update accounts
            )
          } catch (_) { /* no-op */ }
        } else {
          // accounts are never exposed when the extension is locked
          this._handleAccountsChanged([])
        }
      }

      // Emit chainChanged event on chain change
      if ('chainId' in state && state.chainId !== this.chainId) {
        this.chainId = state.chainId
        this.emit('chainChanged', this.chainId)
        this.emit('chainIdChanged', this.chainId) // TODO:deprecate:2020-Q1
      }

      // Emit networkChanged event on network change
      if ('networkVersion' in state && state.networkVersion !== this.networkVersion) {
        this.networkVersion = state.networkVersion
        this.emit('networkChanged', this.networkVersion)
      }
    })

    pump(
      mux.createStream('publicConfig'),
      asStream(this._publicConfigStore),
      // RPC requests should still work if only this stream fails
      logStreamDisconnectWarning.bind(this, 'MetaMask PublicConfigStore'),
    )

    // ignore phishing warning message (handled elsewhere)
    mux.ignoreStream('phishing')

    // setup own event listeners

    // EIP-1193 connect
    this.on('connect', () => {
      this._state.isConnected = true
    })

    // connect to async provider

    const jsonRpcConnection = createJsonRpcStream()
    pump(
      jsonRpcConnection.stream,
      mux.createStream('provider'),
      jsonRpcConnection.stream,
      this._handleDisconnect.bind(this, 'MetaMask RpcProvider'),
    )

    // handle RPC requests via dapp-side rpc engine
    const rpcEngine = new RpcEngine()
    rpcEngine.push(createIdRemapMiddleware())
    rpcEngine.push(createErrorMiddleware())
    rpcEngine.push(jsonRpcConnection.middleware)
    this._rpcEngine = rpcEngine

    // json rpc notification listener
    jsonRpcConnection.events.on('notification', (payload) => {
      if (payload.method === 'wallet_accountsChanged') {
        this._handleAccountsChanged(payload.result)
      } else if (payload.method === 'eth_subscription') {
        // EIP 1193 subscriptions, per eth-json-rpc-filters/subscriptionManager
        this.emit('notification', payload.params.result)
      }
    })

    // send website metadata
    if (shouldSendMetadata) {
      const domContentLoadedHandler = () => {
        sendSiteMetadata(this._rpcEngine)
        window.removeEventListener('DOMContentLoaded', domContentLoadedHandler)
      }
      window.addEventListener('DOMContentLoaded', domContentLoadedHandler)
    }

    // indicate that we've connected, for EIP-1193 compliance
    setTimeout(() => this.emit('connect'))

    // TODO:deprecate:2020-Q1
    this._web3Ref = undefined

    // TODO:deprecate:2020-Q1
    // give the dapps control of a refresh they can toggle this off on the window.ethereum
    // this will be default true so it does not break any old apps.
    this.autoRefreshOnNetworkChange = true

    // TODO:deprecate:2020-Q1
    // wait a second to attempt to send this, so that the warning can be silenced
    // moved this here because there's another warning in .enable() discouraging
    // the use thereof per EIP 1102
    setTimeout(() => {
      if (this.autoRefreshOnNetworkChange && !this._state.sentWarnings.autoReload) {
        log.warn(messages.warnings.autoReloadDeprecation)
        this._state.sentWarnings.autoReload = true
      }
    }, 1000)
  }

  /**
   * Deprecated.
   * Returns whether the inpage provider is connected to MetaMask.
   */
  isConnected () {

    if (!this._state.sentWarnings.isConnected) {
      log.warn(messages.warnings.isConnectedDeprecation)
      this._state.sentWarnings.isConnected = true
    }
    return this._state.isConnected
  }

  /**
   * Sends an RPC request to MetaMask. Resolves to the result of the method call.
   * May reject with an error that must be caught by the caller.
   *
   * @param {(string|Object)} methodOrPayload - The method name, or the RPC request object.
   * @param {Array<any>} [params] - If given a method name, the method's parameters.
   * @returns {Promise<any>} - A promise resolving to the result of the method call.
   */
  send (methodOrPayload, params) {

    // preserve original params for later error if necessary
    let _params = params

    // construct payload object
    let payload
    if (
      methodOrPayload &&
      typeof methodOrPayload === 'object' &&
      !Array.isArray(methodOrPayload)
    ) {

      // TODO:deprecate:2020-Q1
      // handle send(object, callback), an alias for sendAsync(object, callback)
      if (typeof _params === 'function') {
        return this._sendAsync(methodOrPayload, _params)
      }

      payload = methodOrPayload

      // TODO:deprecate:2020-Q1
      // backwards compatibility: "synchronous" methods
      if (!_params && [
        'eth_accounts',
        'eth_coinbase',
        'eth_uninstallFilter',
        'net_version',
      ].includes(payload.method)) {
        return this._sendSync(payload)
      }
    } else if (
      typeof methodOrPayload === 'string' &&
      typeof _params !== 'function'
    ) {

      // wrap params in array out of kindness
      // params have to be an array per EIP 1193, even though JSON RPC
      // allows objects
      if (_params === undefined) {
        _params = []
      } else if (!Array.isArray(_params)) {
        _params = [_params]
      }

      payload = {
        method: methodOrPayload,
        params: _params,
      }
    }

    // typecheck payload and payload.params
    if (
      !payload ||
      typeof payload !== 'object' ||
      Array.isArray(payload) ||
      !Array.isArray(_params)
    ) {
      throw ethErrors.rpc.invalidRequest({
        message: messages.errors.invalidParams(),
        data: [methodOrPayload, params],
      })
    }

    return new Promise((resolve, reject) => {
      try {
        this._sendAsync(
          payload,
          getRpcPromiseCallback(resolve, reject),
        )
      } catch (error) {
        reject(error)
      }
    })
  }

  /**
   * Deprecated.
   * Equivalent to: ethereum.send('eth_requestAccounts')
   *
   * @returns {Promise<Array<string>>} - A promise that resolves to an array of addresses.
   */
  enable () {

    if (!this._state.sentWarnings.enable) {
      log.warn(messages.warnings.enableDeprecation)
      this._state.sentWarnings.enable = true
    }
    return new Promise((resolve, reject) => {
      try {
        this._sendAsync(
          { method: 'eth_requestAccounts', params: [] },
          getRpcPromiseCallback(resolve, reject),
        )
      } catch (error) {
        reject(error)
      }
    })
  }

  /**
   * Deprecated.
   * Backwards compatibility. ethereum.send() with callback.
   *
   * @param {Object} payload - The RPC request object.
   * @param {Function} callback - The callback function.
   */
  sendAsync (payload, cb) {

    if (!this._state.sentWarnings.sendAsync) {
      log.warn(messages.warnings.sendAsyncDeprecation)
      this._state.sentWarnings.sendAsync = true
    }
    this._sendAsync(payload, cb)
  }

  /**
   * TODO:deprecate:2020-Q1
   * Internal backwards compatibility method.
   */
  _sendSync (payload) {

    if (!this._state.sentWarnings.sendSync) {
      log.warn(messages.warnings.sendSyncDeprecation)
      this._state.sentWarnings.sendSync = true
    }

    let result
    switch (payload.method) {

      case 'eth_accounts':
        result = this.selectedAddress ? [this.selectedAddress] : []
        break

      case 'eth_coinbase':
        result = this.selectedAddress || null
        break

      case 'eth_uninstallFilter':
        this._sendAsync(payload, noop)
        result = true
        break

      case 'net_version':
        result = this.networkVersion || null
        break

      default:
        throw new Error(messages.errors.unsupportedSync(payload.method))
    }

    // looks like a plain object, but behaves like a Promise if someone calls .then on it :evil_laugh:
    return makeThenable({
      id: payload.id,
      jsonrpc: payload.jsonrpc,
      result,
    }, 'result')
  }

  /**
   * Internal RPC method. Forwards requests to background via the RPC engine.
   * Also remap ids inbound and outbound.
   *
   * @param {Object} payload - The RPC request object.
   * @param {Function} userCallback - The caller's callback.
   * @param {boolean} isInternal - Whether the request is internal.
   */
  _sendAsync (payload, userCallback, isInternal = false) {

    let cb = userCallback

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
            isInternal,
          )
          userCallback(err, res)
        }
      }
    }

    this._rpcEngine.handle(payload, cb)
  }

  /**
   * Called when connection is lost to critical streams.
   */
  _handleDisconnect (streamName, err) {

    logStreamDisconnectWarning.bind(this)(streamName, err)
    if (this._state.isConnected) {
      this.emit('close', {
        code: 1011,
        reason: 'MetaMask background communication error.',
      })
    }
    this._state.isConnected = false
  }

  /**
   * Called when accounts may have changed.
   */
  _handleAccountsChanged (accounts, isEthAccounts = false, isInternal = false) {

    let _accounts = accounts

    // defensive programming
    if (!Array.isArray(accounts)) {
      log.error(
        'MetaMask: Received non-array accounts parameter. Please report this bug.',
        accounts,
      )
      _accounts = []
    }

    // emit accountsChanged if anything about the accounts array has changed
    if (!dequal(this._state.accounts, _accounts)) {

      // we should always have the correct accounts even before eth_accounts
      // returns, except in cases where isInternal is true
      if (isEthAccounts && this._state.accounts !== undefined && !isInternal) {
        log.error(
          `MetaMask: 'eth_accounts' unexpectedly updated accounts. Please report this bug.`,
          _accounts,
        )
      }

      this.emit('accountsChanged', _accounts)
      this._state.accounts = _accounts
    }

    // handle selectedAddress
    if (this.selectedAddress !== _accounts[0]) {
      this.selectedAddress = _accounts[0] || null
    }

    // TODO:deprecate:2020-Q1
    // handle web3
    if (this._web3Ref) {
      this._web3Ref.defaultAccount = this.selectedAddress
    } else if (
      window.web3 &&
      window.web3.eth &&
      typeof window.web3.eth === 'object'
    ) {
      window.web3.eth.defaultAccount = this.selectedAddress
    }
  }
}

/**
 * Gets experimental _metamask API as Proxy.
 */
function getExperimentalApi (instance) {
  return new Proxy(
    {

      /**
       * Determines if MetaMask is unlocked by the user.
       *
       * @returns {Promise<boolean>} - Promise resolving to true if MetaMask is currently unlocked
       */
      isUnlocked: async () => {
        if (instance._state.isUnlocked === undefined) {
          await new Promise(
            (resolve) => instance._publicConfigStore.once('update', () => resolve()),
          )
        }
        return instance._state.isUnlocked
      },

      /**
       * Make a batch request.
       */
      // eslint-disable-next-line require-await
      sendBatch: async (requests) => {

        // basic input validation
        if (!Array.isArray(requests)) {
          throw ethErrors.rpc.invalidRequest({
            message: 'Batch requests must be made with an array of request objects.',
            data: requests,
          })
        }

        return new Promise((resolve, reject) => {
          try {
            instance._sendAsync(
              requests,
              getRpcPromiseCallback(resolve, reject),
            )
          } catch (error) {
            reject(error)
          }
        })
      },

      // TODO:deprecate:2020-Q1 isEnabled, isApproved
      /**
       * Deprecated. Will be removed in Q1 2020.
       * Synchronously determines if this domain is currently enabled, with a potential false negative if called to soon
       *
       * @returns {boolean} - returns true if this domain is currently enabled
       */
      isEnabled: () => {
        return Array.isArray(instance._state.accounts) && instance._state.accounts.length > 0
      },

      /**
       * Deprecated. Will be removed in Q1 2020.
       * Asynchronously determines if this domain is currently enabled
       *
       * @returns {Promise<boolean>} - Promise resolving to true if this domain is currently enabled
       */
      isApproved: async () => {
        if (instance._state.accounts === undefined) {
          await new Promise(
            (resolve) => instance.once('accountsChanged', () => resolve()),
          )
        }
        return Array.isArray(instance._state.accounts) && instance._state.accounts.length > 0
      },
    },
    {
      get: (obj, prop) => {

        if (!instance._state.sentWarnings.experimentalMethods) {
          log.warn(messages.warnings.experimentalMethods)
          instance._state.sentWarnings.experimentalMethods = true
        }
        return obj[prop]
      },
    },
  )
}
