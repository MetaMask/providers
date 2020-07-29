const MetamaskInpageProvider = require('../src/MetamaskInpageProvider')
const messages = require('../src/messages')

const MockDuplexStream = require('./mocks/DuplexStream')

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
          .mockReturnValue([new Error('Did you specify a mock return value?'), undefined])
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
  })
})
