import { StreamProvider } from '../StreamProvider';
import { MockPort } from '../../test/mocks/MockPort';
import { createExternalExtensionProvider } from './createExternalExtensionProvider';

describe('createExternalExtensionProvider', () => {
  it('can be called and not throw', () => {
    // `global.chrome.runtime` mock setup by `jest-chrome` in `jest.setup.js`
    (global.chrome.runtime.connect as any).mockImplementation(() => {
      return new MockPort();
    });
    expect(() => createExternalExtensionProvider()).not.toThrow();
  });

  it('calls connect', () => {
    // `global.chrome.runtime` mock setup by `jest-chrome` in `jest.setup.js`
    (global.chrome.runtime.connect as any).mockImplementation(() => {
      return new MockPort();
    });
    createExternalExtensionProvider();
    expect(global.chrome.runtime.connect).toHaveBeenCalled();
  });

  it('returns a stream provider', () => {
    // `global.chrome.runtime` mock setup by `jest-chrome` in `jest.setup.js`
    (global.chrome.runtime.connect as any).mockImplementation(() => {
      return new MockPort();
    });
    const results = createExternalExtensionProvider();
    expect(results).toBeInstanceOf(StreamProvider);
  });
});
