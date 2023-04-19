import {
  JsonRpcNotification,
  JsonRpcRequest,
  JsonRpcResponse,
} from '@metamask/utils';
import { EventEmitter } from 'events';

/**
 * A mock WebExtension Port for multiplexed JSON-RPC messages, used to
 * represent the connection between an extension and the MetaMask browser
 * extension.
 *
 * @see {@link https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/runtime/Port})
 */
export class MockPort {
  #connected = true;

  #eventEmitter = new EventEmitter();

  #onWrite?: (name: string, data: JsonRpcRequest) => void;

  /**
   * Construct a mock WebExtension Port.
   *
   * @param onWrite - Called when a message is sent to the port. Messages sent
   * from another extension to the wallet are passed to this function.
   */
  constructor(
    onWrite: (name: string, data: JsonRpcRequest) => void = () => undefined,
  ) {
    this.#onWrite = onWrite;
  }

  disconnect() {
    this.#connected = false;
    this.#eventEmitter.emit('disconnect');
  }

  /**
   * Send a message to the port. This is called to send a message from another
   * extension to the wallet.
   *
   * @param message - The message being sent to the port.
   * @param message.name - The name of the substream this message is included
   * in.
   * @param message.data - The JSON-RPC request.
   */
  postMessage(message: { name: string; data: JsonRpcRequest }) {
    if (!this.#connected) {
      throw new Error('Disconnected');
    } else if (this.#onWrite) {
      this.#onWrite(message.name, message.data);
    }
  }

  get onDisconnect() {
    return {
      addListener: (listener: () => void) => {
        this.#eventEmitter.addListener('disconnect', listener);
      },
    };
  }

  get onMessage() {
    return {
      addListener: (
        listener: (message: { name: string; data: JsonRpcRequest }) => void,
      ) => {
        this.#eventEmitter.addListener('message', listener);
      },
    };
  }

  /**
   * Send a reply to the provider from the wallet.
   *
   * @param substream - The substream this reply is included in.
   * @param message - The JSON RPC response.
   */
  reply(substream: string, message: JsonRpcResponse) {
    if (!this.#connected) {
      throw new Error(
        'It is not possible to reply after the port has disconnected',
      );
    }
    this.#eventEmitter.emit('message', { name: substream, data: message });
  }

  /**
   * Send a notification to the provider from the wallet.
   *
   * @param substream - The substream this notification is included in.
   * @param message - The JSoN RPC notification.
   */
  notify(substream: string, message: JsonRpcNotification) {
    if (!this.#connected) {
      throw new Error(
        'It is not possible to notify after the port has disconnected',
      );
    }
    this.#eventEmitter.emit('message', { name: substream, data: message });
  }
}
