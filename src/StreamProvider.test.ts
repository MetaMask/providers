import type { JsonRpcMiddleware } from '@metamask/json-rpc-engine';
import ObjectMultiplex from '@metamask/object-multiplex';
import { JsonRpcError } from '@metamask/rpc-errors';
import type { Json, JsonRpcParams } from '@metamask/utils';
import { pipeline } from 'readable-stream';

import messages from './messages';
import { StreamProvider } from './StreamProvider';
import { MockConnectionStream } from '../test/mocks/MockConnectionStream';

const mockErrorMessage = 'Did you specify a mock return value?';

const mockStreamName = 'mock-stream';

/**
 * Returns a StreamProvider instance and a mock stream.
 *
 * @param rpcMiddleware - The RPC middleware to use.
 * @returns A tuple containing the StreamProvider instance and the mock stream.
 */
function getStreamProvider(
  rpcMiddleware: JsonRpcMiddleware<JsonRpcParams, Json>[] = [],
) {
  const mockStream = new MockConnectionStream();
  const streamProvider = new StreamProvider(mockStream, {
    rpcMiddleware,
  });

  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  streamProvider.initialize();

  return [streamProvider, mockStream] as const;
}

describe('StreamProvider', () => {
  describe('constructor', () => {
    it('initializes state and emits events', async () => {
      const accounts = ['0xabc'];
      const chainId = '0x1';
      const networkVersion = '1';
      const isUnlocked = true;
      const isConnected = true;

      const streamProvider = new StreamProvider(new MockConnectionStream());

      const requestMock = jest
        .spyOn(streamProvider, 'request')
        .mockImplementationOnce(async () => {
          return {
            accounts,
            chainId,
            isUnlocked,
            networkVersion,
            isConnected,
          };
        });

      await streamProvider.initialize();

      expect(streamProvider.chainId).toBe(chainId);
      expect(streamProvider.selectedAddress).toBe(accounts[0]);
      expect(streamProvider.isConnected()).toBe(true);

      expect(requestMock).toHaveBeenCalledTimes(1);
      expect(requestMock).toHaveBeenCalledWith({
        method: 'metamask_getProviderState',
      });
    });

    it('throws if initialized twice', async () => {
      const accounts = ['0xabc'];
      const chainId = '0x1';
      const networkVersion = '1';
      const isUnlocked = true;
      const isConnected = true;

      const streamProvider = new StreamProvider(new MockConnectionStream());

      jest.spyOn(streamProvider, 'request').mockImplementation(async () => {
        return {
          accounts,
          chainId,
          isUnlocked,
          networkVersion,
          isConnected,
        };
      });

      await streamProvider.initialize();

      await expect(async () => streamProvider.initialize()).rejects.toThrow(
        new Error('Provider already initialized.'),
      );
    });
  });

  describe('RPC', () => {
    // mocking the underlying stream, and testing the basic functionality of
    // .request, .sendAsync, and .send
    describe('integration', () => {
      let streamProvider: StreamProvider;
      const mockRpcEngineResponse = jest
        .fn()
        .mockReturnValue([new Error(mockErrorMessage), undefined]);

      const setNextRpcEngineResponse = (
        error: Error | null = null,
        response = {},
      ) => {
        mockRpcEngineResponse.mockReturnValueOnce([error, response]);
      };

      beforeEach(() => {
        [streamProvider] = getStreamProvider();
        jest
          .spyOn(streamProvider as any, '_handleAccountsChanged')
          .mockImplementation();
        jest
          .spyOn((streamProvider as any)._rpcEngine, 'handle')
          .mockImplementation((_payload, callback: any) =>
            // eslint-disable-next-line n/no-callback-literal
            callback(...mockRpcEngineResponse()),
          );
      });

      it('.request returns result on success', async () => {
        setNextRpcEngineResponse(null, { result: 42 });
        const result = await streamProvider.request({
          method: 'foo',
          params: ['bar'],
        });
        expect((streamProvider as any)._rpcEngine.handle).toHaveBeenCalledWith(
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
          streamProvider.request({ method: 'foo', params: ['bar'] }),
        ).rejects.toThrow('foo');

        expect((streamProvider as any)._rpcEngine.handle).toHaveBeenCalledWith(
          expect.objectContaining({
            method: 'foo',
            params: ['bar'],
          }),
          expect.any(Function),
        );
      });
    });

    describe('.request', () => {
      let streamProvider: StreamProvider;
      const mockRpcRequestResponse = jest
        .fn()
        .mockReturnValue([new Error(mockErrorMessage), undefined]);

      const setNextRpcRequestResponse = (error: any = null, response = {}) => {
        mockRpcRequestResponse.mockReturnValueOnce([error, response]);
      };

      beforeEach(() => {
        [streamProvider] = getStreamProvider();
        jest
          .spyOn(streamProvider as any, '_rpcRequest')
          .mockImplementation(
            (_payload: unknown, callback: any, _isInternal: unknown) =>
              // eslint-disable-next-line n/no-callback-literal
              callback(...mockRpcRequestResponse()),
          );
      });

      it('returns result on success', async () => {
        setNextRpcRequestResponse(null, { result: 42 });
        const result = await streamProvider.request({
          method: 'foo',
          params: ['bar'],
        });

        expect(result).toBe(42);

        expect((streamProvider as any)._rpcRequest).toHaveBeenCalledWith(
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
          streamProvider.request({ method: 'foo', params: ['bar'] }),
        ).rejects.toThrow('foo');

        expect((streamProvider as any)._rpcRequest).toHaveBeenCalledWith(
          expect.objectContaining({
            method: 'foo',
            params: ['bar'],
          }),
          expect.any(Function),
        );
      });

      it('throws on non-object args', async () => {
        await expect(async () =>
          streamProvider.request(undefined as any),
        ).rejects.toThrow(messages.errors.invalidRequestArgs());

        await expect(async () =>
          streamProvider.request(null as any),
        ).rejects.toThrow(messages.errors.invalidRequestArgs());

        await expect(async () =>
          streamProvider.request([] as any),
        ).rejects.toThrow(messages.errors.invalidRequestArgs());

        await expect(async () =>
          streamProvider.request('foo' as any),
        ).rejects.toThrow(messages.errors.invalidRequestArgs());
      });

      it('throws on invalid args.method', async () => {
        await expect(async () =>
          streamProvider.request({} as any),
        ).rejects.toThrow(messages.errors.invalidRequestMethod());

        await expect(async () =>
          streamProvider.request({ method: null } as any),
        ).rejects.toThrow(messages.errors.invalidRequestMethod());

        await expect(async () =>
          streamProvider.request({
            method: 2 as any,
          }),
        ).rejects.toThrow(messages.errors.invalidRequestMethod());

        await expect(async () =>
          streamProvider.request({ method: '' }),
        ).rejects.toThrow(messages.errors.invalidRequestMethod());
      });

      it('throws on invalid args.params', async () => {
        await expect(async () =>
          streamProvider.request({ method: 'foo', params: null } as any),
        ).rejects.toThrow(messages.errors.invalidRequestParams());

        await expect(async () =>
          streamProvider.request({ method: 'foo', params: 2 } as any),
        ).rejects.toThrow(messages.errors.invalidRequestParams());

        await expect(async () =>
          streamProvider.request({ method: 'foo', params: true } as any),
        ).rejects.toThrow(messages.errors.invalidRequestParams());

        await expect(async () =>
          streamProvider.request({ method: 'foo', params: 'a' } as any),
        ).rejects.toThrow(messages.errors.invalidRequestParams());
      });
    });

    // this also tests sendAsync, it being effectively an alias for this method
    describe('._rpcRequest', () => {
      let streamProvider: StreamProvider;
      const mockRpcEngineResponse = jest
        .fn()
        .mockReturnValue([new Error(mockErrorMessage), undefined]);

      const setNextRpcEngineResponse = (
        error: Error | null = null,
        response = {},
      ) => {
        mockRpcEngineResponse.mockReturnValueOnce([error, response]);
      };

      beforeEach(() => {
        [streamProvider] = getStreamProvider();
        jest
          .spyOn(streamProvider as any, '_handleAccountsChanged')
          .mockImplementation();
        jest
          .spyOn((streamProvider as any)._rpcEngine, 'handle')
          .mockImplementation((_payload, callback: any) =>
            // eslint-disable-next-line n/no-callback-literal
            callback(...mockRpcEngineResponse()),
          );
      });

      it('returns response object on success', async () => {
        setNextRpcEngineResponse(null, { result: 42 });
        await new Promise((done) => {
          (streamProvider as any)._rpcRequest(
            { method: 'foo', params: ['bar'] },
            (error: Error | null, response: any) => {
              expect(
                (streamProvider as any)._rpcEngine.handle,
              ).toHaveBeenCalledWith(
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
          (streamProvider as any)._rpcRequest(
            { method: 'foo', params: ['bar'] },
            (error: Error | null, response: any) => {
              expect(
                (streamProvider as any)._rpcEngine.handle,
              ).toHaveBeenCalledWith(
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
          (streamProvider as any)._rpcRequest(
            { method: 'eth_accounts' },
            (error: Error | null, response: any) => {
              expect(
                (streamProvider as any)._rpcEngine.handle,
              ).toHaveBeenCalledWith(
                expect.objectContaining({ method: 'eth_accounts' }),
                expect.any(Function),
              );

              expect(
                (streamProvider as any)._handleAccountsChanged,
              ).toHaveBeenCalledWith(['0x1'], true);

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
          (streamProvider as any)._rpcRequest(
            { method: 'eth_accounts' },
            (error: Error | null, res: any) => {
              expect(
                (streamProvider as any)._rpcEngine.handle,
              ).toHaveBeenCalledWith(
                expect.objectContaining({ method: 'eth_accounts' }),
                expect.any(Function),
              );

              expect(
                (streamProvider as any)._handleAccountsChanged,
              ).toHaveBeenCalledWith([], true);

              expect(error).toStrictEqual(new Error('foo'));
              expect(res).toStrictEqual({ error: 'foo' });
              done(undefined);
            },
          );
        });
      });
    });

    describe('events', () => {
      it('calls chainChanged when the chainId changes', async () => {
        const mockStream = new MockConnectionStream();
        const mux = new ObjectMultiplex();
        pipeline(mockStream, mux, mockStream, (error: Error | null) => {
          console.error(error);
        });
        const streamProvider = new StreamProvider(
          mux.createStream(mockStreamName),
        );
        const requestMock = jest
          .spyOn(streamProvider, 'request')
          .mockImplementationOnce(async () => {
            return {
              accounts: [],
              chainId: '0x0',
              isUnlocked: true,
              networkVersion: '0',
              isConnected: true,
            };
          });

        await streamProvider.initialize();
        expect(requestMock).toHaveBeenCalledTimes(1);

        await new Promise<void>((resolve) => {
          streamProvider.once('chainChanged', (newChainId) => {
            expect(newChainId).toBe('0x1');
            resolve();
          });

          mockStream.notify(mockStreamName, {
            jsonrpc: '2.0',
            method: 'metamask_chainChanged',
            params: { chainId: '0x1', networkVersion: '0' },
          });
        });
      });

      it('handles chain changes with intermittent disconnection', async () => {
        const mockStream = new MockConnectionStream();
        const mux = new ObjectMultiplex();
        pipeline(mockStream, mux, mockStream, (error: Error | null) => {
          console.error(error);
        });
        const streamProvider = new StreamProvider(
          mux.createStream(mockStreamName),
        );

        const requestMock = jest
          .spyOn(streamProvider, 'request')
          .mockImplementationOnce(async () => {
            return {
              accounts: [],
              chainId: '0x0',
              isUnlocked: true,
              networkVersion: '0',
              isConnected: true,
            };
          });

        await streamProvider.initialize();
        expect(requestMock).toHaveBeenCalledTimes(1);

        // We check this mostly for the readability of this test.
        expect(streamProvider.isConnected()).toBe(true);
        expect(streamProvider.chainId).toBe('0x0');

        const emitSpy = jest.spyOn(streamProvider, 'emit');

        await new Promise<void>((resolve) => {
          streamProvider.once('disconnect', (error) => {
            expect(error.code).toBe(1013);
            resolve();
          });

          mockStream.notify(mockStreamName, {
            jsonrpc: '2.0',
            method: 'metamask_chainChanged',
            params: { chainId: '0x1', networkVersion: '0', isConnected: false },
          });
        });

        expect(emitSpy).toHaveBeenCalledTimes(2);
        expect(emitSpy).toHaveBeenCalledWith('chainChanged', '0x1');
        expect(emitSpy).toHaveBeenCalledWith(
          'disconnect',
          new JsonRpcError(1013, messages.errors.disconnected()),
        );
        emitSpy.mockClear(); // Clear the mock to avoid keeping a count.

        expect(streamProvider.isConnected()).toBe(false);
        expect(streamProvider.chainId).toBe('0x1');

        await new Promise<void>((resolve) => {
          streamProvider.once('chainChanged', (newChainId) => {
            expect(newChainId).toBe('0x2');
            resolve();
          });

          mockStream.notify(mockStreamName, {
            jsonrpc: '2.0',
            method: 'metamask_chainChanged',
            params: { chainId: '0x2', networkVersion: '0', isConnected: false },
          });
        });

        expect(emitSpy).toHaveBeenCalledTimes(1);
        expect(emitSpy).toHaveBeenCalledWith('chainChanged', '0x2');
        emitSpy.mockClear(); // Clear the mock to avoid keeping a count.

        expect(streamProvider.isConnected()).toBe(false);
        expect(streamProvider.chainId).toBe('0x2');

        await new Promise<void>((resolve) => {
          streamProvider.once('connect', (message) => {
            expect(message).toStrictEqual({ chainId: '0x2' });
            resolve();
          });

          mockStream.notify(mockStreamName, {
            jsonrpc: '2.0',
            method: 'metamask_chainChanged',
            params: { chainId: '0x2', networkVersion: '0', isConnected: true },
          });
        });

        expect(emitSpy).toHaveBeenCalledTimes(1);
        expect(emitSpy).toHaveBeenCalledWith('connect', {
          chainId: '0x2',
        });

        expect(streamProvider.isConnected()).toBe(true);
        expect(streamProvider.chainId).toBe('0x2');
      });
    });
  });
});
