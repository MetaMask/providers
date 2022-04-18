import MockDuplexStream from '../mocks/DuplexStream';
import BaseProvider from './BaseProvider';
import messages from './messages';

const MOCK_ERROR_MESSAGE = 'Did you specify a mock return value?';

function initializeProvider() {
  const mockStream = new MockDuplexStream();
  const provider = new BaseProvider(mockStream);
  (provider as any).mockStream = mockStream;
  (provider as any).autoRefreshOnNetworkChange = false;
  return provider;
}

describe('BaseProvider: RPC', () => {
  // mocking the underlying stream, and testing the basic functionality of
  // .reqest, .sendAsync, and .send
  describe('integration', () => {
    let provider: BaseProvider;
    const mockRpcEngineResponse = jest
      .fn()
      .mockReturnValue([new Error(MOCK_ERROR_MESSAGE), undefined]);

    const setNextRpcEngineResponse = (err: Error | null = null, res = {}) => {
      mockRpcEngineResponse.mockReturnValueOnce([err, res]);
    };

    beforeEach(() => {
      provider = initializeProvider();
      jest
        .spyOn(provider as any, '_handleAccountsChanged')
        .mockImplementation();
      jest
        .spyOn((provider as any)._rpcEngine, 'handle')
        // eslint-disable-next-line node/no-callback-literal
        .mockImplementation((_payload, cb: any) =>
          cb(...mockRpcEngineResponse()),
        );
    });

    it('.request returns result on success', async () => {
      setNextRpcEngineResponse(null, { result: 42 });
      const result = await provider.request({ method: 'foo', params: ['bar'] });
      expect((provider as any)._rpcEngine.handle).toHaveBeenCalledWith(
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

      expect((provider as any)._rpcEngine.handle).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'foo',
          params: ['bar'],
        }),
        expect.any(Function),
      );
    });
  });

  describe('.request', () => {
    let provider: BaseProvider;
    const mockRpcRequestResponse = jest
      .fn()
      .mockReturnValue([new Error(MOCK_ERROR_MESSAGE), undefined]);

    const setNextRpcRequestResponse = (err: any = null, res = {}) => {
      mockRpcRequestResponse.mockReturnValueOnce([err, res]);
    };

    beforeEach(() => {
      provider = initializeProvider();
      jest
        .spyOn(provider as any, '_rpcRequest')
        .mockImplementation(
          (_payload: unknown, cb: any, _isInternal: unknown) =>
            // eslint-disable-next-line node/no-callback-literal
            cb(...mockRpcRequestResponse()),
        );
    });

    it('returns result on success', async () => {
      setNextRpcRequestResponse(null, { result: 42 });
      const result = await provider.request({ method: 'foo', params: ['bar'] });

      expect(result).toBe(42);

      expect((provider as any)._rpcRequest).toHaveBeenCalledWith(
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

      expect((provider as any)._rpcRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'foo',
          params: ['bar'],
        }),
        expect.any(Function),
      );
    });

    it('throws on non-object args', async () => {
      await expect(() => provider.request(undefined as any)).rejects.toThrow(
        messages.errors.invalidRequestArgs(),
      );

      await expect(() => provider.request(null as any)).rejects.toThrow(
        messages.errors.invalidRequestArgs(),
      );

      await expect(() => provider.request([] as any)).rejects.toThrow(
        messages.errors.invalidRequestArgs(),
      );

      await expect(() => provider.request('foo' as any)).rejects.toThrow(
        messages.errors.invalidRequestArgs(),
      );
    });

    it('throws on invalid args.method', async () => {
      await expect(() => provider.request({} as any)).rejects.toThrow(
        messages.errors.invalidRequestMethod(),
      );

      await expect(() =>
        provider.request({ method: null } as any),
      ).rejects.toThrow(messages.errors.invalidRequestMethod());

      await expect(() =>
        provider.request({
          method: 2 as any,
        }),
      ).rejects.toThrow(messages.errors.invalidRequestMethod());

      await expect(() => provider.request({ method: '' })).rejects.toThrow(
        messages.errors.invalidRequestMethod(),
      );
    });

    it('throws on invalid args.params', async () => {
      await expect(() =>
        provider.request({ method: 'foo', params: null } as any),
      ).rejects.toThrow(messages.errors.invalidRequestParams());

      await expect(() =>
        provider.request({ method: 'foo', params: 2 } as any),
      ).rejects.toThrow(messages.errors.invalidRequestParams());

      await expect(() =>
        provider.request({ method: 'foo', params: true } as any),
      ).rejects.toThrow(messages.errors.invalidRequestParams());

      await expect(() =>
        provider.request({ method: 'foo', params: 'a' } as any),
      ).rejects.toThrow(messages.errors.invalidRequestParams());
    });
  });

  // this also tests sendAsync, it being effectively an alias for this method
  describe('._rpcRequest', () => {
    let provider: BaseProvider;
    const mockRpcEngineResponse = jest
      .fn()
      .mockReturnValue([new Error(MOCK_ERROR_MESSAGE), undefined]);

    const setNextRpcEngineResponse = (err: Error | null = null, res = {}) => {
      mockRpcEngineResponse.mockReturnValueOnce([err, res]);
    };

    beforeEach(() => {
      provider = initializeProvider();
      jest
        .spyOn(provider as any, '_handleAccountsChanged')
        .mockImplementation();
      jest
        .spyOn((provider as any)._rpcEngine, 'handle')
        // eslint-disable-next-line node/no-callback-literal
        .mockImplementation((_payload, cb: any) =>
          cb(...mockRpcEngineResponse()),
        );
    });

    it('returns response object on success', async () => {
      setNextRpcEngineResponse(null, { result: 42 });
      await new Promise((done) => {
        (provider as any)._rpcRequest(
          { method: 'foo', params: ['bar'] },
          (err: Error | null, res: any) => {
            expect((provider as any)._rpcEngine.handle).toHaveBeenCalledWith(
              expect.objectContaining({
                method: 'foo',
                params: ['bar'],
              }),
              expect.any(Function),
            );

            expect(err).toBeNull();
            expect(res).toStrictEqual({ result: 42 });
            done(undefined);
          },
        );
      });
    });

    it('returns response object on error', async () => {
      setNextRpcEngineResponse(new Error('foo'), { error: 'foo' });
      await new Promise((done) => {
        (provider as any)._rpcRequest(
          { method: 'foo', params: ['bar'] },
          (err: Error | null, res: any) => {
            expect((provider as any)._rpcEngine.handle).toHaveBeenCalledWith(
              expect.objectContaining({
                method: 'foo',
                params: ['bar'],
              }),
              expect.any(Function),
            );

            expect(err).toStrictEqual(new Error('foo'));
            expect(res).toStrictEqual({ error: 'foo' });
            done(undefined);
          },
        );
      });
    });

    it('calls _handleAccountsChanged on request for eth_accounts', async () => {
      setNextRpcEngineResponse(null, { result: ['0x1'] });
      await new Promise((done) => {
        (provider as any)._rpcRequest(
          { method: 'eth_accounts' },
          (err: Error | null, res: any) => {
            expect((provider as any)._rpcEngine.handle).toHaveBeenCalledWith(
              expect.objectContaining({ method: 'eth_accounts' }),
              expect.any(Function),
            );

            expect(
              (provider as any)._handleAccountsChanged,
            ).toHaveBeenCalledWith(['0x1'], true);

            expect(err).toBeNull();
            expect(res).toStrictEqual({ result: ['0x1'] });
            done(undefined);
          },
        );
      });
    });

    it('calls _handleAccountsChanged with empty array on eth_accounts request returning error', async () => {
      setNextRpcEngineResponse(new Error('foo'), { error: 'foo' });
      await new Promise((done) => {
        (provider as any)._rpcRequest(
          { method: 'eth_accounts' },
          (err: Error | null, res: any) => {
            expect((provider as any)._rpcEngine.handle).toHaveBeenCalledWith(
              expect.objectContaining({ method: 'eth_accounts' }),
              expect.any(Function),
            );

            expect(
              (provider as any)._handleAccountsChanged,
            ).toHaveBeenCalledWith([], true);

            expect(err).toStrictEqual(new Error('foo'));
            expect(res).toStrictEqual({ error: 'foo' });
            done(undefined);
          },
        );
      });
    });
  });

  describe('provider events', () => {
    it('calls chainChanged when the chainId changes', async () => {
      const mockStream = new MockDuplexStream();
      const baseProvider = new BaseProvider(mockStream);
      (baseProvider as any)._state.initialized = true;

      await new Promise((resolve) => {
        baseProvider.once('chainChanged', (newChainId) => {
          expect(newChainId).toBe('0x1');
          resolve(undefined);
        });

        mockStream.push({
          jsonrpc: '2.0',
          method: 'metamask_chainChanged',
          params: { chainId: '0x1', networkVersion: '0x1' },
        });
      });
    });
  });
});
