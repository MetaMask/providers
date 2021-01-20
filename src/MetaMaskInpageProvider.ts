import { Duplex } from 'stream';
import pump from 'pump';
import {
  JsonRpcEngine,
  createIdRemapMiddleware,
  JsonRpcRequest,
  JsonRpcResponse,
  JsonRpcId,
  JsonRpcVersion,
  JsonRpcSuccess,
} from 'json-rpc-engine';
import { createStreamMiddleware } from 'json-rpc-middleware-stream';
import ObjectMultiplex from '@metamask/object-multiplex';
import SafeEventEmitter from '@metamask/safe-event-emitter';
import dequal from 'fast-deep-equal';
import { ethErrors, EthereumRpcError } from 'eth-rpc-errors';
import { duplex as isDuplex } from 'is-stream';

import messages from './messages';
import sendSiteMetadata from './siteMetadata';
import {
  createErrorMiddleware,
  EMITTED_NOTIFICATIONS,
  getRpcPromiseCallback,
  logStreamDisconnectWarning,
  NOOP,
  ConsoleLike,
  Maybe,
} from './utils';

interface UnvalidatedJsonRpcRequest {
  id?: JsonRpcId;
  jsonrpc?: JsonRpcVersion;
  method: string;
  params?: unknown;
}

export interface MetaMaskInpageProviderOptions {

  /**
   * The name of the stream used to connect to the wallet.
   */
  jsonRpcStreamName?: string;

  /**
   * The logging API to use.
   */
  logger?: ConsoleLike;

  /**
   * The maximum number of event listeners.
   */
  maxEventListeners?: number;

  /**
   * Whether the provider should send page metadata.
   */
  shouldSendMetadata?: boolean;
}

export interface RequestArguments {

  /** The RPC method to request. */
  method: string;

  /** The params of the RPC method, if any. */
  params?: unknown[] | Record<string, unknown>;
}

export interface SendSyncJsonRpcRequest extends JsonRpcRequest<unknown> {
  method: 'eth_accounts' | 'eth_coinbase' | 'eth_uninstallFilter' | 'net_version';
}

interface InternalState {
  sentWarnings: {
    // methods
    enable: boolean;
    experimentalMethods: boolean;
    send: boolean;
    // events
    events: {
      close: boolean;
      data: boolean;
      networkChanged: boolean;
      notification: boolean;
    };
  };
  accounts: null | string[];
  isConnected: boolean;
  isUnlocked: boolean;
  initialized: boolean;
  isPermanentlyDisconnected: boolean;
}

type WarningEventName = keyof InternalState['sentWarnings']['events'];

export default class MetaMaskInpageProvider extends SafeEventEmitter {

  private readonly _log: ConsoleLike;

  private _state: InternalState;

  private _rpcEngine: JsonRpcEngine;

  /**
   * The chain ID of the currently connected Ethereum chain.
   * See [chainId.network]{@link https://chainid.network} for more information.
   */
  public chainId: string | null;

  /**
   * The network ID of the currently connected Ethereum chain.
   * @deprecated Use {@link chainId} instead.
   */
  public networkVersion: string | null;

  /**
   * The user's currently selected Ethereum address.
   * If null, MetaMask is either locked or the user has not permitted any
   * addresses to be viewed.
   */
  public selectedAddress: string | null;

  /**
   * Indicating that this provider is a MetaMask provider.
   */
  public readonly isMetaMask: true;

  /**
   * Experimental methods can be found here.
   */
  public readonly _metamask: ReturnType<MetaMaskInpageProvider['_getExperimentalApi']>;

