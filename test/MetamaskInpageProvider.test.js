const MetamaskInpageProvider = require('../src/MetamaskInpageProvider')
const messages = require('../src/messages')

const DuplexStream = require('./mocks/DuplexStream')

describe('MetamaskInpageProvider', () => {

  describe('constructor', () => {

    it('succeeds if stream is provided', () => {
      expect(() => new MetamaskInpageProvider(new DuplexStream())).not.toThrow()
    })

    it('throws if no stream is provided', () => {
      expect(() => new MetamaskInpageProvider()).toThrow(messages.errors.invalidDuplexStream())
    })
  })
})
