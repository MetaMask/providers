const MetamaskInpageProvider = require('../src/MetamaskInpageProvider')
const messages = require('../src/messages')

const MockDuplexStream = require('./mocks/DuplexStream')

describe('MetamaskInpageProvider: Miscellanea', () => {

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
})
