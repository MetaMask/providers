import type { Duplex } from 'stream';
import ObjectMultiplex from '@metamask/object-multiplex';
import SafeEventEmitter from '@metamask/safe-event-emitter';
import { duplex as isDuplex } from 'is-stream';
import type { JsonRpcMiddleware } from 'json-rpc-engine';
import { createStreamMiddleware } from 'json-rpc-middleware-stream';
import pump from 'pump';
import messages from './messages';
import {
  EMITTED_NOTIFICATIONS,
  isValidChainId,
  isValidNetworkVersion,
} from './utils';
import { BaseProvider, BaseProviderOptions } from './BaseProvider';

export interface StreamProviderOptions extends BaseProviderOptions {
  /**
   * The name of the stream used to connect to the wallet.
   */
  jsonRpcStreamName: string;
}

export interface JsonRpcConnection {
  events: SafeEventEmitter;
  middleware: JsonRpcMiddleware<unknown, unknown>;
  stream: Duplex;
}

/**
 * An abstract EIP-1193 provider wired to some duplex stream via a
 * `json-rpc-middleware-stream` JSON-RPC stream middleware. Implementers must
 * call {@link AbstractStreamProvider._initializeStateAsync} after instantiation
 * to initialize the provider's state.
 */
export abstract class AbstractStreamProvider extends BaseProvider {
  protected _jsonRpcConnection: JsonRpcConnection;

  /**
   * @param connectionStream - A Node.js duplex stream
   * @param options - An options bag
   * @param options.jsonRpcStreamName - The name of the internal JSON-RPC stream.
   * @param options.logger - The logging API to use. Default: console
   * @param options.maxEventListeners - The maximum number of event
   * listeners. Default: 100
   */
  constructor(
    connectionStream: Duplex,
    {
      jsonRpcStreamName,
      logger,
      maxEventListeners,
      rpcMiddleware,
    }: StreamProviderOptions,
  ) {
    super({ logger, maxEventListeners, rpcMiddleware });

    if (!isDuplex(connectionStream)) {
      throw new Error(messages.errors.invalidDuplexStream());
    }

    // Bind functions to prevent consumers from making unbound calls
    this._handleStreamDisconnect = this._handleStreamDisconnect.bind(this);

    // Set up connectionStream multiplexing
    const mux = new ObjectMultiplex();
    pump(
      connectionStream,
      mux as unknown as Duplex,
      connectionStream,
      this._handleStreamDisconnect.bind(this, 'MetaMask'),
    );

    // Set up RPC connection
    this._jsonRpcConnection = createStreamMiddleware({
      retryOnMessage: 'METAMASK_EXTENSION_CONNECT_CAN_RETRY',
    });
    pump(
      this._jsonRpcConnection.stream,
      mux.createStream(jsonRpcStreamName) as unknown as Duplex,
      this._jsonRpcConnection.stream,
      this._handleStreamDisconnect.bind(this, 'MetaMask RpcProvider'),
    );

    // Wire up the JsonRpcEngine to the JSON-RPC connection stream
    this._rpcEngine.push(this._jsonRpcConnection.middleware);

    // Handle JSON-RPC notifications
    this._jsonRpcConnection.events.on('notification', (payload) => {
      const { method, params } = payload;
      if (method === 'metamask_accountsChanged') {
        this._handleAccountsChanged(params);
      } else if (method === 'metamask_unlockStateChanged') {
        this._handleUnlockStateChanged(params);
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
   * **MUST** be called by child classes.
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
   * @emits BaseProvider#disconnect
   */
  private _handleStreamDisconnect(streamName: string, error: Error) {
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
   * events and sets relevant public state. This class does not have a
   * `networkVersion` property, but we rely on receiving a `networkVersion`
   * with the value of `loading` to detect when the network is changing and
   * a recoverable `disconnect` even has occurred. Child classes that use the
   * `networkVersion` for other purposes must implement additional handling
   * therefore.
   *
   * @emits BaseProvider#chainChanged
   * @param networkInfo - An object with network info.
   * @param networkInfo.chainId - The latest chain ID.
   * @param networkInfo.networkVersion - The latest network ID.
   */
  protected _handleChainChanged({
    chainId,
    networkVersion,
  }: { chainId?: string; networkVersion?: string } = {}) {
    if (!isValidChainId(chainId) || !isValidNetworkVersion(networkVersion)) {
      this._log.error(messages.errors.invalidNetworkParams(), {
        chainId,
        networkVersion,
      });
      return;
    }

    if (networkVersion === 'loading') {
      this._handleDisconnect(true);
    } else {
      super._handleChainChanged({ chainId });
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
   * **MUST** be called after instantiation to complete initialization.
   *
   * Calls `metamask_getProviderState` and passes the result to
   * {@link BaseProvider._initializeState}. Logs an error if getting initial state
   * fails. Throws if called after initialization has completed.
   */
  async initialize() {
    return this._initializeStateAsync();
  }
}
