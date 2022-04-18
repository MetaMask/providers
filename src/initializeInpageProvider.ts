import { Duplex } from 'stream';
import ObjectMultiplex from '@metamask/object-multiplex';
import pump from 'pump';
import MetaMaskInpageProvider, {
  MetaMaskInpageProviderOptions,
} from './MetaMaskInpageProvider';

const DEFAULT_INPAGE_STREAM_NAME = 'voyage-provider';

interface InitializeProviderOptions extends MetaMaskInpageProviderOptions {
  jsonRpcStreamName?: string;
  /**
   * The stream used to connect to the wallet.
   */
  connectionStream: Duplex;

  /**
   * Whether the provider should be set as window.voyage.
   */
  shouldSetOnWindow?: boolean;
}

/**
 * Initializes a MetaMaskInpageProvider and (optionally) assigns it as window.ethereum.
 *
 * @param options - An options bag.
 * @param options.connectionStream - A Node.js stream.
 * @param options.jsonRpcStreamName - The name of the internal JSON-RPC stream.
 * @param options.maxEventListeners - The maximum number of event listeners.
 * @param options.shouldSendMetadata - Whether the provider should send page metadata.
 * @param options.shouldSetOnWindow - Whether the provider should be set as window.ethereum.
 * @param options.shouldShimWeb3 - Whether a window.web3 shim should be injected.
 * @returns The initialized provider (whether set or not).
 */
export function initializeProvider({
  connectionStream,
  jsonRpcStreamName = DEFAULT_INPAGE_STREAM_NAME,
  logger = console,
  maxEventListeners = 100,
  shouldSendMetadata = true,
  shouldSetOnWindow = true,
}: InitializeProviderOptions): MetaMaskInpageProvider {
  const mux = new ObjectMultiplex();
  pump(connectionStream, mux, connectionStream, (err) => {
    if (err) {
      console.error(err);
    }
  });

  let provider = new MetaMaskInpageProvider(
    mux.createStream(jsonRpcStreamName) as Duplex,
    {
      logger,
      maxEventListeners,
      shouldSendMetadata,
    },
  );

  provider = new Proxy(provider, {
    // some common libraries, e.g. web3@1.x, mess with our API
    deleteProperty: () => true,
  });

  if (shouldSetOnWindow) {
    setGlobalProvider(provider);
  }

  return provider;
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
  (window as Record<string, any>).voyage = providerInstance;
  window.dispatchEvent(new Event('voyage#initialized'));
}
