import { detect } from 'detect-browser';

import { announceWallet, type CAIP294WalletData } from './CAIP294';
import {
  getBuildType,
  getExtensionId,
} from './extension-provider/createExternalExtensionProvider';
import { announceCaip294WalletData } from './initializeInpageProvider';

jest.mock('./extension-provider/createExternalExtensionProvider');
jest.mock('./CAIP294');
jest.mock('detect-browser');

describe('announceCaip294WalletData', () => {
  const mockProviderInfo: CAIP294WalletData = {
    uuid: '123e4567-e89b-12d3-a456-426614174000',
    name: 'Test Wallet',
    icon: 'data:image/png;base64,iVBORw0KGgo=',
    rdns: 'com.testwallet',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should not announce wallet if build type is not flask', () => {
    (getBuildType as jest.Mock).mockReturnValue('stable');

    announceCaip294WalletData(mockProviderInfo);

    expect(getBuildType).toHaveBeenCalledWith(mockProviderInfo.rdns);
    expect(getExtensionId).not.toHaveBeenCalled();
    expect(announceWallet).not.toHaveBeenCalled();
  });

  it('should announce wallet with extensionId for non-firefox browsers', () => {
    (getBuildType as jest.Mock).mockReturnValue('flask');
    (getExtensionId as jest.Mock).mockReturnValue('test-extension-id');
    // (global as any).browser = { name: 'chrome' };
    (detect as jest.Mock).mockReturnValue({ name: 'chrome' });

    announceCaip294WalletData(mockProviderInfo);

    expect(getBuildType).toHaveBeenCalledWith(mockProviderInfo.rdns);
    expect(getExtensionId).toHaveBeenCalledWith('flask');
    expect(announceWallet).toHaveBeenCalledWith({
      ...mockProviderInfo,
      extensionId: 'test-extension-id',
    });
  });

  it('should announce wallet without extensionId for firefox browser', () => {
    (getBuildType as jest.Mock).mockReturnValue('flask');
    (detect as jest.Mock).mockReturnValue({ name: 'firefox' });

    announceCaip294WalletData(mockProviderInfo);

    expect(getBuildType).toHaveBeenCalledWith(mockProviderInfo.rdns);
    expect(getExtensionId).not.toHaveBeenCalled();
    expect(announceWallet).toHaveBeenCalledWith({
      ...mockProviderInfo,
      extensionId: undefined,
    });
  });

  it('should handle undefined browser', () => {
    (getBuildType as jest.Mock).mockReturnValue('flask');
    (getExtensionId as jest.Mock).mockReturnValue('test-extension-id');
    (detect as jest.Mock).mockReturnValue(undefined);

    announceCaip294WalletData(mockProviderInfo);

    expect(getBuildType).toHaveBeenCalledWith(mockProviderInfo.rdns);
    expect(getExtensionId).toHaveBeenCalledWith('flask');
    expect(announceWallet).toHaveBeenCalledWith({
      ...mockProviderInfo,
      extensionId: 'test-extension-id',
    });
  });
});
