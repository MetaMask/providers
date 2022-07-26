import type { JsonRpcMiddleware } from 'json-rpc-engine';

import type { ConsoleLike } from '../utils';
import messages from '../messages';

/**
 * Create JSON-RPC middleware that logs warnings for deprecated RPC methods.
 *
 * @param log - The logging API to use.
 * @returns The JSON-RPC middleware.
 */
export function createRpcWarningMiddleware(
  log: ConsoleLike,
): JsonRpcMiddleware<unknown, unknown> {
  const sentWarnings = {
    ethDecryptDeprecation: false,
    ethGetEncryptionPublicKeyDeprecation: false,
  };

  return (req, _res, next) => {
    if (
      sentWarnings.ethDecryptDeprecation === false &&
      req.method === 'eth_decrypt'
    ) {
      log.warn(messages.warnings.rpc.ethDecryptDeprecation);
      sentWarnings.ethDecryptDeprecation = true;
    } else if (
      sentWarnings.ethGetEncryptionPublicKeyDeprecation === false &&
      req.method === 'eth_getEncryptionPublicKey'
    ) {
      log.warn(messages.warnings.rpc.ethGetEncryptionPublicKeyDeprecation);
      sentWarnings.ethGetEncryptionPublicKeyDeprecation = true;
    }
    next();
  };
}
