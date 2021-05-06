import { Duplex } from 'stream';

export default class DuplexStream extends Duplex {
  constructor() {
    super({
      objectMode: true,
    });
  }

  pushToSubstream(name: string, data: unknown) {
    this.push({ name, data });
  }

  _write(_data: unknown, _encoding: string, callback: any) {
    callback();
  }

  _read() {
    return undefined;
  }
}
