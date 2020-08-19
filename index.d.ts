import { EventEmitter } from 'events';
import { Duplex } from 'stream';

export interface MetamaskInpageProviderOptions {

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

export class MetamaskInpageProvider extends EventEmitter {

  /**
   *
   * @param connectionStream A Node.js duplex stream
   * @param options An options bag
   */
  constructor (connectionStream: Duplex, options?: MetamaskInpageProviderOptions)

  readonly isMetaMask: true;

  readonly selectedAddress: string | null;

  readonly networkVersion: string | null;

  readonly chainId: string | undefined;

  isConnected (): boolean

  sendAsync (payload: JsonRpcPayload, callback: (error: Error | null, result?: JsonRpcResponse) => void): void

  /**
   * Submits an RPC request to MetaMask for the given method, with the given params.
   * Resolves with the result of the method call, or rejects on error.
   */
  request (args: RequestArguments): Promise<unknown>
}

/**
 * Initializes a MetamaskInpageProvider and (optionally) sets it on window.ethereum.
 * @returns The initialized provider (whether set or not).
 */
export function initProvider (
  opts?: Pick<MetamaskInpageProviderOptions, 'maxEventListeners' | 'shouldSendMetadata'> & {

    /** A Node.js duplex stream */
    connectionStream?: Duplex;

    /** Whether the provider should be set as window.ethereum */
    shouldSetOnWindow?: boolean;
  }
): MetamaskInpageProvider;

/**
 * Sets the given provider instance as window.ethereum and dispatches the 'ethereum#initialized' event on window.
 *
 * @param providerInstance - The provider instance.
 */
export function setGlobalProvider (providerInstance: MetamaskInpageProvider): void;

export interface RequestArguments {
  method: string;
  params?: unknown[];
}

/**
 * The jsonrpc and id properties will be handled if not provided.
 */
export interface JsonRpcPayload {
  method: string;
  params?: unknown[];
  id?: string | number;
  jsonrpc?: '2.0';
}

export interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}
