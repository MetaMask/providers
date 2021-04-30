import MetaMaskInpageProvider from './MetaMaskInpageProvider';
import createMetaMaskExternalExtensionProvider from './createMetaMaskExternalExtensionProvider';
import BaseProvider from './BaseProvider';
import {
  initializeProvider,
  setGlobalProvider,
} from './initializeInpageProvider';
import shimWeb3 from './shimWeb3';

export {
  initializeProvider,
  MetaMaskInpageProvider,
  BaseProvider,
  setGlobalProvider,
  shimWeb3,
  createMetaMaskExternalExtensionProvider,
};
