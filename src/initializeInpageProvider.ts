import { type Duplex } from 'readable-stream';

import type { CAIP294WalletData } from './CAIP294';
import { announceWallet } from './CAIP294';
import { announceProvider as announceEip6963Provider } from './EIP6963';
import { getBuildType } from './extension-provider/createExternalExtensionProvider';
import type { MetaMaskInpageProviderOptions } from './MetaMaskInpageProvider';
import { MetaMaskInpageProvider } from './MetaMaskInpageProvider';
import { shimWeb3 } from './shimWeb3';
import type { BaseProviderInfo } from './types';

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
  logger = console,
  maxEventListeners = 100,
  providerInfo,
  shouldSendMetadata = true,
  shouldSetOnWindow = true,
  shouldShimWeb3 = false,
}: InitializeProviderOptions): MetaMaskInpageProvider {
  const provider = new MetaMaskInpageProvider(connectionStream, {
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
    announceEip6963Provider({
      info: providerInfo,
      provider: proxiedProvider,
    });
    // eslint-disable-next-line no-void
    void announceCaip294WalletData(provider, providerInfo);
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
 * Announces [CAIP-294](https://github.com/ChainAgnostic/CAIPs/blob/bc4942857a8e04593ed92f7dc66653577a1c4435/CAIPs/caip-294.md) wallet data according to build type and browser.
 * Until released to stable, `extensionId` is only set in the `metamask_getProviderState` result if the build type is `flask`.
 * `extensionId` is included if browser is chromium based because it is only useable by browsers that support [externally_connectable](https://developer.chrome.com/docs/extensions/reference/manifest/externally-connectable).
 *
 * @param provider - The provider {@link MetaMaskInpageProvider} used for retrieving `extensionId`.
 * @param providerInfo - The provider info {@link BaseProviderInfo} that should be announced if set.
 */
export async function announceCaip294WalletData(
  provider: MetaMaskInpageProvider,
  providerInfo: CAIP294WalletData,
): Promise<void> {
  const buildType = getBuildType(providerInfo.rdns);
  if (buildType !== 'flask') {
    return;
  }

  const providerState = await provider.request<{ extensionId?: string }>({
    method: 'metamask_getProviderState',
  });

  const targets = [];

  const extensionId = providerState?.extensionId;
  if (extensionId) {
    targets.push({
      type: 'caip-348',
      value: extensionId,
    });
  }

  const walletData = {
    ...providerInfo,
    targets,
  };

  announceWallet(walletData);
}
