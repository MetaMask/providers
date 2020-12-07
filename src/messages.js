module.exports = {
  errors: {
    disconnected: () => 'MetaMask: Disconnected from chain. Attempting to connect.',
    permanentlyDisconnected: () => 'MetaMask: Disconnected from MetaMask background. Page reload required.',
    sendSiteMetadata: () => `MetaMask: Failed to send site metadata. This is an internal error, please report this bug.`,
    unsupportedSync: (method) => `MetaMask: The MetaMask Ethereum provider does not support synchronous methods like ${method} without a callback parameter.`,
    invalidDuplexStream: () => 'Must provide a Node.js-style duplex stream.',
    invalidOptions: (maxEventListeners, shouldSendMetadata) => `Invalid options. Received: { maxEventListeners: ${maxEventListeners}, shouldSendMetadata: ${shouldSendMetadata} }`,
    invalidRequestArgs: () => `Expected a single, non-array, object argument.`,
    invalidRequestMethod: () => `'args.method' must be a non-empty string.`,
    invalidRequestParams: () => `'args.params' must be an object or array if provided.`,
    invalidLoggerObject: () => `'args.logger' must be an object if provided.`,
    invalidLoggerMethod: (method) => `'args.logger' must include required method '${method}'.`,
  },
  info: {
    connected: (chainId) => `MetaMask: Connected to chain with ID "${chainId}".`,
  },
  warnings: {
    // deprecated methods
    enableDeprecation: `MetaMask: 'ethereum.enable()' is deprecated and may be removed in the future. Please use the 'eth_requestAccounts' RPC method instead.\nFor more information, see: https://eips.ethereum.org/EIPS/eip-1102`,
    sendDeprecation: `MetaMask: 'ethereum.send(...)' is deprecated and may be removed in the future. Please use 'ethereum.sendAsync(...)' or 'ethereum.request(...)' instead.\nFor more information, see: https://eips.ethereum.org/EIPS/eip-1193`,
    // deprecated events
    events: {
      close: `MetaMask: The event 'close' is deprecated and may be removed in the future. Please use 'disconnect' instead.\nFor more information, see: https://eips.ethereum.org/EIPS/eip-1193`,
      data: `MetaMask: The event 'data' is deprecated and may be removed in the future.`,
      networkChanged: `MetaMask: The event 'networkChanged' is deprecated and may be removed in the future. Please use 'chainChanged' instead.\nFor more information, see: https://eips.ethereum.org/EIPS/eip-1193`,
      notification: `MetaMask: The event 'notification' is deprecated and may be removed in the future. Please use 'message' instead.\nFor more information, see: https://eips.ethereum.org/EIPS/eip-1193`,
    },
    // misc
    experimentalMethods: `MetaMask: 'ethereum._metamask' exposes non-standard, experimental methods. They may be removed or changed without warning.`,
  },
}
