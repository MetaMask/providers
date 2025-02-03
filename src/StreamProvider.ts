import type { JsonRpcMiddleware } from '@metamask/json-rpc-engine';
import { createStreamMiddleware } from '@metamask/json-rpc-middleware-stream';
import type SafeEventEmitter from '@metamask/safe-event-emitter';
import type { Json, JsonRpcParams } from '@metamask/utils';
import { duplex as isDuplex } from 'is-stream';
import { pipeline } from 'readable-stream';
import type { Duplex } from 'readable-stream';

import type { BaseProviderOptions } from './BaseProvider';
import { BaseProvider } from './BaseProvider';
import messages from './messages';
import {
  EMITTED_NOTIFICATIONS,
  isValidChainId,
  isValidNetworkVersion,
} from './utils';

export type StreamProviderOptions = BaseProviderOptions;

export type JsonRpcConnection = {
  events: SafeEventEmitter;
  middleware: JsonRpcMiddleware<JsonRpcParams, Json>;
  stream: Duplex;
};

/**
 * An abstract EIP-1193 provider wired to some duplex stream via a
 * `json-rpc-middleware-stream` JSON-RPC stream middleware. Implementers must
 * call {@link AbstractStreamProvider._initializeStateAsync} after instantiation
 * to initialize the provider's state.
 */
export abstract class AbstractStreamProvider extends BaseProvider {
  protected _jsonRpcConnection: JsonRpcConnection;

  /**
   * Creates a new AbstractStreamProvider instance.
   *
   * @param connectionStream - A Node.js duplex stream.
   * @param options - An options bag.
   * @param options.logger - The logging API to use. Default: `console`.
   * @param options.maxEventListeners - The maximum number of event
   * listeners. Default: 100.
   * @param options.rpcMiddleware - The RPC middleware stack to use.
   */
  constructor(
    connectionStream: Duplex,
    {
      logger = console,
      maxEventListeners = 100,
      rpcMiddleware = [],
    }: StreamProviderOptions = {},
  ) {
    super({ logger, maxEventListeners, rpcMiddleware });

    if (!isDuplex(connectionStream)) {
      throw new Error(messages.errors.invalidDuplexStream());
    }

    // Bind functions to prevent consumers from making unbound calls
    this._handleStreamDisconnect = this._handleStreamDisconnect.bind(this);

    // Set up RPC connection
    // Typecast: The type of `Duplex` is incompatible with the type of
    // `JsonRpcConnection`.
    this._jsonRpcConnection = createStreamMiddleware({
      retryOnMessage: 'METAMASK_EXTENSION_CONNECT_CAN_RETRY',
    }) as unknown as JsonRpcConnection;

    pipeline(
      connectionStream,
      this._jsonRpcConnection.stream,
      connectionStream,
      this._handleStreamDisconnect.bind(this, 'MetaMask RpcProvider'),
    );

    // Wire up the JsonRpcEngine to the JSON-RPC connection stream
    this._rpcEngine.push(this._jsonRpcConnection.middleware);

    // Handle JSON-RPC notifications
    this._jsonRpcConnection.events.on('notification', (payload) => {
      const { method, params } = payload;
      if (method === 'metamask_accountsChanged') {
        this._handleAccountsChanged(params);
      } else if (method === 'metamask_chainChanged') {
        this._handleChainChanged(params);
      } else if (EMITTED_NOTIFICATIONS.includes(method)) {
        this.emit('message', {
          type: method,
          data: params,
        });
      } else if (method === 'METAMASK_STREAM_FAILURE') {
        connectionStream.destroy(
          new Error(messages.errors.permanentlyDisconnected()),
        );
      }
    });
  }

  //====================
  // Private Methods
  //====================

  /**
   * MUST be called by child classes.
   *
   * Calls `metamask_getProviderState` and passes the result to
   * {@link BaseProvider._initializeState}. Logs an error if getting initial state
   * fails. Throws if called after initialization has completed.
   */
  protected async _initializeStateAsync() {
    let initialState: Parameters<BaseProvider['_initializeState']>[0];

    try {
      initialState = (await this.request({
        method: 'metamask_getProviderState',
      })) as Parameters<BaseProvider['_initializeState']>[0];
    } catch (error) {
      this._log.error(
        'MetaMask: Failed to get initial state. Please report this bug.',
        error,
      );
    }
    this._initializeState(initialState);
  }

  /**
   * Called when connection is lost to critical streams. Emits an 'error' event
   * from the provider with the error message and stack if present.
   *
   * @param streamName - The name of the stream that disconnected.
   * @param error - The error that caused the disconnection.
   * @fires BaseProvider#disconnect - If the provider is not already
   * disconnected.
   */
  // eslint-disable-next-line no-restricted-syntax
  private _handleStreamDisconnect(streamName: string, error: Error | null) {
    let warningMsg = `MetaMask: Lost connection to "${streamName}".`;
    if (error?.stack) {
      warningMsg += `\n${error.stack}`;
    }

    this._log.warn(warningMsg);
    if (this.listenerCount('error') > 0) {
      this.emit('error', warningMsg);
    }

    this._handleDisconnect(false, error ? error.message : undefined);
  }

  /**
   * Upon receipt of a new chainId and networkVersion, emits corresponding
   * events and sets relevant public state. Child classes that use the
   * `networkVersion` for other purposes must implement additional handling.
   *
   * @fires BaseProvider#chainChanged
   * @param networkInfo - An object with network info.
   * @param networkInfo.chainId - The latest chain ID.
   * @param networkInfo.networkVersion - The latest network ID.
   * @param networkInfo.isConnected - Whether the network is available.
   */
  protected _handleChainChanged({
    chainId,
    networkVersion,
    isConnected,
  }: {
    chainId?: string | undefined;
    networkVersion?: string | undefined;
    isConnected?: boolean | undefined;
  } = {}) {
    if (!isValidChainId(chainId) || !isValidNetworkVersion(networkVersion)) {
      this._log.error(messages.errors.invalidNetworkParams(), {
        chainId,
        networkVersion,
      });
      return;
    }

    super._handleChainChanged({ chainId, isConnected });

    if (!isConnected) {
      this._handleDisconnect(true);
    }
  }
}

/**
 * An EIP-1193 provider wired to some duplex stream via a
 * `json-rpc-middleware-stream` JSON-RPC stream middleware. Consumers must
 * call {@link StreamProvider.initialize} after instantiation to complete
 * initialization.
 */
export class StreamProvider extends AbstractStreamProvider {
  /**
   * MUST be called after instantiation to complete initialization.
   *
   * Calls `metamask_getProviderState` and passes the result to
   * {@link BaseProvider._initializeState}. Logs an error if getting initial state
   * fails. Throws if called after initialization has completed.
   */
  async initialize() {
    return this._initializeStateAsync();
  }
}
