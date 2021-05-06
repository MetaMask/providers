import createExternalExtensionProvider from './extension-provider/createExternalExtensionProvider';
import BaseProvider from './BaseProvider';

describe('createExternalExtensionProvider', () => {
  beforeAll(() => {
    (global.chrome.runtime.connect as any).mockImplementation(() => {
      return {
        onMessage: {
          addListener: jest.fn(),
        },
        onDisconnect: {
          addListener: jest.fn(),
        },
        postMessage: jest.fn(),
      };
    });
  });
  afterAll(() => {
    jest.restoreAllMocks();
  });
  it('can be called and not throw', () => {
    expect(() => createExternalExtensionProvider()).not.toThrow();
  });
  it('calls connect', () => {
    createExternalExtensionProvider();
    expect(global.chrome.runtime.connect).toHaveBeenCalled();
  });
  it('returns a MetaMaskInpageProvider', () => {
    const results = createExternalExtensionProvider();
    expect(results).toBeInstanceOf(BaseProvider);
  });
});
