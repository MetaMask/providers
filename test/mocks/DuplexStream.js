const { Duplex } = require('stream')

module.exports = class DuplexStream extends Duplex {

  _write () {}

  _read () {}
}
