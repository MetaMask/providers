import { Duplex } from 'stream';
import {
  JsonRpcNotification,
  JsonRpcRequest,
  JsonRpcResponse,
} from 'json-rpc-engine';

/**
 * A mock multiplexed JSON-RPC stream that represents the connection from the
 * provider to the wallet.
 */
export class MockConnectionStream extends Duplex {
  #onWrite?: (name: string, data: JsonRpcRequest<unknown>) => void;

  /**
   * Construct a mock connection stream.
   *
   * @param onWrite - Called when the stream is written to. Messages sent from
   * the provider to the wallet are passed to this function.
   */
  constructor(onWrite?: (name: string, data: JsonRpcRequest<unknown>) => void) {
    super({ objectMode: true });
    this.#onWrite = onWrite;
  }

  /**
   * Internal method that is called when the stream is written to. Do not call
   * directly.
   *
   * @param message - The message being sent to the stream. This is always an
   * object because the stream is in "objectMode".
   * @param _encoding - The encoding of the message. Ignored in object mode.
   * @param callback - The callback for the write operation. It is called with
   * an error when the write fails, otherwise it is called with nothing when
   * the write has completed.
   */
  _write(
    message: { name: string; data: JsonRpcRequest<unknown> },
    _encoding: string,
    callback: (error?: Error) => void,
  ) {
    try {
      if (this.#onWrite) {
        this.#onWrite(message.name, message.data);
      }
    } catch (error) {
      callback(error);
      return;
    }
    callback();
  }

  /**
   * Internal method that is called when the stream is read from. Do not call
   * directly.
   */
  _read() {
    return undefined;
  }

  /**
   * Send a reply to the provider from the wallet.
   *
   * @param substream - The substream this reply is included in.
   * @param message - The JSON RPC response.
   */
  reply(substream: string, message: JsonRpcResponse<unknown>) {
    this.push({ name: substream, data: message });
  }

  /**
   * Send a notification to the provider from the wallet.
   *
   * @param substream - The substream this notification is included in.
   * @param message - The JSON RPC notification.
   */
  notify(substream: string, message: JsonRpcNotification<unknown>) {
    this.push({ name: substream, data: message });
  }
}
