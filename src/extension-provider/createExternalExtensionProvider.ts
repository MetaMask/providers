import PortStream from 'extension-port-stream';
import { detect } from 'detect-browser';
import { Runtime } from 'webextension-polyfill-ts';
import BaseProvider from '../BaseProvider';
import config from './external-extension-config.json';

const browser = detect();

export default function createMetaMaskExternalExtensionProvider() {
  let provider;
  try {
    const currentMetaMaskId = getMetaMaskId();
    const metamaskPort = chrome.runtime.connect(
      currentMetaMaskId,
    ) as Runtime.Port;
    const pluginStream = new PortStream(metamaskPort);
    provider = new BaseProvider(pluginStream);
  } catch (e) {
    console.dir(`Metamask connect error `, e);
    throw e;
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
