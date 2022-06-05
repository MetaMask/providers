import {
  createIdRemapMiddleware,
  JsonRpcMiddleware,
  PendingJsonRpcResponse,
} from 'json-rpc-engine';
import { ethErrors } from 'eth-rpc-errors';

export type Maybe<T> = Partial<T> | null | undefined;

export type ConsoleLike = Pick<
  Console,
  'log' | 'warn' | 'error' | 'debug' | 'info' | 'trace'
>;

// Constants

export const EMITTED_NOTIFICATIONS = Object.freeze([
  'eth_subscription', // per eth-json-rpc-filters/subscriptionManager
]);

// Utility functions

/**
 * Gets the default middleware for external providers, consisting of an ID
 * remapping middleware and an error middleware.
 *
 * @param logger - The logger to use in the error middleware.
 * @returns An array of json-rpc-engine middleware functions.
 */
export const getDefaultExternalMiddleware = (logger: ConsoleLike = console) => [
  createIdRemapMiddleware(),
  createErrorMiddleware(logger),
];

/**
 * json-rpc-engine middleware that logs RPC errors and and validates req.method.
 *
 * @param log - The logging API to use.
 * @returns A json-rpc-engine middleware function.
 */
function createErrorMiddleware(
  log: ConsoleLike,
): JsonRpcMiddleware<unknown, unknown> {
  return (req, res, next) => {
    // json-rpc-engine will terminate the request when it notices this error
    if (typeof req.method !== 'string' || !req.method) {
      res.error = ethErrors.rpc.invalidRequest({
        message: `The request 'method' must be a non-empty string.`,
        data: req,
      });
    }

    next((done) => {
      const { error } = res;
      if (!error) {
        return done();
      }
      log.error(`MetaMask - RPC Error: ${error.message}`, error);
      return done();
    });
  };
}

// resolve response.result or response, reject errors
export const getRpcPromiseCallback =
  (
    resolve: (value?: any) => void,
    reject: (error?: Error) => void,
    unwrapResult = true,
  ) =>
  (error: Error, response: PendingJsonRpcResponse<unknown>): void => {
    if (error || response.error) {
      reject(error || response.error);
    } else {
      !unwrapResult || Array.isArray(response)
        ? resolve(response)
        : resolve(response.result);
    }
  };

export const NOOP = () => undefined;
