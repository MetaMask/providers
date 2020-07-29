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

describe('MetamaskInpageProvider', () => {

  describe('constructor', () => {

    beforeAll(() => {
      jest.useFakeTimers()
    })

    afterAll(() => {
      jest.runAllTimers()
    })

    it('succeeds if stream is provided', () => {
      expect(() => new MetamaskInpageProvider(new MockDuplexStream())).not.toThrow()
    })

    it('succeeds if stream and valid options are provided', () => {
      const stream = new MockDuplexStream()

      expect(
        () => new MetamaskInpageProvider(stream, {
          maxEventListeners: 10,
        }),
      ).not.toThrow()

      expect(
        () => new MetamaskInpageProvider(stream, {
          shouldSendMetadata: false,
        }),
      ).not.toThrow()

      expect(
        () => new MetamaskInpageProvider(stream, {
          maxEventListeners: 10,
          shouldSendMetadata: false,
        }),
      ).not.toThrow()
    })

    it('throws if no or invalid stream is provided', () => {
      expect(
        () => new MetamaskInpageProvider(),
      ).toThrow(messages.errors.invalidDuplexStream())

      expect(
        () => new MetamaskInpageProvider('foo'),
      ).toThrow(messages.errors.invalidDuplexStream())

      expect(
        () => new MetamaskInpageProvider({}),
      ).toThrow(messages.errors.invalidDuplexStream())
    })

    it('throws if bad options are provided', () => {
      const stream = new MockDuplexStream()

      expect(
        () => new MetamaskInpageProvider(stream, null),
      ).toThrow('Cannot destructure property `maxEventListeners` of \'undefined\' or \'null\'')

      expect(
        () => new MetamaskInpageProvider(stream, {
          maxEventListeners: 10,
          shouldSendMetadata: 'foo',
        }),
      ).toThrow(messages.errors.invalidOptions(10, 'foo'))

      expect(
        () => new MetamaskInpageProvider(stream, {
          maxEventListeners: 'foo',
          shouldSendMetadata: true,
        }),
      ).toThrow(messages.errors.invalidOptions('foo', true))
    })
  })

  describe('isConnected', () => {
    it('returns isConnected state', () => {

      jest.useFakeTimers()
      const provider = new MetamaskInpageProvider(new MockDuplexStream())
      provider.autoRefreshOnNetworkChange = false

      expect(
        provider.isConnected(),
      ).toBeUndefined()

      provider._state.isConnected = true

      expect(
        provider.isConnected(),
      ).toBe(true)

      provider._state.isConnected = false

      expect(
        provider.isConnected(),
      ).toBe(false)

      jest.runAllTimers()
    })
  })

  // .request, .sendAsync, .send, and ._rpcRequest
  describe('RPC requests', () => {

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

      it('returns result', async () => {
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

      it('throws on RPC error', async () => {
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

      it('returns response object', async () => {
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

      it('returns response object with error', async () => {
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
})
