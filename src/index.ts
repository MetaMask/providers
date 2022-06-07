import { BaseProvider } from './BaseProvider';
import { createExternalExtensionProvider } from './extension-provider/createExternalExtensionProvider';
import {
  initializeProvider,
  setGlobalProvider,
} from './initializeInpageProvider';
import {
  MetaMaskInpageProvider,
  MetaMaskInpageProviderStreamName,
} from './MetaMaskInpageProvider';
import { shimWeb3 } from './shimWeb3';
import { StreamProvider } from './StreamProvider';

export {
  BaseProvider,
  createExternalExtensionProvider,
  initializeProvider,
  MetaMaskInpageProviderStreamName,
  MetaMaskInpageProvider,
  setGlobalProvider,
  shimWeb3,
  StreamProvider,
};
