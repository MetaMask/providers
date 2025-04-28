import ObjectMultiplex from '@metamask/object-multiplex';
import { detect } from 'detect-browser';
import { PortDuplexStream as PortStream } from 'extension-port-stream';
import { pipeline } from 'readable-stream';
import type { Runtime } from 'webextension-polyfill';

import config from './external-extension-config.json';
import { MetaMaskInpageProviderStreamName } from '../MetaMaskInpageProvider';
import { StreamProvider } from '../StreamProvider';
import { getDefaultExternalMiddleware } from '../utils';

const browser = detect();

export type ExtensionType = 'stable' | 'flask' | 'beta' | string;

/**
 * Creates an external extension provider for the given extension type or ID.
 * This is intended for use by 3rd party extensions.
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
    const streamName = MetaMaskInpageProviderStreamName;
    const mux = new ObjectMultiplex();
    pipeline(pluginStream, mux, pluginStream, (error: Error | null) => {
      let warningMsg = `Lost connection to "${streamName}".`;
      if (error?.stack) {
        warningMsg += `\n${error.stack}`;
      }
      console.warn(warningMsg);
    });
    provider = new StreamProvider(mux.createStream(streamName), {
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
  let ids: {
    stable: string;
    beta?: string;
    flask?: string;
  };

  switch (browser?.name) {
    case 'edge-chromium':
      ids = config.edgeChromiumIds;
      break;
    case 'firefox':
      ids = config.firefoxIds;
      break;
    default:
      ids = config.chromeIds;
  }

  return ids[typeOrId as keyof typeof ids] ?? typeOrId;
}

/**
 * Gets the build type for the given domain name identifier.
 *
 * @param rdns - The reverse syntax domain name identifier for the wallet.
 * @returns The type or ID.
 */
export function getBuildType(rdns: string): string | undefined {
  const rndsToIdDefinition: Record<string, string> = {
    'io.metamask': 'stable',
    'io.metamask.beta': 'beta',
    'io.metamask.flask': 'flask',
    'io.metamask.mobile': 'stable',
    'io.metamask.mobile.beta': 'beta',
    'io.metamask.mobile.flask': 'flask',
  };
  return rndsToIdDefinition[rdns];
}
