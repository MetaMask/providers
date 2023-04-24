import type { JsonRpcRequest } from 'json-rpc-engine';

import { createExternalExtensionProvider } from './createExternalExtensionProvider';
import config from './external-extension-config.json';
import { MockPort } from '../../test/mocks/MockPort';
import type { BaseProvider } from '../BaseProvider';
import messages from '../messages';
import { StreamProvider } from '../StreamProvider';

/**
 * A fully initialized extension provider, and additional mocks to help
 * test the provider.
 */
type InitializedExtensionProviderDetails = {
  /** The initialized provider, created using a mocked Port instance. */
  provider: StreamProvider;
  /** The mock Port instance used to create the provider. */
  port: MockPort;
  /**
   * A mock function that can be used to inspect what gets written to the
   * mock connection Stream.
   */
  onWrite: ReturnType<typeof jest.fn>;
};

/**
 * The `createExternalExtensionProvider` function initializes the wallet state
 * asynchronously without blocking on it. This helper function
 * returns a provider initialized with the specified values.
 *
 * @param options - Options bag.
 * @param options.initialState - The initial provider state returned on
 * initialization.  See {@link MetaMaskInpageProvider._initializeState}.
 * @param options.onMethodCalled - A set of configuration objects for adding
 * method-specific callbacks.
 * @returns A tuple of the initialized provider, the mock port used, and an
 * "onWrite" stub that can be used to inspect message sent by the provider.
 */
async function getInitializedProvider({
  initialState: {
    accounts = [],
    chainId = '0x0',
    isUnlocked = true,
    networkVersion = '0',
  } = {},
  onMethodCalled = [],
}: {
  initialState?: Partial<Parameters<BaseProvider['_initializeState']>[0]>;
  onMethodCalled?: {
    substream: string;
    method: string;
    callback: (data: JsonRpcRequest<unknown>) => void;
  }[];
} = {}): Promise<InitializedExtensionProviderDetails> {
  const onWrite = jest.fn();
  const port = new MockPort((name, data) => {
    if (
      name === 'metamask-provider' &&
      data.method === 'metamask_getProviderState'
    ) {
      // Wrap in `setImmediate` to ensure a reply is recieved by the provider
      // after the provider has processed the request, to ensure that the
      // provider recognizes the id.
      setImmediate(() =>
        port.reply('metamask-provider', {
          id: onWrite.mock.calls[0][1].id,
          jsonrpc: '2.0',
          result: {
            accounts,
            chainId,
            isUnlocked,
            networkVersion,
          },
        }),
      );
    }
    for (const { substream, method, callback } of onMethodCalled) {
      if (name === substream && data.method === method) {
        // Wrap in `setImmediate` to ensure a reply is recieved by the provider
        // after the provider has processed the request, to ensure that the
        // provider recognizes the id.
        setImmediate(() => callback(data));
      }
    }
    onWrite(name, data);
  });
  // `global.chrome.runtime` mock setup by `jest-chrome` in `jest.setup.js`
  (global.chrome.runtime.connect as any).mockImplementation(() => {
    return port;
  });

  const provider = createExternalExtensionProvider();
  await new Promise<void>((resolve: () => void) => {
    provider.on('_initialized', resolve);
  });

  return { provider, port, onWrite };
}

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

  it('supports Flask', () => {
    // `global.chrome.runtime` mock setup by `jest-chrome` in `jest.setup.js`
    (global.chrome.runtime.connect as any).mockImplementation(() => {
      return new MockPort();
    });
    const results = createExternalExtensionProvider('flask');
    expect(results).toBeInstanceOf(StreamProvider);
    expect(global.chrome.runtime.connect).toHaveBeenCalledWith(
      config.chromeIds.flask,
    );
  });

  it('supports Beta', () => {
    // `global.chrome.runtime` mock setup by `jest-chrome` in `jest.setup.js`
    (global.chrome.runtime.connect as any).mockImplementation(() => {
      return new MockPort();
    });
    const results = createExternalExtensionProvider('beta');
    expect(results).toBeInstanceOf(StreamProvider);
    expect(global.chrome.runtime.connect).toHaveBeenCalledWith(
      config.chromeIds.beta,
    );
  });

  it('supports custom extension ID', () => {
    // `global.chrome.runtime` mock setup by `jest-chrome` in `jest.setup.js`
    (global.chrome.runtime.connect as any).mockImplementation(() => {
      return new MockPort();
    });
    const results = createExternalExtensionProvider('foobar');
    expect(results).toBeInstanceOf(StreamProvider);
    expect(global.chrome.runtime.connect).toHaveBeenCalledWith('foobar');
  });

  describe('RPC warnings', () => {
    const warnings = [
      {
        method: 'eth_decrypt',
        warning: messages.warnings.rpc.ethDecryptDeprecation,
      },
      {
        method: 'eth_getEncryptionPublicKey',
        warning: messages.warnings.rpc.ethGetEncryptionPublicKeyDeprecation,
      },
    ];

    for (const { method, warning } of warnings) {
      describe(`${method}`, () => {
        it('should warn the first time the method is called', async () => {
          const consoleWarnSpy = jest.spyOn(globalThis.console, 'warn');
          const { provider, port } = await getInitializedProvider({
            onMethodCalled: [
              {
                substream: 'metamask-provider',
                method,
                callback: ({ id }) => {
                  port.reply('metamask-provider', {
                    id,
                    jsonrpc: '2.0',
                    result: null,
                  });
                },
              },
            ],
          });

          await provider.request({ method });

          expect(consoleWarnSpy).toHaveBeenCalledWith(warning);
          expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
        });

        it('should not warn the second time the method is called', async () => {
          const { provider, port } = await getInitializedProvider({
            onMethodCalled: [
              {
                substream: 'metamask-provider',
                method,
                callback: ({ id }) => {
                  port.reply('metamask-provider', {
                    id,
                    jsonrpc: '2.0',
                    result: null,
                  });
                },
              },
            ],
          });
          const consoleWarnSpy = jest.spyOn(globalThis.console, 'warn');

          await provider.request({ method });
          await provider.request({ method });

          expect(consoleWarnSpy).toHaveBeenCalledWith(warning);
          expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
        });

        it('should allow the method to succeed', async () => {
          const { provider, port } = await getInitializedProvider({
            onMethodCalled: [
              {
                substream: 'metamask-provider',
                method,
                callback: ({ id }) => {
                  port.reply('metamask-provider', {
                    id,
                    jsonrpc: '2.0',
                    result: 'success!',
                  });
                },
              },
            ],
          });

          const response = await provider.request({ method });

          expect(response).toBe('success!');
        });

        it('should allow the method to fail', async () => {
          const { provider, port } = await getInitializedProvider({
            onMethodCalled: [
              {
                substream: 'metamask-provider',
                method,
                callback: ({ id }) => {
                  port.reply('metamask-provider', {
                    id,
                    jsonrpc: '2.0',
                    error: { code: 0, message: 'failure!' },
                  });
                },
              },
            ],
          });

          await expect(async () =>
            provider.request({ method }),
          ).rejects.toMatchObject({
            code: 0,
            message: 'failure!',
          });
        });
      });
    }
  });
});
