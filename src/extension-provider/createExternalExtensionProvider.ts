import PortStream from 'extension-port-stream';
import { detect } from 'detect-browser';
import type { Runtime } from 'webextension-polyfill';
import { MetaMaskInpageProviderStreamName } from '../MetaMaskInpageProvider';
import { StreamProvider } from '../StreamProvider';
import { getDefaultExternalMiddleware } from '../utils';
import config from './external-extension-config.json';

const browser = detect();

export type ExtensionType = 'stable' | 'flask' | 'beta' | string;

export function createExternalExtensionProvider(
  typeOrId: ExtensionType = 'stable',
) {
  let provider;

  try {
    const extensionId = getExtensionId(typeOrId);
    const metamaskPort = chrome.runtime.connect(extensionId) as Runtime.Port;

    const pluginStream = new PortStream(metamaskPort);
    provider = new StreamProvider(pluginStream, {
      jsonRpcStreamName: MetaMaskInpageProviderStreamName,
      logger: console,
      rpcMiddleware: getDefaultExternalMiddleware(console),
    });

    // This is asynchronous but merely logs an error and does not throw upon
    // failure. Previously this just happened as a side-effect in the
    // constructor.
    provider.initialize();
  } catch (error) {
    console.dir(`MetaMask connect error.`, error);
    throw error;
  }
  return provider;
}

function getExtensionId(typeOrId: ExtensionType) {
  const ids =
    browser?.name === 'firefox' ? config.firefoxIds : config.chromeIds;
  return ids[typeOrId as keyof typeof ids] ?? typeOrId;
}
