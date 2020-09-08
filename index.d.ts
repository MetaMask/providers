import { EventEmitter } from 'events';
import { Duplex } from 'stream';

export interface MetaMaskInpageProviderOptions {

  /**
   * The logging API to use.
   * @default console
   */
  logger?: Pick<Console, 'log' | 'warn' | 'error' | 'debug' | 'info' | 'trace'>;

  /**
   * The maximum number of event listeners.
   * @default 100
   */
  maxEventListeners?: number;

  /**
   * Whether the provider should send page metadata.
   * @default true
   */
  shouldSendMetadata?: boolean;
}

export class MetaMaskInpageProvider extends EventEmitter {

  /**
   * @param connectionStream - A Node.js duplex stream.
   * @param options - An options bag.
   */
  constructor (connectionStream: Duplex, options?: MetaMaskInpageProviderOptions);

  /**
   * Returns whether the provider can process RPC requests.
   */
  isConnected (): boolean;

  /**
   * Submits an RPC request for the given method, with the given params.
   * Resolves with the result of the method call, or rejects on error.
   */
  request (args: RequestArguments): Promise<unknown>;

  /**
   * Submits an RPC request per the given JSON-RPC request object.
   */
  sendAsync (
    payload: JsonRpcRequest,
    callback: (error: Error | null, result?: JsonRpcResponse) => void,
  ): void;

  /**
   * Submits an RPC request for the given method, with the given params.
   * @deprecated Use {@link request} instead.
   */
  send (method: string, params?: unknown[]): Promise<JsonRpcResponse>;

  /**
   * Submits an RPC request per the given JSON-RPC request object.
   * @deprecated Use {@link request} instead.
   */
  send (
    payload: JsonRpcRequest,
    callback: (error: Error | null, result?: JsonRpcResponse) => void,
  ): void;

  /**
   * Accepts a JSON-RPC request object, and synchronously returns the cached result
   * for the given method. Only supports 4 specific methods.
   * @deprecated Use {@link request} instead.
   */
  send (payload: SendSyncJsonRpcRequest): JsonRpcResponse;

  /**
   * Indicating that this provider is a MetaMask provider.
   */
  readonly isMetaMask: true;

  /**
   * The user's currently selected Ethereum address.
   * If null, MetaMask is either locked or the user has not permitted any
   * addresses to be viewed.
   */
  readonly selectedAddress: string | null;

  /**
   * The network ID of the currently connected Ethereum chain.
   * @deprecated Use {@link chainId} instead.
   */
  readonly networkVersion: string | null;

  /**
   * The chain ID of the currently connected Ethereum chain.
   * See [chainId.network]{@link https://chainid.network} for more information.
   */
  readonly chainId: string | undefined;
}

/**
 * Initializes a MetaMaskInpageProvider and (optionally) assigns it as window.ethereum.
 * @returns The initialized provider (whether set or not).
 */
export function initProvider (
  options: Pick<MetaMaskInpageProviderOptions, 'maxEventListeners' | 'shouldSendMetadata'> & {

    /** A Node.js duplex stream. */
    connectionStream: Duplex;

    /**
     * Whether the provider should be set as window.ethereum.
     * @default true
     */
    shouldSetOnWindow?: boolean;
  }
): MetaMaskInpageProvider;

/**
 * Sets the given provider instance as window.ethereum and dispatches
 * the 'ethereum#initialized' event on window.
 *
 * @param providerInstance - The provider instance.
 */
export function setGlobalProvider (providerInstance: MetaMaskInpageProvider): void;

export interface RequestArguments {

  /** The RPC method to request. */
  method: string;

  /** The params of the RPC method, if any. */
  params?: unknown[];
}

export interface JsonRpcRequest {

  /** The RPC method to request. */
  method: string;

  /** The params of the RPC method, if any. */
  params?: unknown[];

  /** For spec compliance; handled if not provided. */
  id?: string | number;

  /** For spec compliance; handled if not provided. */
  jsonrpc?: '2.0';
}

export interface SendSyncJsonRpcRequest extends JsonRpcRequest {
  method: 'eth_accounts' | 'eth_coinbase' | 'eth_uninstallFilter' | 'net_version';
}

interface JsonRpcResponseBase {

  /** Equal to the corresponding JSON-RPC request object. */
  id?: string | number;

  /** Equal to the corresponding JSON-RPC request. */
  jsonrpc?: '2.0';
}

export interface JsonRpcErrorResponse extends JsonRpcResponseBase {
  error: {
    code: number;
    message: string;
    data?: unknown;
  };
}

export interface JsonRpcSuccessResponse extends JsonRpcResponseBase {
  result: unknown;
}

export type JsonRpcResponse = JsonRpcSuccessResponse | JsonRpcErrorResponse;
