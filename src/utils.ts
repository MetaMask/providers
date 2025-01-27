import type { JsonRpcMiddleware } from '@metamask/json-rpc-engine';
import { createIdRemapMiddleware } from '@metamask/json-rpc-engine';
import { rpcErrors } from '@metamask/rpc-errors';
import type {
  Json,
  JsonRpcParams,
  PendingJsonRpcResponse,
} from '@metamask/utils';

import { createRpcWarningMiddleware } from './middleware/createRpcWarningMiddleware';

export type Maybe<Type> = Partial<Type> | null | undefined;

export type ConsoleLike = Pick<
  Console,
  'log' | 'warn' | 'error' | 'debug' | 'info' | 'trace'
>;

// Constants

// https://github.com/thenativeweb/uuidv4/blob/bdcf3a3138bef4fb7c51f389a170666f9012c478/lib/uuidv4.ts#L5
export const UUID_V4_REGEX =
  /(?:^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[a-f0-9]{4}-[a-f0-9]{12}$)|(?:^0{8}-0{4}-0{4}-0{4}-0{12}$)/u;

// https://stackoverflow.com/a/20204811
export const FQDN_REGEX =
  /(?=^.{4,253}$)(^((?!-)[a-zA-Z0-9-]{0,62}[a-zA-Z0-9]\.)+[a-zA-Z]{2,63}$)/u;

// https://stackoverflow.com/a/9523559
const POSITIVE_INTEGER_REGEX = /^(\d*[1-9]\d*|0)$/u;

export const EMITTED_NOTIFICATIONS = Object.freeze([
  'eth_subscription', // per eth-json-rpc-filters/subscriptionManager
]);

// Utility functions

/**
 * Gets the default middleware for external providers, consisting of an ID
 * remapping middleware and an error middleware.
 *
 * @param logger - The logger to use in the error middleware.
 * @returns An array of @metamask/json-rpc-engine middleware functions.
 */
export const getDefaultExternalMiddleware = (logger: ConsoleLike = console) => [
  createIdRemapMiddleware(),
  createErrorMiddleware(logger),
  createRpcWarningMiddleware(logger),
];

/**
 * A `json-rpc-engine` middleware that logs RPC errors and validates the request
 * method.
 *
 * @param log - The logging API to use.
 * @returns A @metamask/json-rpc-engine middleware function.
 */
function createErrorMiddleware(
  log: ConsoleLike,
): JsonRpcMiddleware<JsonRpcParams, Json> {
  return (request, response, next) => {
    // json-rpc-engine will terminate the request when it notices this error
    if (typeof request.method !== 'string' || !request.method) {
      response.error = rpcErrors.invalidRequest({
        message: `The request 'method' must be a non-empty string.`,
        data: request,
      });
    }

    next((done) => {
      const { error } = response;
      if (!error) {
        return done();
      }
      log.warn(`MetaMask - RPC Error: ${error.message}`, error);
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
  (error: Error, response: PendingJsonRpcResponse<Json>): void => {
    if (error || response.error) {
      reject(error || response.error);
    } else {
      !unwrapResult || Array.isArray(response)
        ? resolve(response)
        : resolve(response.result);
    }
  };

/**
 * Checks whether the given chain ID is valid, meaning if it is non-empty,
 * '0x'-prefixed string.
 *
 * @param chainId - The chain ID to validate.
 * @returns Whether the given chain ID is valid.
 */
export const isValidChainId = (chainId: unknown): chainId is string =>
  Boolean(chainId) && typeof chainId === 'string' && chainId.startsWith('0x');

/**
 * Checks whether the given network version is valid, meaning if it is non-empty
 * string when available or null otherwise.
 *
 * @param networkVersion - The network version to validate.
 * @returns Whether the given network version is valid.
 */
export const isValidNetworkVersion = (
  networkVersion: unknown,
): networkVersion is string | null =>
  (typeof networkVersion === 'string' &&
    POSITIVE_INTEGER_REGEX.test(networkVersion)) ||
  networkVersion === null;

export const NOOP = () => undefined;
