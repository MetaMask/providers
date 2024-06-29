import { detect } from 'detect-browser';
import { PortDuplexStream as PortStream } from 'extension-port-stream';
import type { Duplex } from 'readable-stream';
import type { Runtime } from 'webextension-polyfill';

import config from './external-extension-config';
import { MetaMaskInpageProviderStreamName } from '../MetaMaskInpageProvider';
import { StreamProvider } from '../StreamProvider';
import { getDefaultExternalMiddleware } from '../utils';

const browser = detect();

export type ExtensionType = 'stable' | 'flask' | 'beta' | string;

/**
 * Creates an external extension provider for the given extension type or ID.
 *
 * @param typeOrId - The extension type or ID.
 * @returns The external extension provider.
 */
export function createExternalExtensionProvider(
  typeOrId: ExtensionType = 'stable',
) {
  let provider;

  try {
    const extensionId = getExtensionId(typeOrId);
    const metamaskPort = chrome.runtime.connect(extensionId) as Runtime.Port;

    const pluginStream = new PortStream(metamaskPort);
    provider = new StreamProvider(pluginStream as unknown as Duplex, {
      jsonRpcStreamName: MetaMaskInpageProviderStreamName,
      logger: console,
      rpcMiddleware: getDefaultExternalMiddleware(console),
    });

    // This is asynchronous but merely logs an error and does not throw upon
    // failure. Previously this just happened as a side-effect in the
    // constructor.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    provider.initialize();
  } catch (error) {
    console.dir(`MetaMask connect error.`, error);
    throw error;
  }
  return provider;
}

/**
 * Gets the extension ID for the given extension type or ID.
 *
 * @param typeOrId - The extension type or ID.
 * @returns The extension ID.
 */
function getExtensionId(typeOrId: ExtensionType) {
  const ids =
    browser?.name === 'firefox' ? config.firefoxIds : config.chromeIds;
  return ids[typeOrId as keyof typeof ids] ?? typeOrId;
}
