import { JsonRpcRequest } from 'json-rpc-engine';

import messages from './messages';
import {
  MetaMaskInpageProviderStreamName,
  MetaMaskInpageProvider,
} from './MetaMaskInpageProvider';
import { MockConnectionStream } from '../test/mocks/MockConnectionStream';

/**
 * A fully initialized inpage provider, and additional mocks to help
 * test the provider.
 */
type InitializedProviderDetails = {
  /** The initialized provider, created using a mocked connection stream. */
  provider: MetaMaskInpageProvider;
  /** The mock connection stream used to create the provider. */
  connectionStream: MockConnectionStream;
  /**
   * A mock function that can be used to inspect what gets written to the
   * mock connection Stream.
   */
  onWrite: ReturnType<typeof jest.fn>;
};

/**
 * For legacy purposes, MetaMaskInpageProvider retrieves state from the wallet
 * in its constructor. This operation is asynchronous, and initiated via
 * {@link MetaMaskInpageProvider._initializeStateAsync}. This helper function
 * returns a provider initialized with the specified values.
 *
 * The mock connection stream used to create the provider is also returned.
 * This stream is setup initially just to respond to the
 * `metamask_getProviderState` method. Further responses can be setup via the
 * `onMethodCalled` configuration, or sent using the connection stream
 * directly.
 *
 * @param options - Options bag.
 * @param options.initialState - The initial provider state returned on
 * initialization.  See {@link MetaMaskInpageProvider._initializeState}.
 * @param options.onMethodCalled - A set of configuration objects for adding
 * method-specific callbacks.
 * @returns The initialized provider, its stream, and an "onWrite" stub that
 * can be used to inspect message sent by the provider.
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
  initialState?: Partial<
    Parameters<MetaMaskInpageProvider['_initializeState']>[0]
  >;
  onMethodCalled?: {
    substream: string;
    method: string;
    callback: (data: JsonRpcRequest<unknown>) => void;
  }[];
} = {}): Promise<InitializedProviderDetails> {
  const onWrite = jest.fn();
  const connectionStream = new MockConnectionStream((name, data) => {
    if (
      name === 'metamask-provider' &&
      data.method === 'metamask_getProviderState'
    ) {
      // Wrap in `setImmediate` to ensure a reply is recieved by the provider
      // after the provider has processed the request, to ensure that the
      // provider recognizes the id.
      setImmediate(() =>
        connectionStream.reply('metamask-provider', {
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

  const provider = new MetaMaskInpageProvider(connectionStream);
  await new Promise<void>((resolve: () => void) => {
    provider.on('_initialized', resolve);
  });

  return { provider, connectionStream, onWrite };
}

describe('MetaMaskInpageProvider: RPC', () => {
  const MOCK_ERROR_MESSAGE = 'Did you specify a mock return value?';

  /**
   * Creates a new MetaMaskInpageProvider instance, with a mocked connection
   * stream.
   *
   * @returns The new MetaMaskInpageProvider instance.
   */
  function initializeProvider() {
    const mockStream = new MockConnectionStream();
    const provider: any | MetaMaskInpageProvider = new MetaMaskInpageProvider(
      mockStream,
    );
    provider.mockStream = mockStream;
    provider.autoRefreshOnNetworkChange = false;
    return provider;
  }

  // mocking the underlying stream, and testing the basic functionality of
  // .reqest, .sendAsync, and .send
  describe('integration', () => {
    let provider: any | MetaMaskInpageProvider;
    const mockRpcEngineResponse = jest
      .fn()
      .mockReturnValue([new Error(MOCK_ERROR_MESSAGE), undefined]);

    const setNextRpcEngineResponse = (
      error: Error | null = null,
      response = {},
    ) => {
      mockRpcEngineResponse.mockReturnValueOnce([error, response]);
    };

    beforeEach(() => {
      provider = initializeProvider();
      jest.spyOn(provider, '_handleAccountsChanged').mockImplementation();
      jest
        .spyOn(provider._rpcEngine, 'handle')
        .mockImplementation((_payload, callback: any) =>
          // eslint-disable-next-line node/no-callback-literal
          callback(...mockRpcEngineResponse()),
        );
    });

    it('.request returns result on success', async () => {
      setNextRpcEngineResponse(null, { result: 42 });
      const result = await provider.request({ method: 'foo', params: ['bar'] });
      expect(provider._rpcEngine.handle).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'foo',
          params: ['bar'],
        }),
        expect.any(Function),
      );

      expect(result).toBe(42);
    });

    it('.request throws on error', async () => {
      setNextRpcEngineResponse(new Error('foo'));

      await expect(
        provider.request({ method: 'foo', params: ['bar'] }),
      ).rejects.toThrow('foo');

      expect(provider._rpcEngine.handle).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'foo',
          params: ['bar'],
        }),
        expect.any(Function),
      );
    });

    it('.sendAsync returns response object on success', async () => {
      setNextRpcEngineResponse(null, { result: 42 });
      await new Promise((done) => {
        provider.sendAsync(
          { method: 'foo', params: ['bar'] },
          (error: Error | null, response: any) => {
            expect(provider._rpcEngine.handle).toHaveBeenCalledWith(
              expect.objectContaining({
                method: 'foo',
                params: ['bar'],
              }),
              expect.any(Function),
            );

            expect(error).toBeNull();
            expect(response).toStrictEqual({ result: 42 });
            done(undefined);
          },
        );
      });
    });

    it('.sendAsync batch request response on success', async () => {
      setNextRpcEngineResponse(null, [
        { result: 42 },
        { result: 41 },
        { result: 40 },
      ]);
      await new Promise((done) => {
        provider.sendAsync(
          [
            { method: 'foo', params: ['bar'] },
            { method: 'bar', params: ['baz'] },
            { method: 'baz', params: ['buzz'] },
          ],
          (error: Error | null, response: any) => {
            expect(provider._rpcEngine.handle).toHaveBeenCalledWith(
              expect.arrayContaining([
                { method: 'foo', params: ['bar'] },
                { method: 'bar', params: ['baz'] },
                { method: 'baz', params: ['buzz'] },
              ]),
              expect.any(Function),
            );

            expect(error).toBeNull();
            expect(response).toStrictEqual([
              { result: 42 },
              { result: 41 },
              { result: 40 },
            ]);
            done(undefined);
          },
        );
      });
    });

    it('.sendAsync returns response object on error', async () => {
      setNextRpcEngineResponse(new Error('foo'), { error: 'foo' });
      await new Promise((done) => {
        provider.sendAsync(
          { method: 'foo', params: ['bar'] },
          (error: Error | null, response: any) => {
            expect(provider._rpcEngine.handle).toHaveBeenCalledWith(
              expect.objectContaining({
                method: 'foo',
                params: ['bar'],
              }),
              expect.any(Function),
            );

            expect(error).toStrictEqual(new Error('foo'));
            expect(response).toStrictEqual({ error: 'foo' });
            done(undefined);
          },
        );
      });
    });

    it('.send promise signature returns response object on success', async () => {
      setNextRpcEngineResponse(null, { result: 42 });
      const result = await provider.send('foo', ['bar']);
      expect(provider._rpcEngine.handle).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'foo',
          params: ['bar'],
        }),
        expect.any(Function),
      );

      expect(result).toStrictEqual({ result: 42 });
    });

    it('.send promise signature throws on error', async () => {
      setNextRpcEngineResponse(new Error('foo'));

      await expect(provider.send('foo', ['bar'])).rejects.toThrow('foo');

      expect(provider._rpcEngine.handle).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'foo',
          params: ['bar'],
        }),
        expect.any(Function),
      );
    });

    it('.send callback signature returns response object on success', async () => {
      setNextRpcEngineResponse(null, { result: 42 });
      await new Promise((done) => {
        provider.send(
          { method: 'foo', params: ['bar'] },
          (error: any, response: any) => {
            expect(provider._rpcEngine.handle).toHaveBeenCalledWith(
              expect.objectContaining({
                method: 'foo',
                params: ['bar'],
              }),
              expect.any(Function),
            );

            expect(error).toBeNull();
            expect(response).toStrictEqual({ result: 42 });
            done(undefined);
          },
        );
      });
    });

    it('.send callback signature returns response object on error', async () => {
      setNextRpcEngineResponse(new Error('foo'), { error: 'foo' });
      await new Promise((done) => {
        provider.send(
          { method: 'foo', params: ['bar'] },
          (error: any, response: any) => {
            expect(provider._rpcEngine.handle).toHaveBeenCalledWith(
              expect.objectContaining({
                method: 'foo',
                params: ['bar'],
              }),
              expect.any(Function),
            );

            expect(error).toStrictEqual(new Error('foo'));
            expect(response).toStrictEqual({ error: 'foo' });
            done(undefined);
          },
        );
      });
    });
  });

  describe('.request', () => {
    let provider: any;
    const mockRpcRequestResponse = jest
      .fn()
      .mockReturnValue([new Error(MOCK_ERROR_MESSAGE), undefined]);

    const setNextRpcRequestResponse = (
      error: Error | null = null,
      response = {},
    ) => {
      mockRpcRequestResponse.mockReturnValueOnce([error, response]);
    };

    beforeEach(() => {
      provider = initializeProvider();
      jest
        .spyOn(provider, '_rpcRequest')
        .mockImplementation((_payload, callback: any, _isInternal) =>
          // eslint-disable-next-line node/no-callback-literal
          callback(...mockRpcRequestResponse()),
        );
    });

    it('returns result on success', async () => {
      setNextRpcRequestResponse(null, { result: 42 });
      const result = await provider.request({ method: 'foo', params: ['bar'] });

      expect(result).toBe(42);

      expect(provider._rpcRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'foo',
          params: ['bar'],
        }),
        expect.any(Function),
      );
    });

    it('throws on error', async () => {
      setNextRpcRequestResponse(new Error('foo'));

      await expect(
        provider.request({ method: 'foo', params: ['bar'] }),
      ).rejects.toThrow('foo');

      expect(provider._rpcRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'foo',
          params: ['bar'],
        }),
        expect.any(Function),
      );
    });

    it('throws on non-object args', async () => {
      await expect(() => provider.request()).rejects.toThrow(
        messages.errors.invalidRequestArgs(),
      );

      await expect(() => provider.request(null)).rejects.toThrow(
        messages.errors.invalidRequestArgs(),
      );

      await expect(() => provider.request([])).rejects.toThrow(
        messages.errors.invalidRequestArgs(),
      );

      await expect(() => provider.request('foo')).rejects.toThrow(
        messages.errors.invalidRequestArgs(),
      );
    });

    it('throws on invalid args.method', async () => {
      await expect(() => provider.request({})).rejects.toThrow(
        messages.errors.invalidRequestMethod(),
      );

      await expect(() => provider.request({ method: null })).rejects.toThrow(
        messages.errors.invalidRequestMethod(),
      );

      await expect(() => provider.request({ method: 2 })).rejects.toThrow(
        messages.errors.invalidRequestMethod(),
      );

      await expect(() => provider.request({ method: '' })).rejects.toThrow(
        messages.errors.invalidRequestMethod(),
      );
    });

    it('throws on invalid args.params', async () => {
      await expect(() =>
        provider.request({ method: 'foo', params: null }),
      ).rejects.toThrow(messages.errors.invalidRequestParams());

      await expect(() =>
        provider.request({ method: 'foo', params: 2 }),
      ).rejects.toThrow(messages.errors.invalidRequestParams());

      await expect(() =>
        provider.request({ method: 'foo', params: true }),
      ).rejects.toThrow(messages.errors.invalidRequestParams());

      await expect(() =>
        provider.request({ method: 'foo', params: 'a' }),
      ).rejects.toThrow(messages.errors.invalidRequestParams());
    });
  });

  // this also tests sendAsync, it being effectively an alias for this method
  describe('._rpcRequest', () => {
    let provider: any | MetaMaskInpageProvider;
    const mockRpcEngineResponse = jest
      .fn()
      .mockReturnValue([new Error(MOCK_ERROR_MESSAGE), undefined]);

    const setNextRpcEngineResponse = (
      error: Error | null = null,
      response = {},
    ) => {
      mockRpcEngineResponse.mockReturnValueOnce([error, response]);
    };

    beforeEach(() => {
      provider = initializeProvider();
      jest.spyOn(provider, '_handleAccountsChanged').mockImplementation();
      jest
        .spyOn(provider._rpcEngine, 'handle')
        .mockImplementation((_payload, callback: any) =>
          // eslint-disable-next-line node/no-callback-literal
          callback(...mockRpcEngineResponse()),
        );
    });

    it('returns response object on success', async () => {
      setNextRpcEngineResponse(null, { result: 42 });
      await new Promise((done) => {
        provider._rpcRequest(
          { method: 'foo', params: ['bar'] },
          (error: any, response: any) => {
            expect(provider._rpcEngine.handle).toHaveBeenCalledWith(
              expect.objectContaining({
                method: 'foo',
                params: ['bar'],
              }),
              expect.any(Function),
            );

            expect(error).toBeNull();
            expect(response).toStrictEqual({ result: 42 });
            done(undefined);
          },
        );
      });
    });

    it('returns response object on error', async () => {
      setNextRpcEngineResponse(new Error('foo'), { error: 'foo' });
      await new Promise((done) => {
        provider._rpcRequest(
          { method: 'foo', params: ['bar'] },
          (error: any, response: any) => {
            expect(provider._rpcEngine.handle).toHaveBeenCalledWith(
              expect.objectContaining({
                method: 'foo',
                params: ['bar'],
              }),
              expect.any(Function),
            );

            expect(error).toStrictEqual(new Error('foo'));
            expect(response).toStrictEqual({ error: 'foo' });
            done(undefined);
          },
        );
      });
    });

    it('calls _handleAccountsChanged on request for eth_accounts', async () => {
      setNextRpcEngineResponse(null, { result: ['0x1'] });
      await new Promise((done) => {
        provider._rpcRequest(
          { method: 'eth_accounts' },
          (error: any, response: any) => {
            expect(provider._rpcEngine.handle).toHaveBeenCalledWith(
              expect.objectContaining({ method: 'eth_accounts' }),
              expect.any(Function),
            );

            expect(provider._handleAccountsChanged).toHaveBeenCalledWith(
              ['0x1'],
              true,
            );

            expect(error).toBeNull();
            expect(response).toStrictEqual({ result: ['0x1'] });
            done(undefined);
          },
        );
      });
    });

    it('calls _handleAccountsChanged with empty array on eth_accounts request returning error', async () => {
      setNextRpcEngineResponse(new Error('foo'), { error: 'foo' });
      await new Promise((done) => {
        provider._rpcRequest(
          { method: 'eth_accounts' },
          (error: any, response: any) => {
            expect(provider._rpcEngine.handle).toHaveBeenCalledWith(
              expect.objectContaining({ method: 'eth_accounts' }),
              expect.any(Function),
            );

            expect(provider._handleAccountsChanged).toHaveBeenCalledWith(
              [],
              true,
            );

            expect(error).toStrictEqual(new Error('foo'));
            expect(response).toStrictEqual({ error: 'foo' });
            done(undefined);
          },
        );
      });
    });
  });

  describe('.send', () => {
    let provider: any | MetaMaskInpageProvider;
    const mockRpcRequestResponse = jest
      .fn()
      .mockReturnValue([new Error(MOCK_ERROR_MESSAGE), undefined]);

    const setNextRpcRequestResponse = (
      error: Error | null = null,
      response = {},
    ) => {
      mockRpcRequestResponse.mockReturnValueOnce([error, response]);
    };

    beforeEach(() => {
      provider = initializeProvider();
      jest
        .spyOn(provider, '_rpcRequest')
        .mockImplementation((_payload, callback: any, _isInternal) =>
          // eslint-disable-next-line node/no-callback-literal
          callback(...mockRpcRequestResponse()),
        );
    });

    it('promise signature returns response object on success', async () => {
      setNextRpcRequestResponse(null, { result: 42 });
      const result = await provider.send('foo', ['bar']);
      expect(provider._rpcRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'foo',
          params: ['bar'],
        }),
        expect.any(Function),
      );

      expect(result).toStrictEqual({ result: 42 });
    });

    it('promise signature returns response object on success (no params)', async () => {
      setNextRpcRequestResponse(null, { result: 42 });
      const result = await provider.send('foo');
      expect(provider._rpcRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'foo',
        }),
        expect.any(Function),
      );

      expect(result).toStrictEqual({ result: 42 });
    });

    it('promise signature throws on RPC error', async () => {
      setNextRpcRequestResponse(new Error('foo'));

      await expect(provider.send('foo', ['bar'])).rejects.toThrow('foo');

      expect(provider._rpcRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'foo',
          params: ['bar'],
        }),
        expect.any(Function),
      );
    });

    it('promise signature throws on error from ._rpcRequest', async () => {
      provider._rpcRequest.mockImplementation(() => {
        throw new Error('foo');
      });

      await expect(provider.send('foo', ['bar'])).rejects.toThrow('foo');

      expect(provider._rpcRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'foo',
          params: ['bar'],
        }),
        expect.any(Function),
      );
    });

    it('callback signature returns response object on success', async () => {
      setNextRpcRequestResponse(null, { result: 42 });
      await new Promise((done) => {
        provider.send(
          { method: 'foo', params: ['bar'] },
          (error: Error | null, response: any) => {
            expect(provider._rpcRequest).toHaveBeenCalledWith(
              expect.objectContaining({
                method: 'foo',
                params: ['bar'],
              }),
              expect.any(Function),
            );

            expect(error).toBeNull();
            expect(response).toStrictEqual({ result: 42 });
            done(undefined);
          },
        );
      });
    });

    it('callback signature returns response object on error', async () => {
      setNextRpcRequestResponse(new Error('foo'), { error: 'foo' });
      await new Promise((done) => {
        provider.send(
          { method: 'foo', params: ['bar'] },
          (error: Error | null, response: any) => {
            expect(provider._rpcRequest).toHaveBeenCalledWith(
              expect.objectContaining({
                method: 'foo',
                params: ['bar'],
              }),
              expect.any(Function),
            );

            expect(error).toStrictEqual(new Error('foo'));
            expect(response).toStrictEqual({ error: 'foo' });
            done(undefined);
          },
        );
      });
    });

    describe('object-only signature handles "synchronous" RPC methods', () => {
      it('eth_accounts', () => {
        const result = provider.send({ method: 'eth_accounts' });
        expect(result).toMatchObject({
          result: [],
        });
      });

      it('eth_coinbase', () => {
        const result = provider.send({ method: 'eth_coinbase' });
        expect(result).toMatchObject({
          result: null,
        });
      });

      it('eth_uninstallFilter', () => {
        setNextRpcRequestResponse(null, { result: true });
        const result = provider.send({
          method: 'eth_uninstallFilter',
          params: ['bar'],
        });

        expect(result).toMatchObject({
          result: true,
        });
        expect(provider._rpcRequest).toHaveBeenCalledWith(
          expect.objectContaining({
            method: 'eth_uninstallFilter',
            params: ['bar'],
          }),
          expect.any(Function),
        );
      });

      it('net_version', () => {
        const result = provider.send({ method: 'net_version' });
        expect(result).toMatchObject({
          result: null,
        });
      });
    });

    it('throws on unsupported sync method', () => {
      expect(() => provider.send({ method: 'foo', params: ['bar'] })).toThrow(
        // eslint-disable-next-line node/no-sync
        messages.errors.unsupportedSync('foo'),
      );

      expect(() => provider.send({ method: 'foo' })).toThrow(
        // eslint-disable-next-line node/no-sync
        messages.errors.unsupportedSync('foo'),
      );
    });
  });

  describe('provider events', () => {
    it('calls chainChanged when receiving a new chainId', async () => {
      const { provider, connectionStream } = await getInitializedProvider();

      await new Promise((resolve) => {
        provider.once('chainChanged', (newChainId) => {
          expect(newChainId).toBe('0x1');
          resolve(undefined);
        });

        connectionStream.notify(MetaMaskInpageProviderStreamName, {
          jsonrpc: '2.0',
          method: 'metamask_chainChanged',
          params: { chainId: '0x1', networkVersion: '1' },
        });
      });
    });

    it('calls networkChanged when receiving a new networkVersion', async () => {
      const { provider, connectionStream } = await getInitializedProvider();

      await new Promise((resolve) => {
        provider.once('networkChanged', (newNetworkId) => {
          expect(newNetworkId).toBe('1');
          resolve(undefined);
        });

        connectionStream.notify(MetaMaskInpageProviderStreamName, {
          jsonrpc: '2.0',
          method: 'metamask_chainChanged',
          params: { chainId: '0x1', networkVersion: '1' },
        });
      });
    });

    it('handles chain changes with intermittent disconnection', async () => {
      const { provider, connectionStream } = await getInitializedProvider();

      // We check this mostly for the readability of this test.
      expect(provider.isConnected()).toBe(true);
      expect(provider.chainId).toBe('0x0');
      expect(provider.networkVersion).toBe('0');

      const emitSpy = jest.spyOn(provider, 'emit');

      await new Promise<void>((resolve) => {
        provider.once('disconnect', (error) => {
          expect((error as any).code).toBe(1013);
          resolve();
        });

        connectionStream.notify(MetaMaskInpageProviderStreamName, {
          jsonrpc: '2.0',
          method: 'metamask_chainChanged',
          // A "loading" networkVersion indicates the network is changing.
          // Although the chainId is different, chainChanged should not be
          // emitted in this case.
          params: { chainId: '0x1', networkVersion: 'loading' },
        });
      });

      // Only once, for "disconnect".
      expect(emitSpy).toHaveBeenCalledTimes(1);
      emitSpy.mockClear(); // Clear the mock to avoid keeping a count.

      expect(provider.isConnected()).toBe(false);
      // These should be unchanged.
      expect(provider.chainId).toBe('0x0');
      expect(provider.networkVersion).toBe('0');

      await new Promise<void>((resolve) => {
        provider.once('chainChanged', (newChainId) => {
          expect(newChainId).toBe('0x1');
          resolve();
        });

        connectionStream.notify(MetaMaskInpageProviderStreamName, {
          jsonrpc: '2.0',
          method: 'metamask_chainChanged',
          params: { chainId: '0x1', networkVersion: '1' },
        });
      });

      expect(emitSpy).toHaveBeenCalledTimes(3);
      expect(emitSpy).toHaveBeenNthCalledWith(1, 'connect', { chainId: '0x1' });
      expect(emitSpy).toHaveBeenCalledWith('chainChanged', '0x1');
      expect(emitSpy).toHaveBeenCalledWith('networkChanged', '1');

      expect(provider.isConnected()).toBe(true);
      expect(provider.chainId).toBe('0x1');
      expect(provider.networkVersion).toBe('1');
    });
  });

  describe('warnings', () => {
    describe('rpc methods', () => {
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
            const { provider, connectionStream } = await getInitializedProvider(
              {
                onMethodCalled: [
                  {
                    substream: 'metamask-provider',
                    method,
                    callback: ({ id }) => {
                      connectionStream.reply('metamask-provider', {
                        id,
                        jsonrpc: '2.0',
                        result: null,
                      });
                    },
                  },
                ],
              },
            );

            await provider.request({ method });

            expect(consoleWarnSpy).toHaveBeenCalledWith(warning);
            expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
          });

          it('should not warn the second time the method is called', async () => {
            const { provider, connectionStream } = await getInitializedProvider(
              {
                onMethodCalled: [
                  {
                    substream: 'metamask-provider',
                    method,
                    callback: ({ id }) => {
                      connectionStream.reply('metamask-provider', {
                        id,
                        jsonrpc: '2.0',
                        result: null,
                      });
                    },
                  },
                ],
              },
            );
            const consoleWarnSpy = jest.spyOn(globalThis.console, 'warn');

            await provider.request({ method });
            await provider.request({ method });

            expect(consoleWarnSpy).toHaveBeenCalledWith(warning);
            expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
          });

          it('should allow the method to succeed', async () => {
            const { provider, connectionStream } = await getInitializedProvider(
              {
                onMethodCalled: [
                  {
                    substream: 'metamask-provider',
                    method,
                    callback: ({ id }) => {
                      connectionStream.reply('metamask-provider', {
                        id,
                        jsonrpc: '2.0',
                        result: 'success!',
                      });
                    },
                  },
                ],
              },
            );

            const response = await provider.request({ method });
            expect(response).toBe('success!');
          });

          it('should allow the method to fail', async () => {
            const { provider, connectionStream } = await getInitializedProvider(
              {
                onMethodCalled: [
                  {
                    substream: 'metamask-provider',
                    method,
                    callback: ({ id }) => {
                      connectionStream.reply('metamask-provider', {
                        id,
                        jsonrpc: '2.0',
                        error: { code: 0, message: 'failure!' },
                      });
                    },
                  },
                ],
              },
            );

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
});

describe('MetaMaskInpageProvider: Miscellanea', () => {
  describe('constructor', () => {
    it('succeeds if stream is provided', () => {
      expect(
        () => new MetaMaskInpageProvider(new MockConnectionStream()),
      ).not.toThrow();
    });

    it('succeeds if stream and valid options are provided', () => {
      const stream = new MockConnectionStream();

      expect(
        () =>
          new MetaMaskInpageProvider(stream, {
            maxEventListeners: 10,
          }),
      ).not.toThrow();

      expect(
        () =>
          new MetaMaskInpageProvider(stream, {
            shouldSendMetadata: false,
          }),
      ).not.toThrow();

      expect(
        () =>
          new MetaMaskInpageProvider(stream, {
            maxEventListeners: 10,
            shouldSendMetadata: false,
          }),
      ).not.toThrow();
    });

    it('throws if no or invalid stream is provided', () => {
      expect(() => new MetaMaskInpageProvider(undefined as any)).toThrow(
        messages.errors.invalidDuplexStream(),
      );

      expect(() => new MetaMaskInpageProvider('foo' as any)).toThrow(
        messages.errors.invalidDuplexStream(),
      );

      expect(() => new MetaMaskInpageProvider({} as any)).toThrow(
        messages.errors.invalidDuplexStream(),
      );
    });

    it('accepts valid custom logger', () => {
      const stream = new MockConnectionStream();
      const customLogger = {
        debug: console.debug,
        error: console.error,
        info: console.info,
        log: console.log,
        trace: console.trace,
        warn: console.warn,
      };

      expect(
        () =>
          new MetaMaskInpageProvider(stream, {
            logger: customLogger,
          }),
      ).not.toThrow();
    });

    it('gets initial state', async () => {
      // This will be called via the constructor
      const requestMock = jest
        .spyOn(MetaMaskInpageProvider.prototype, 'request')
        .mockImplementationOnce(async () => {
          return {
            accounts: ['0xabc'],
            chainId: '0x0',
            isUnlocked: true,
            networkVersion: '0',
          };
        });

      const mockStream = new MockConnectionStream();
      const inpageProvider = new MetaMaskInpageProvider(mockStream);

      await new Promise<void>((resolve) => setTimeout(() => resolve(), 1));
      expect(requestMock).toHaveBeenCalledTimes(1);
      expect(inpageProvider.chainId).toBe('0x0');
      expect(inpageProvider.networkVersion).toBe('0');
      expect(inpageProvider.selectedAddress).toBe('0xabc');
      expect(inpageProvider.isConnected()).toBe(true);
    });
  });

  describe('isConnected', () => {
    it('returns isConnected state', () => {
      const provider: any = new MetaMaskInpageProvider(
        new MockConnectionStream(),
      );
      provider.autoRefreshOnNetworkChange = false;

      expect(provider.isConnected()).toBe(false);

      provider._state.isConnected = true;

      expect(provider.isConnected()).toBe(true);

      provider._state.isConnected = false;

      expect(provider.isConnected()).toBe(false);
    });
  });

  describe('isMetaMask', () => {
    it('should be set to "true"', async () => {
      const { provider } = await getInitializedProvider();

      expect(provider.isMetaMask).toBe(true);
    });
  });
});
