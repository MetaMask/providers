const { Duplex } = require('stream')

module.exports = class DuplexStream extends Duplex {

  constructor () {
    super({
      objectMode: true,
    })
  }

  pushToSubstream (name, data) {
    this.push({ name, data })
  }

  _write (_data, _encoding, callback) {
    callback()
  }

  _read () {}
}
