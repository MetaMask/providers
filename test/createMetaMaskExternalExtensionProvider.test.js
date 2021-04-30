const {
  createMetaMaskExternalExtensionProvider,
  MetaMaskInpageProvider,
} = require('../dist');

describe('createMetaMaskExternalExtensionProvider', () => {
  beforeAll(() => {
    global.chrome.runtime.connect.mockImplementation(() => {
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
    expect(() => createMetaMaskExternalExtensionProvider()).not.toThrow();
  });
  it('calls connect', () => {
    createMetaMaskExternalExtensionProvider();
    expect(global.chrome.runtime.connect).toHaveBeenCalled();
  });
  it('returns a MetaMaskInpageProvider', () => {
    const results = createMetaMaskExternalExtensionProvider();
    expect(results).toBeInstanceOf(MetaMaskInpageProvider);
  });
});
