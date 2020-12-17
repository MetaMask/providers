// You may have to bring your own Node types (e.g. @types/node) for these imports.
import { EventEmitter } from 'events';
import { Duplex } from 'stream';
import { JsonRpcRequest, JsonRpcResponse } from 'json-rpc-engine';

export interface MetaMaskInpageProviderOptions {

  /**
   * The name of the stream used to connect to the wallet.
   */
  jsonRpcStreamName?: string;

  /**
   * The logging API to use.
   */
  logger?: Pick<Console, 'log' | 'warn' | 'error' | 'debug' | 'info' | 'trace'>;

  /**
   * The maximum number of event listeners.
   */
  maxEventListeners?: number;

  /**
   * Whether the provider should send page metadata.
   */
  shouldSendMetadata?: boolean;
}

export class MetaMaskInpageProvider extends EventEmitter {

  /**
   * @param connectionStream - A Node.js duplex stream.
   * @param options - An options bag.
   */
  constructor(connectionStream: Duplex, options?: MetaMaskInpageProviderOptions);

  /**
   * Returns whether the provider can process RPC requests.
   */
  isConnected(): boolean;

  /**
   * Submits an RPC request for the given method, with the given params.
   * Resolves with the result of the method call, or rejects on error.
   */
  request(args: RequestArguments): Promise<unknown>;

  /**
   * Submits an RPC request per the given JSON-RPC request object.
   */
  sendAsync(
    payload: JsonRpcRequest<unknown>,
    callback: (error: Error | null, result?: JsonRpcResponse<unknown>) => void,
  ): void;

  /**
   * Submits an RPC request for the given method, with the given params.
   * @deprecated Use {@link request} instead.
   */
  send(method: string, params?: unknown[]): Promise<JsonRpcResponse<unknown>>;

  /**
   * Submits an RPC request per the given JSON-RPC request object.
   * @deprecated Use {@link request} instead.
   */
  send(
    payload: JsonRpcRequest<unknown>,
    callback: (error: Error | null, result?: JsonRpcResponse<unknown>) => void,
  ): void;

  /**
   * Accepts a JSON-RPC request object, and synchronously returns the cached result
   * for the given method. Only supports 4 specific methods.
   * @deprecated Use {@link request} instead.
   */
  send(payload: SendSyncJsonRpcRequest): JsonRpcResponse<unknown>;

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

interface InitializeProviderOptions extends MetaMaskInpageProviderOptions {

  /**
   * The stream used to connect to the wallet.
   */
  connectionStream: Duplex;

  /**
   * Whether the provider should be set as window.ethereum.
   */
  shouldSetOnWindow?: boolean;

  /**
   * Whether the window.web3 shim should be set.
   */
  shouldShimWeb3?: boolean;
}

/**
 * Initializes a MetaMaskInpageProvider and (optionally) assigns it as window.ethereum.
 *
 * @returns The initialized provider (whether set or not).
 */
export function initializeProvider(
  options: InitializeProviderOptions,
): MetaMaskInpageProvider;

/**
 * Sets the given provider instance as window.ethereum and dispatches
 * the 'ethereum#initialized' event on window.
 *
 * @param providerInstance - The provider instance.
 */
export function setGlobalProvider(providerInstance: MetaMaskInpageProvider): void;

/**
 * If no existing window.web3 is found, this function injects a web3 "shim" to
 * not break dapps that rely on window.web3.currentProvider.
 *
 * @param provider - The provider to set as window.web3.currentProvider.
 * @param log - The logging API to use.
 */
export function shimWeb3(provider: MetaMaskInpageProvider, log: typeof console): void;

export interface RequestArguments {

  /** The RPC method to request. */
  method: string;

  /** The params of the RPC method, if any. */
  params?: unknown[] | Record<string, unknown>;
}

export interface SendSyncJsonRpcRequest extends JsonRpcRequest<unknown> {
  method: 'eth_accounts' | 'eth_coinbase' | 'eth_uninstallFilter' | 'net_version';
}