  /**
   * @param connectionStream - A Node.js duplex stream
   * @param options - An options bag
   * @param options.jsonRpcStreamName - The name of the internal JSON-RPC stream.
   * Default: metamask-provider
   * @param options.logger - The logging API to use. Default: console
   * @param options.maxEventListeners - The maximum number of event
   * listeners. Default: 100
   * @param options.shouldSendMetadata - Whether the provider should
   * send page metadata. Default: true
   */
  constructor(
    connectionStream: typeof Duplex,
    {
      jsonRpcStreamName = 'metamask-provider',
      logger = console,
      maxEventListeners = 100,
      shouldSendMetadata = true,
    }: MetaMaskInpageProviderOptions = {},
  ) {
    if (!isDuplex(connectionStream)) {
      throw new Error(messages.errors.invalidDuplexStream());
    }

    if (
      typeof maxEventListeners !== 'number' ||
      typeof shouldSendMetadata !== 'boolean'
    ) {
      throw new Error(messages.errors.invalidOptions(
        maxEventListeners, shouldSendMetadata,
      ));
    }

    validateLoggerObject(logger);

    super();

    this._log = logger;
    this.isMetaMask = true;

    this.setMaxListeners(maxEventListeners);

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
    };

    this._metamask = this._getExperimentalApi();

    // public state
    this.selectedAddress = null;
    this.networkVersion = null;
    this.chainId = null;

    // bind functions (to prevent consumers from making unbound calls)
    this._handleAccountsChanged = this._handleAccountsChanged.bind(this);
    this._handleConnect = this._handleConnect.bind(this);
    this._handleChainChanged = this._handleChainChanged.bind(this);
    this._handleDisconnect = this._handleDisconnect.bind(this);
    this._handleStreamDisconnect = this._handleStreamDisconnect.bind(this);
    this._handleUnlockStateChanged = this._handleUnlockStateChanged.bind(this);
    this._sendSync = this._sendSync.bind(this);
    this._rpcRequest = this._rpcRequest.bind(this);
    this._warnOfDeprecation = this._warnOfDeprecation.bind(this);
    this.enable = this.enable.bind(this);
    this.request = this.request.bind(this);
    this.send = this.send.bind(this);
    this.sendAsync = this.sendAsync.bind(this);

    // setup connectionStream multiplexing
    const mux = new ObjectMultiplex();
    pump(
      connectionStream,
      mux as unknown as Duplex,
      connectionStream,
      this._handleStreamDisconnect.bind(this, 'MetaMask'),
    );

    // ignore phishing warning message (handled elsewhere)
    mux.ignoreStream('phishing');

    // setup own event listeners

    // EIP-1193 connect
    this.on('connect', () => {
      this._state.isConnected = true;
    });

    // setup RPC connection

    const jsonRpcConnection = createStreamMiddleware();
    pump(
      jsonRpcConnection.stream,
      mux.createStream(jsonRpcStreamName) as unknown as Duplex,
      jsonRpcConnection.stream,
      this._handleStreamDisconnect.bind(this, 'MetaMask RpcProvider'),
    );

    // handle RPC requests via dapp-side rpc engine
    const rpcEngine = new JsonRpcEngine();
    rpcEngine.push(createIdRemapMiddleware());
    rpcEngine.push(createErrorMiddleware(this._log));
    rpcEngine.push(jsonRpcConnection.middleware);
    this._rpcEngine = rpcEngine;

    this._initializeState();

    // handle JSON-RPC notifications
    jsonRpcConnection.events.on('notification', (payload) => {
      const { method, params } = payload;

      if (method === 'metamask_accountsChanged') {
        this._handleAccountsChanged(params);

      } else if (method === 'metamask_unlockStateChanged') {
        this._handleUnlockStateChanged(params);
      } else if (method === 'metamask_chainChanged') {
        this._handleChainChanged(params);
      } else if (EMITTED_NOTIFICATIONS.includes(method)) {
        // deprecated
        // emitted here because that was the original order
        this.emit('data', payload);

        this.emit('message', {
          type: method,
          data: params,
        });

        // deprecated
        this.emit('notification', payload.params.result);
      } else if (method === 'METAMASK_STREAM_FAILURE') {
        connectionStream.destroy(
          new Error(messages.errors.permanentlyDisconnected()),
        );
      }
    });

    // miscellanea

