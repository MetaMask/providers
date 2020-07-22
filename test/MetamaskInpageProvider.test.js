const MetamaskInpageProvider = require('../src/MetamaskInpageProvider')
const messages = require('../src/messages')

const DuplexStream = require('./mocks/DuplexStream')

describe('MetamaskInpageProvider', () => {

  describe('constructor', () => {

    it('succeeds if stream is provided', () => {
      expect(() => new MetamaskInpageProvider(new DuplexStream())).not.toThrow()
    })

    it('succeeds if stream and valid options are provided', () => {
      const stream = new DuplexStream()

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
      const stream = new DuplexStream()

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
})
