import { StreamProvider } from '../StreamProvider';
import { createExternalExtensionProvider } from './createExternalExtensionProvider';

describe('createExternalExtensionProvider', () => {
  beforeEach(() => {
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

  it('can be called and not throw', () => {
    expect(() => createExternalExtensionProvider()).not.toThrow();
  });

  it('calls connect', () => {
    createExternalExtensionProvider();
    expect(global.chrome.runtime.connect).toHaveBeenCalled();
  });

  it('returns a MetaMaskInpageProvider', () => {
    const results = createExternalExtensionProvider();
    expect(results).toBeInstanceOf(StreamProvider);
  });
});
