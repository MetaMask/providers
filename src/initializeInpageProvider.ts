import { Duplex } from 'stream';

import { EIP6963ProviderInfo, announceProvider } from './EIP6963';
import {
  MetaMaskInpageProvider,
  MetaMaskInpageProviderOptions,
} from './MetaMaskInpageProvider';
import { shimWeb3 } from './shimWeb3';

type InitializeProviderOptions = {
  /**
   * The stream used to connect to the wallet.
   */
  connectionStream: Duplex;

  /**
   * The EIP-6963 provider info that should be announced if set.
   */
  shouldAnnounceProviderInfo?: EIP6963ProviderInfo;

  /**
   * Whether the provider should be set as window.ethereum.
   */
  shouldSetOnWindow?: boolean;

  /**
   * Whether the window.web3 shim should be set.
   */
  shouldShimWeb3?: boolean;
} & MetaMaskInpageProviderOptions;

/**
 * Initializes a MetaMaskInpageProvider and (optionally) assigns it as window.ethereum.
 *
 * @param options - An options bag.
 * @param options.connectionStream - A Node.js stream.
 * @param options.jsonRpcStreamName - The name of the internal JSON-RPC stream.
 * @param options.maxEventListeners - The maximum number of event listeners.
 * @param options.shouldAnnounceProviderInfo - The EIP-6963 provider info that should be announced if set.
 * @param options.shouldSendMetadata - Whether the provider should send page metadata.
 * @param options.shouldSetOnWindow - Whether the provider should be set as window.ethereum.
 * @param options.shouldShimWeb3 - Whether a window.web3 shim should be injected.
 * @param options.logger - The logging API to use. Default: `console`.
 * @returns The initialized provider (whether set or not).
 */
export function initializeProvider({
  connectionStream,
  jsonRpcStreamName,
  logger = console,
  maxEventListeners = 100,
  shouldAnnounceProviderInfo,
  shouldSendMetadata = true,
  shouldSetOnWindow = true,
  shouldShimWeb3 = false,
}: InitializeProviderOptions): MetaMaskInpageProvider {
  const provider = new MetaMaskInpageProvider(connectionStream, {
    jsonRpcStreamName,
    logger,
    maxEventListeners,
    shouldSendMetadata,
  });

  const proxiedProvider = new Proxy(provider, {
    // some common libraries, e.g. web3@1.x, mess with our API
    deleteProperty: () => true,
  });

  if (shouldAnnounceProviderInfo) {
    announceProvider({
      info: shouldAnnounceProviderInfo,
      provider: proxiedProvider,
    });
  }

  if (shouldSetOnWindow) {
    setGlobalProvider(proxiedProvider);
  }

  if (shouldShimWeb3) {
    shimWeb3(proxiedProvider, logger);
  }

  return proxiedProvider;
}

/**
 * Sets the given provider instance as window.ethereum and dispatches the
 * 'ethereum#initialized' event on window.
 *
 * @param providerInstance - The provider instance.
 */
export function setGlobalProvider(
  providerInstance: MetaMaskInpageProvider,
): void {
  (window as Record<string, any>).ethereum = providerInstance;
  window.dispatchEvent(new Event('ethereum#initialized'));
}