    // send website metadata
    if (shouldSendMetadata) {
      if (document.readyState === 'complete') {
        sendSiteMetadata(this._rpcEngine, this._log);
      } else {
        const domContentLoadedHandler = () => {
          sendSiteMetadata(this._rpcEngine, this._log);
          window.removeEventListener('DOMContentLoaded', domContentLoadedHandler);
        };
        window.addEventListener('DOMContentLoaded', domContentLoadedHandler);
      }
    }
  }

  //====================
  // Public Methods
  //====================

  /**
   * Returns whether the provider can process RPC requests.
   */
  isConnected(): boolean {
    return this._state.isConnected;
  }

  /**
   * Submits an RPC request for the given method, with the given params.
   * Resolves with the result of the method call, or rejects on error.
   *
   * @param args - The RPC request arguments.
   * @param args.method - The RPC method name.
   * @param args.params - The parameters for the RPC method.
   * @returns A Promise that resolves with the result of the RPC method,
   * or rejects if an error is encountered.
   */
  async request<T>(args: RequestArguments): Promise<Maybe<T>> {
    if (!args || typeof args !== 'object' || Array.isArray(args)) {
      throw ethErrors.rpc.invalidRequest({
        message: messages.errors.invalidRequestArgs(),
        data: args,
      });
    }

    const { method, params } = args;

    if (typeof method !== 'string' || method.length === 0) {
      throw ethErrors.rpc.invalidRequest({
        message: messages.errors.invalidRequestMethod(),
        data: args,
      });
    }

    if (
      params !== undefined && !Array.isArray(params) &&
      (typeof params !== 'object' || params === null)
    ) {
      throw ethErrors.rpc.invalidRequest({
        message: messages.errors.invalidRequestParams(),
        data: args,
      });
    }

    return new Promise<T>((resolve, reject) => {
      this._rpcRequest(
        { method, params },
        getRpcPromiseCallback(resolve, reject),
      );
    });
  }

  /**
   * Submits an RPC request per the given JSON-RPC request object.
   *
   * @param payload - The RPC request object.
   * @param cb - The callback function.
   */
  sendAsync(
    payload: JsonRpcRequest<unknown>,
    callback: (error: Error | null, result?: JsonRpcResponse<unknown>) => void,
  ): void {
    this._rpcRequest(payload, callback);
  }

  /**
   * We override the following event methods so that we can warn consumers
   * about deprecated events:
   *   addListener, on, once, prependListener, prependOnceListener
   */

  addListener(eventName: string, listener: (...args: unknown[]) => void) {
    this._warnOfDeprecation(eventName);
    return super.addListener(eventName, listener);
  }

  on(eventName: string, listener: (...args: unknown[]) => void) {
    this._warnOfDeprecation(eventName);
    return super.on(eventName, listener);
  }

  once(eventName: string, listener: (...args: unknown[]) => void) {
    this._warnOfDeprecation(eventName);
    return super.once(eventName, listener);
  }

  prependListener(eventName: string, listener: (...args: unknown[]) => void) {
    this._warnOfDeprecation(eventName);
    return super.prependListener(eventName, listener);
  }

  prependOnceListener(eventName: string, listener: (...args: unknown[]) => void) {
    this._warnOfDeprecation(eventName);
    return super.prependOnceListener(eventName, listener);
  }

  //====================
  // Private Methods
  //====================

  /**
   * Constructor helper.
   * Populates initial state by calling 'metamask_getProviderState' and emits
   * necessary events.
   */
  private async _initializeState() {
    try {
      const {
        accounts,
        chainId,
        isUnlocked,
        networkVersion,
      } = await this.request({
        method: 'metamask_getProviderState',
      }) as {
        accounts: string[];
        chainId: string;
        isUnlocked: boolean;
        networkVersion: string;
      };

      // indicate that we've connected, for EIP-1193 compliance
      this.emit('connect', { chainId });

      this._handleChainChanged({ chainId, networkVersion });
      this._handleUnlockStateChanged({ accounts, isUnlocked });
      this._handleAccountsChanged(accounts);
    } catch (error) {
      this._log.error(
        'MetaMask: Failed to get initial state. Please report this bug.',
        error,
      );
    } finally {
      this._state.initialized = true;
      this.emit('_initialized');
    }
  }

  /**
   * Internal RPC method. Forwards requests to background via the RPC engine.
   * Also remap ids inbound and outbound.
   *
   * @param payload - The RPC request object.
   * @param callback - The consumer's callback.
   */
  private _rpcRequest(
    payload: UnvalidatedJsonRpcRequest | UnvalidatedJsonRpcRequest[],
    callback: (...args: any[]) => void,
  ) {
    let cb = callback;

    if (!Array.isArray(payload)) {
      if (!payload.jsonrpc) {
        payload.jsonrpc = '2.0';
      }

      if (
        payload.method === 'eth_accounts' ||
        payload.method === 'eth_requestAccounts'
      ) {

        // handle accounts changing
        cb = (err: Error, res: JsonRpcSuccess<string[]>) => {
          this._handleAccountsChanged(
            res.result || [],
            payload.method === 'eth_accounts',
          );
          callback(err, res);
        };
      }
      return this._rpcEngine.handle(payload as JsonRpcRequest<unknown>, cb);
    }
    return this._rpcEngine.handle(payload as JsonRpcRequest<unknown>[], cb);
  }

  /**
   * When the provider becomes connected, updates internal state and emits
   * required events. Idempotent.
   *
   * @param chainId - The ID of the newly connected chain.
   * @emits MetaMaskInpageProvider#connect
   */
  private _handleConnect(chainId: string) {
    if (!this._state.isConnected) {
      this._state.isConnected = true;
      this.emit('connect', { chainId });
      this._log.debug(messages.info.connected(chainId));
    }
  }

  /**
   * When the provider becomes disconnected, updates internal state and emits
   * required events. Idempotent with respect to the isRecoverable parameter.
   *
   * Error codes per the CloseEvent status codes as required by EIP-1193:
   * https://developer.mozilla.org/en-US/docs/Web/API/CloseEvent#Status_codes
   *
   * @param isRecoverable - Whether the disconnection is recoverable.
   * @param errorMessage - A custom error message.
   * @emits MetaMaskInpageProvider#disconnect
   */
  private _handleDisconnect(isRecoverable: boolean, errorMessage?: string) {
    if (
      this._state.isConnected ||
      (!this._state.isPermanentlyDisconnected && !isRecoverable)
    ) {
      this._state.isConnected = false;

      let error;
      if (isRecoverable) {
        error = new EthereumRpcError(
          1013, // Try again later
          errorMessage || messages.errors.disconnected(),
        );
        this._log.debug(error);
      } else {
        error = new EthereumRpcError(
          1011, // Internal error
          errorMessage || messages.errors.permanentlyDisconnected(),
        );
        this._log.error(error);
        this.chainId = null;
        this.networkVersion = null;
        this._state.accounts = null;
        this.selectedAddress = null;
        this._state.isUnlocked = false;
        this._state.isPermanentlyDisconnected = true;
      }

      this.emit('disconnect', error);
      this.emit('close', error); // deprecated
    }
  }

  /**
   * Called when connection is lost to critical streams.
   *
   * @emits MetamaskInpageProvider#disconnect
   */
  private _handleStreamDisconnect(streamName: string, error: Error) {
    logStreamDisconnectWarning(this._log, streamName, error, this);
    this._handleDisconnect(false, error ? error.message : undefined);
  }

  /**
   * Upon receipt of a new chainId and networkVersion, emits corresponding
   * events and sets relevant public state.
   * Does nothing if neither the chainId nor the networkVersion are different
   * from existing values.
   *
   * @emits MetamaskInpageProvider#chainChanged
   * @param networkInfo - An object with network info.
   * @param networkInfo.chainId - The latest chain ID.
   * @param networkInfo.networkVersion - The latest network ID.
   */
  private _handleChainChanged({
    chainId,
    networkVersion,
  }: { chainId?: string; networkVersion?: string } = {}) {
    if (
      !chainId || typeof chainId !== 'string' || !chainId.startsWith('0x') ||
      !networkVersion || typeof networkVersion !== 'string'
    ) {
      this._log.error(
        'MetaMask: Received invalid network parameters. Please report this bug.',
        { chainId, networkVersion },
      );
      return;
    }

    if (networkVersion === 'loading') {
      this._handleDisconnect(true);
    } else {
      this._handleConnect(chainId);

      if (chainId !== this.chainId) {
        this.chainId = chainId;
        if (this._state.initialized) {
          this.emit('chainChanged', this.chainId);
        }
      }

      if (networkVersion !== this.networkVersion) {
        this.networkVersion = networkVersion;
        if (this._state.initialized) {
          this.emit('networkChanged', this.networkVersion);
        }
      }
    }
  }

  /**
   * Called when accounts may have changed. Diffs the new accounts value with
   * the current one, updates all state as necessary, and emits the
   * accountsChanged event.
   *
   * @param accounts - The new accounts value.
   * @param isEthAccounts - Whether the accounts value was returned by
   * a call to eth_accounts.
   */
  private _handleAccountsChanged(accounts: unknown[], isEthAccounts = false): void {
    let _accounts = accounts;

    if (!Array.isArray(accounts)) {
      this._log.error(
        'MetaMask: Received invalid accounts parameter. Please report this bug.',
        accounts,
      );
      _accounts = [];
    }

    for (const account of accounts) {
      if (typeof account !== 'string') {
        this._log.error(
          'MetaMask: Received non-string account. Please report this bug.',
          accounts,
        );
        _accounts = [];
        break;
      }
    }

    // emit accountsChanged if anything about the accounts array has changed
    if (!dequal(this._state.accounts, _accounts)) {

      // we should always have the correct accounts even before eth_accounts
      // returns
      if (isEthAccounts && this._state.accounts !== null) {
        this._log.error(
          `MetaMask: 'eth_accounts' unexpectedly updated accounts. Please report this bug.`,
          _accounts,
        );
      }

      this._state.accounts = _accounts as string[];

      // handle selectedAddress
      if (this.selectedAddress !== _accounts[0]) {
        this.selectedAddress = _accounts[0] as string || null;
      }

      // finally, after all state has been updated, emit the event
      if (this._state.initialized) {
        this.emit('accountsChanged', _accounts);
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
   * @param opts - Options bag.
   * @param opts.accounts - The exposed accounts, if any.
   * @param opts.isUnlocked - The latest isUnlocked value.
   */
  private _handleUnlockStateChanged({
    accounts,
    isUnlocked,
  }: { accounts?: string[]; isUnlocked?: boolean} = {}) {
    if (typeof isUnlocked !== 'boolean') {
      this._log.error('MetaMask: Received invalid isUnlocked parameter. Please report this bug.');
      return;
    }

    if (isUnlocked !== this._state.isUnlocked) {
      this._state.isUnlocked = isUnlocked;
      this._handleAccountsChanged(accounts || []);
    }
  }

  /**
   * Warns of deprecation for the given event, if applicable.
   */
  private _warnOfDeprecation(eventName: string): void {
    if (this._state.sentWarnings.events[eventName as WarningEventName] === false) {
      this._log.warn(messages.warnings.events[eventName as WarningEventName]);
      this._state.sentWarnings.events[eventName as WarningEventName] = true;
    }
  }

  /**
   * Constructor helper.
   * Gets experimental _metamask API as Proxy, so that we can warn consumers
   * about its experiment nature.
   */
  private _getExperimentalApi() {
    return new Proxy(
      {

        /**
         * Determines if MetaMask is unlocked by the user.
         *
         * @returns Promise resolving to true if MetaMask is currently unlocked
         */
        isUnlocked: async () => {
          if (!this._state.initialized) {
            await new Promise<void>((resolve) => {
              this.on('_initialized', () => resolve());
            });
          }
          return this._state.isUnlocked;
        },

        /**
         * Make a batch RPC request.
         */
        requestBatch: async (requests: UnvalidatedJsonRpcRequest[]) => {
          if (!Array.isArray(requests)) {
            throw ethErrors.rpc.invalidRequest({
              message: 'Batch requests must be made with an array of request objects.',
              data: requests,
            });
          }

          return new Promise((resolve, reject) => {
            this._rpcRequest(
              requests,
              getRpcPromiseCallback(resolve, reject),
            );
          });
        },
      },
      {
        get: (obj, prop, ...args) => {

          if (!this._state.sentWarnings.experimentalMethods) {
            this._log.warn(messages.warnings.experimentalMethods);
            this._state.sentWarnings.experimentalMethods = true;
          }
          return Reflect.get(obj, prop, ...args);
        },
      },
    );
  }

  //====================
  // Deprecated Methods
  //====================

  /**
   * Equivalent to: ethereum.request('eth_requestAccounts')
   *
   * @deprecated Use request({ method: 'eth_requestAccounts' }) instead.
   * @returns A promise that resolves to an array of addresses.
   */
  enable(): Promise<string[]> {
    if (!this._state.sentWarnings.enable) {
      this._log.warn(messages.warnings.enableDeprecation);
      this._state.sentWarnings.enable = true;
    }

    return new Promise<string[]>((resolve, reject) => {
      try {
        this._rpcRequest(
          { method: 'eth_requestAccounts', params: [] },
          getRpcPromiseCallback(resolve, reject),
        );
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Submits an RPC request for the given method, with the given params.
   *
   * @deprecated Use "request" instead.
   * @param method - The method to request.
   * @param params - Any params for the method.
   * @returns A Promise that resolves with the JSON-RPC response object for the
   * request.
   */
  send<T>(method: string, params?: T[]): Promise<JsonRpcResponse<T>>;

  /**
   * Submits an RPC request per the given JSON-RPC request object.
   *
   * @deprecated Use "request" instead.
   * @param payload - A JSON-RPC request object.
   * @param callback - An error-first callback that will receive the JSON-RPC
   * response object.
   */
  send<T>(
    payload: JsonRpcRequest<unknown>,
    callback: (error: Error | null, result?: JsonRpcResponse<T>) => void,
  ): void;

  /**
   * Accepts a JSON-RPC request object, and synchronously returns the cached result
   * for the given method. Only supports 4 specific RPC methods.
   *
   * @deprecated Use "request" instead.
   * @param payload - A JSON-RPC request object.
   * @returns A JSON-RPC response object.
   */
  send<T>(payload: SendSyncJsonRpcRequest): JsonRpcResponse<T>;

  send(methodOrPayload: unknown, callbackOrArgs?: unknown): unknown {
    if (!this._state.sentWarnings.send) {
      this._log.warn(messages.warnings.sendDeprecation);
      this._state.sentWarnings.send = true;
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
          );
        } catch (error) {
          reject(error);
        }
      });
    } else if (
      methodOrPayload &&
      typeof methodOrPayload === 'object' &&
      typeof callbackOrArgs === 'function'
    ) {
      return this._rpcRequest(
        methodOrPayload as JsonRpcRequest<unknown>,
        callbackOrArgs as (...args: unknown[]) => void,
      );
    }
    return this._sendSync(methodOrPayload as SendSyncJsonRpcRequest);
  }

  /**
   * Internal backwards compatibility method, used in send.
   *
   * @deprecated
   */
  private _sendSync(payload: SendSyncJsonRpcRequest) {
    let result;
    switch (payload.method) {

      case 'eth_accounts':
        result = this.selectedAddress ? [this.selectedAddress] : [];
        break;

      case 'eth_coinbase':
        result = this.selectedAddress || null;
        break;

      case 'eth_uninstallFilter':
        this._rpcRequest(payload, NOOP);
        result = true;
        break;

      case 'net_version':
        result = this.networkVersion || null;
        break;

      default:
        throw new Error(messages.errors.unsupportedSync(payload.method));
    }

    return {
      id: payload.id,
      jsonrpc: payload.jsonrpc,
      result,
    };
  }
}

function validateLoggerObject(logger: ConsoleLike): void {
  if (logger !== console) {
    if (typeof logger === 'object') {
      const methodKeys = ['log', 'warn', 'error', 'debug', 'info', 'trace'];
      for (const key of methodKeys) {
        if (typeof logger[key as keyof ConsoleLike] !== 'function') {
          throw new Error(messages.errors.invalidLoggerMethod(key));
        }
      }
      return;
    }
    throw new Error(messages.errors.invalidLoggerObject());
  }
}
