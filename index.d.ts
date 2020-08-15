import { EventEmitter } from 'events';
import { Duplex } from 'stream';
import { AbstractProvider } from 'web3-core';

export interface MetamaskInpageProviderOptions {
    /**
     * The logging API to use.
     * @default console
     */
    logger?: Console;
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
export class MetamaskInpageProvider extends EventEmitter implements AbstractProvider {
    /**
     *
     * @param connectionStream A Node.js duplex stream
     * @param options An options bag
     */
    constructor(connectionStream: Duplex, options?: MetamaskInpageProviderOptions);
    readonly isMetaMask: true;
    readonly selectedAddress: string | null;
    // Help wanted. Is it a string?
    readonly networkVersion: undefined;
    // Help wanted. Is it a string?
    readonly chainId: undefined;
    get publicConfigStore(): any;
    isConnected(): boolean;
    /** Submits an RPC request to MetaMask for the given method, with the given params. Resolves with the result of the method call, or rejects on error. */
    request(jsonRPCPayload: object): Promise<unknown>;
    sendAsync(jsonRPCPayload: object, callback: (err: Error | undefined, result: undefined) => void): void;
}
/**
 * Initializes a MetamaskInpageProvider and (optionally) sets it on window.ethereum.
 * @returns The initialized provider (whether set or not).
 */
export function initProvider(
    opts?: Pick<MetamaskInpageProviderOptions, 'maxEventListeners' | 'shouldSendMetadata'> & {
        /** A Node.js duplex stream */
        connectionStream?: Duplex;
        /** Whether the provider should be set as window.ethereum */
        shouldSetOnWindow?: boolean;
    },
): MetamaskInpageProvider;
/**
 * Sets the given provider instance as window.ethereum and dispatches the 'ethereum#initialized' event on window.
 *
 * @param providerInstance - The provider instance.
 */
export function setGlobalProvider(providerInstance: MetamaskInpageProvider): void;
