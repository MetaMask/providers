import PortStream from 'extension-port-stream';
import { detect } from 'detect-browser';
import { Runtime } from 'webextension-polyfill-ts';
import { StreamProvider } from '../StreamProvider';
import { getDefaultExternalMiddleware } from '../utils';
import config from './external-extension-config.json';

const browser = detect();

export function createExternalExtensionProvider() {
  let provider;

  try {
    const currentMetaMaskId = getMetaMaskId();
    const metamaskPort = chrome.runtime.connect(
      currentMetaMaskId,
    ) as Runtime.Port;

    const pluginStream = new PortStream(metamaskPort);
    provider = new StreamProvider(pluginStream, {
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

function getMetaMaskId() {
  switch (browser?.name) {
    case 'chrome':
      return config.CHROME_ID;
    case 'firefox':
      return config.FIREFOX_ID;
    default:
      return config.CHROME_ID;
  }
}
