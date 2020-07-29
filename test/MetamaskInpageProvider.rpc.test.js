const MetamaskInpageProvider = require('../src/MetamaskInpageProvider')
const messages = require('../src/messages')

const MockDuplexStream = require('./mocks/DuplexStream')

const MOCK_ERROR_MESSAGE = 'Did you specify a mock return value?'

function initProvider () {
  jest.useFakeTimers()
  const mockStream = new MockDuplexStream()
  const provider = new MetamaskInpageProvider(mockStream)
  provider.mockStream = mockStream
  provider.autoRefreshOnNetworkChange = false
  jest.runAllTimers()
  return provider
}

describe('MetamaskInpageProvider: RPC', () => {

  // mocking the underlying stream, and testing the basic functionality of
  // .reqest, .sendAsync, and .send
  describe('integration', () => {

    let provider
    const mockRpcEngineResponse = jest.fn()

    const resetRpcEngineResponseMock = () => {
      mockRpcEngineResponse.mockClear()
        .mockReturnValue([new Error(MOCK_ERROR_MESSAGE), undefined])
    }

    const setNextRpcEngineResponse = (err = null, res = {}) => {
      mockRpcEngineResponse.mockReturnValueOnce([err, res])
    }

    beforeEach(() => {
      resetRpcEngineResponseMock()
      provider = initProvider()
      jest.spyOn(provider, '_handleAccountsChanged').mockImplementation()
      jest.spyOn(provider._rpcEngine, 'handle').mockImplementation(
        (_payload, cb) => cb(...mockRpcEngineResponse()),
      )
    })

    it('.request returns result on success', async () => {
      setNextRpcEngineResponse(null, { result: 42 })
      const result = await provider.request(
        { method: 'foo', params: ['bar'] },
      )
      expect(provider._rpcEngine.handle).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'foo',
          params: ['bar'],
        }),
        expect.any(Function),
      )

      expect(result).toBe(42)
    })

    it('.request throws on error', async () => {
      setNextRpcEngineResponse(new Error('foo'))

      await expect(
        provider.request({ method: 'foo', params: ['bar'] }),
      ).rejects.toThrow('foo')

      expect(provider._rpcEngine.handle).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'foo',
          params: ['bar'],
        }),
        expect.any(Function),
      )
    })

    it('.sendAsync returns response object on success', async () => {
      setNextRpcEngineResponse(null, { result: 42 })
      await new Promise((done) => {
        provider.sendAsync(
          { method: 'foo', params: ['bar'] },
          (err, res) => {

            expect(provider._rpcEngine.handle).toHaveBeenCalledWith(
              expect.objectContaining({
                method: 'foo',
                params: ['bar'],
              }),
              expect.any(Function),
            )

            expect(err).toBeNull()
            expect(res).toStrictEqual({ result: 42 })
            done()
          },
        )
      })
    })

    it('.sendAsync returns response object on error', async () => {
      setNextRpcEngineResponse(new Error('foo'), { error: 'foo' })
      await new Promise((done) => {
        provider.sendAsync(
          { method: 'foo', params: ['bar'] },
          (err, res) => {

            expect(provider._rpcEngine.handle).toHaveBeenCalledWith(
              expect.objectContaining({
                method: 'foo',
                params: ['bar'],
              }),
              expect.any(Function),
            )

            expect(err).toStrictEqual(new Error('foo'))
            expect(res).toStrictEqual({ error: 'foo' })
            done()
          },
        )
      })
    })

    it('.send promise signature returns response object on success', async () => {
      setNextRpcEngineResponse(null, { result: 42 })
      const result = await provider.send('foo', ['bar'])
      expect(provider._rpcEngine.handle).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'foo',
          params: ['bar'],
        }),
        expect.any(Function),
      )

      expect(result).toStrictEqual({ result: 42 })
    })

    it('.send promise signature throws on error', async () => {
      setNextRpcEngineResponse(new Error('foo'))

      await expect(
        provider.send('foo', ['bar']),
      ).rejects.toThrow('foo')

      expect(provider._rpcEngine.handle).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'foo',
          params: ['bar'],
        }),
        expect.any(Function),
      )
    })

    it('.send callback signature returns response object on success', async () => {
      setNextRpcEngineResponse(null, { result: 42 })
      await new Promise((done) => {
        provider.send(
          { method: 'foo', params: ['bar'] },
          (err, res) => {

            expect(provider._rpcEngine.handle).toHaveBeenCalledWith(
              expect.objectContaining({
                method: 'foo',
                params: ['bar'],
              }),
              expect.any(Function),
            )

            expect(err).toBeNull()
            expect(res).toStrictEqual({ result: 42 })
            done()
          },
        )
      })
    })

    it('.send callback signature returns response object on error', async () => {
      setNextRpcEngineResponse(new Error('foo'), { error: 'foo' })
      await new Promise((done) => {
        provider.send(
          { method: 'foo', params: ['bar'] },
          (err, res) => {

            expect(provider._rpcEngine.handle).toHaveBeenCalledWith(
              expect.objectContaining({
                method: 'foo',
                params: ['bar'],
              }),
              expect.any(Function),
            )

            expect(err).toStrictEqual(new Error('foo'))
            expect(res).toStrictEqual({ error: 'foo' })
            done()
          },
        )
      })
    })
  })

  describe('.request', () => {

    let provider
    const mockRpcRequestResponse = jest.fn()

    const resetRpcRequestResponseMock = () => {
      mockRpcRequestResponse.mockClear()
        .mockReturnValue([new Error(MOCK_ERROR_MESSAGE), undefined])
    }

    const setNextRpcRequestResponse = (err = null, res = {}) => {
      mockRpcRequestResponse.mockReturnValueOnce([err, res])
    }

    beforeEach(() => {
      resetRpcRequestResponseMock()
      provider = initProvider()
      jest.spyOn(provider, '_rpcRequest').mockImplementation(
        (_payload, cb, _isInternal) => cb(...mockRpcRequestResponse()),
      )
    })

    it('returns result on success', async () => {
      setNextRpcRequestResponse(null, { result: 42 })
      const result = await provider.request({ method: 'foo', params: ['bar'] })

      expect(result).toBe(42)

      expect(provider._rpcRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'foo',
          params: ['bar'],
        }),
        expect.any(Function),
      )
    })

    it('throws on error', async () => {
      setNextRpcRequestResponse(new Error('foo'))

      await expect(
        provider.request({ method: 'foo', params: ['bar'] }),
      ).rejects.toThrow('foo')

      expect(provider._rpcRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'foo',
          params: ['bar'],
        }),
        expect.any(Function),
      )
    })

    it('throws on non-object args', async () => {
      await expect(
        () => provider.request(),
      ).rejects.toThrow(messages.errors.invalidRequestArgs())

      await expect(
        () => provider.request(null),
      ).rejects.toThrow(messages.errors.invalidRequestArgs())

      await expect(
        () => provider.request([]),
      ).rejects.toThrow(messages.errors.invalidRequestArgs())

      await expect(
        () => provider.request('foo'),
      ).rejects.toThrow(messages.errors.invalidRequestArgs())
    })

    it('throws on invalid args.method', async () => {
      await expect(
        () => provider.request({}),
      ).rejects.toThrow(messages.errors.invalidRequestMethod())

      await expect(
        () => provider.request({ method: null }),
      ).rejects.toThrow(messages.errors.invalidRequestMethod())

      await expect(
        () => provider.request({ method: 2 }),
      ).rejects.toThrow(messages.errors.invalidRequestMethod())

      await expect(
        () => provider.request({ method: '' }),
      ).rejects.toThrow(messages.errors.invalidRequestMethod())
    })

    it('throws on invalid args.params', async () => {
      await expect(
        () => provider.request({ method: 'foo', params: null }),
      ).rejects.toThrow(messages.errors.invalidRequestParams())

      await expect(
        () => provider.request({ method: 'foo', params: 2 }),
      ).rejects.toThrow(messages.errors.invalidRequestParams())

      await expect(
        () => provider.request({ method: 'foo', params: true }),
      ).rejects.toThrow(messages.errors.invalidRequestParams())

      await expect(
        () => provider.request({ method: 'foo', params: 'a' }),
      ).rejects.toThrow(messages.errors.invalidRequestParams())
    })
  })

  describe('._rpcRequest', () => {

    let provider
    const mockRpcEngineResponse = jest.fn()

    const resetRpcEngineResponseMock = () => {
      mockRpcEngineResponse.mockClear()
        .mockReturnValue([new Error(MOCK_ERROR_MESSAGE), undefined])
    }

    const setNextRpcEngineResponse = (err = null, res = {}) => {
      mockRpcEngineResponse.mockReturnValueOnce([err, res])
    }

    beforeEach(() => {
      resetRpcEngineResponseMock()
      provider = initProvider()
      jest.spyOn(provider, '_handleAccountsChanged').mockImplementation()
      jest.spyOn(provider._rpcEngine, 'handle').mockImplementation(
        (_payload, cb) => cb(...mockRpcEngineResponse()),
      )
    })

    it('returns response object on success', async () => {
      setNextRpcEngineResponse(null, { result: 42 })
      await new Promise((done) => {
        provider._rpcRequest(
          { method: 'foo', params: ['bar'] },
          (err, res) => {

            expect(provider._rpcEngine.handle).toHaveBeenCalledWith(
              expect.objectContaining({
                method: 'foo',
                params: ['bar'],
              }),
              expect.any(Function),
            )

            expect(err).toBeNull()
            expect(res).toStrictEqual({ result: 42 })
            done()
          },
        )
      })
    })

    it('returns response object on error', async () => {
      setNextRpcEngineResponse(new Error('foo'), { error: 'foo' })
      await new Promise((done) => {
        provider._rpcRequest(
          { method: 'foo', params: ['bar'] },
          (err, res) => {

            expect(provider._rpcEngine.handle).toHaveBeenCalledWith(
              expect.objectContaining({
                method: 'foo',
                params: ['bar'],
              }),
              expect.any(Function),
            )

            expect(err).toStrictEqual(new Error('foo'))
            expect(res).toStrictEqual({ error: 'foo' })
            done()
          },
        )
      })
    })

    it('calls _handleAccountsChanged on request for eth_accounts', async () => {
      setNextRpcEngineResponse(null, { result: ['0x1'] })
      await new Promise((done) => {
        provider._rpcRequest(
          { method: 'eth_accounts' },
          (err, res) => {

            expect(provider._rpcEngine.handle).toHaveBeenCalledWith(
              expect.objectContaining({ method: 'eth_accounts' }),
              expect.any(Function),
            )

            expect(provider._handleAccountsChanged)
              .toHaveBeenCalledWith(['0x1'], true, false)

            expect(err).toBeNull()
            expect(res).toStrictEqual({ result: ['0x1'] })
            done()
          },
        )
      })
    })

    it(
      'calls _handleAccountsChanged with empty array on eth_accounts request returning error',
      async () => {
        setNextRpcEngineResponse(new Error('foo'), { error: 'foo' })
        await new Promise((done) => {
          provider._rpcRequest(
            { method: 'eth_accounts' },
            (err, res) => {

              expect(provider._rpcEngine.handle).toHaveBeenCalledWith(
                expect.objectContaining({ method: 'eth_accounts' }),
                expect.any(Function),
              )

              expect(provider._handleAccountsChanged)
                .toHaveBeenCalledWith([], true, false)

              expect(err).toStrictEqual(new Error('foo'))
              expect(res).toStrictEqual({ error: 'foo' })
              done()
            },
          )
        })
      },
    )
  })
})
