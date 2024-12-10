import { type Browser, detect } from 'detect-browser';
import type { Duplex } from 'readable-stream';

import type { CAIP294WalletData } from './CAIP294';
import { announceWallet } from './CAIP294';
import { announceProvider as announceEip6963Provider } from './EIP6963';
import {
  getExtensionId,
  getBuildType,
} from './extension-provider/createExternalExtensionProvider';
import type { MetaMaskInpageProviderOptions } from './MetaMaskInpageProvider';
import { MetaMaskInpageProvider } from './MetaMaskInpageProvider';
import { shimWeb3 } from './shimWeb3';
import type { BaseProviderInfo } from './types';

const browser = detect();

type InitializeProviderOptions = {
  /**
   * The stream used to connect to the wallet.
   */
  connectionStream: Duplex;

  /**
   * The EIP-6963 provider info / CAIP-294 wallet data that should be announced if set.
   */
  providerInfo?: BaseProviderInfo;

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
 * @param options.providerInfo - The EIP-6963 provider info / CAIP-294 wallet data that should be announced if set.
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
  providerInfo,
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
    // fix issue with Proxy unable to access private variables from getters
    // https://stackoverflow.com/a/73051482
    get(target, propName: 'chainId' | 'networkVersion' | 'selectedAddress') {
      return target[propName];
    },
  });

  if (providerInfo) {
    announceCaip294WalletData(providerInfo);
    announceEip6963Provider({
      info: providerInfo,
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

/**
 * Announces caip294 wallet data according to build type and browser.
 * For now, should only announce if build type is `flask`.
 * `extensionId` is included if browser is NOT `firefox`.
 *
 * @param providerInfo - The provider info {@link BaseProviderInfo}that should be announced if set.
 */
function announceCaip294WalletData(providerInfo: CAIP294WalletData): void {
  const buildType = getBuildType(providerInfo.rdns);
  if (buildType !== 'flask') {
    return;
  }
  const extensionId =
    (browser?.name as Browser) === 'firefox'
      ? undefined
      : getExtensionId(buildType);
  announceWallet({ extensionId, ...providerInfo });
}
