import { announceWallet, type CAIP294WalletData } from './CAIP294';
import { getBuildType } from './extension-provider/createExternalExtensionProvider';
import {
  announceCaip294WalletData,
  setGlobalProvider,
} from './initializeInpageProvider';
import type { MetaMaskInpageProvider } from './MetaMaskInpageProvider';

jest.mock('./extension-provider/createExternalExtensionProvider');
jest.mock('./CAIP294');

describe('setGlobalProvider', () => {
  it('should call addEventListener once', () => {
    const mockProvider = {} as unknown as MetaMaskInpageProvider;
    const dispatchEvent = jest.spyOn(window, 'dispatchEvent');
    setGlobalProvider(mockProvider);

    expect(dispatchEvent).toHaveBeenCalledTimes(1);
    expect(dispatchEvent).toHaveBeenCalledWith(
      new Event('ethereum#initialized'),
    );
  });

  it('should not throw an error if the global ethereum provider is already set', () => {
    const errorSpy = jest.spyOn(console, 'error');

    const mockProvider = {} as unknown as MetaMaskInpageProvider;
    Object.defineProperty(window, 'ethereum', {
      get() {
        return {};
      },
      set() {
        throw new Error('window.ethereum already set');
      },
      configurable: false,
    });
    expect(() => setGlobalProvider(mockProvider)).not.toThrow();

    expect(errorSpy).toHaveBeenCalledWith(
      'MetaMask encountered an error setting the global Ethereum provider - this is likely due to another Ethereum wallet extension also setting the global Ethereum provider:',
      expect.any(Error),
    );
  });
});

describe('announceCaip294WalletData', () => {
  const mockProvider = {
    request: jest.fn(),
  } as unknown as MetaMaskInpageProvider;
  const mockProviderInfo: CAIP294WalletData = {
    uuid: '123e4567-e89b-12d3-a456-426614174000',
    name: 'Test Wallet',
    icon: 'data:image/png;base64,iVBORw0KGgo=',
    rdns: 'com.testwallet',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('build type is not flask', () => {
    it('should not announce wallet if build type is not flask', async () => {
      (getBuildType as jest.Mock).mockReturnValue('stable');

      await announceCaip294WalletData(mockProvider, mockProviderInfo);

      expect(getBuildType).toHaveBeenCalledWith(mockProviderInfo.rdns);
      expect(announceWallet).not.toHaveBeenCalled();
    });
  });

  describe('build type is flask', () => {
    it('should announce wallet with caip-348 target for chromium browsers', async () => {
      const extensionId = 'test-extension-id';
      (getBuildType as jest.Mock).mockReturnValue('flask');
      (mockProvider.request as jest.Mock).mockReturnValue({ extensionId });

      await announceCaip294WalletData(mockProvider, mockProviderInfo);

      expect(getBuildType).toHaveBeenCalledWith(mockProviderInfo.rdns);
      expect(announceWallet).toHaveBeenCalledWith({
        ...mockProviderInfo,
        targets: [
          {
            type: 'caip-348',
            value: extensionId,
          },
        ],
      });
    });

    it('should announce wallet without caip-348 target for firefox browser', async () => {
      (getBuildType as jest.Mock).mockReturnValue('flask');
      (mockProvider.request as jest.Mock).mockReturnValue({});

      await announceCaip294WalletData(mockProvider, mockProviderInfo);

      expect(getBuildType).toHaveBeenCalledWith(mockProviderInfo.rdns);
      expect(announceWallet).toHaveBeenCalledWith({
        ...mockProviderInfo,
        targets: [],
      });
    });
  });
});
