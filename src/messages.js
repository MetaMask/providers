module.exports = {
  errors: {
    invalidParams: () => `MetaMask: Invalid request parameters. Please use ethereum.sendAsync(request: Object, callback: Function).`,
    sendSiteMetadata: () => `MetaMask: Failed to send site metadata. This is an internal error, please report this bug.`,
    unsupportedSync: (method) => `MetaMask: The MetaMask Web3 object does not support synchronous methods like ${method} without a callback parameter.`, // TODO:deprecation:remove
  },
  warnings: {
    // TODO:deprecation:remove
    autoReloadDeprecation: `MetaMask: MetaMask will stop reloading pages on network change in Q2 2020. For more information, see: https://medium.com/metamask/no-longer-reloading-pages-on-network-change-fbf041942b44 \nSet 'ethereum.autoRefreshOnNetworkChange' to 'false' to silence this warning: https://metamask.github.io/metamask-docs/API_Reference/Ethereum_Provider#ethereum.autorefreshonnetworkchange`,
    // deprecated stuff yet to be scheduled for removal
    enableDeprecation: `MetaMask: 'ethereum.enable()' is deprecated and may be removed in the future. Please use "ethereum.sendAsync({ method: 'eth_requestAccounts' })" instead.`,
    isConnectedDeprecation: `MetaMask: 'ethereum.isConnected()' is deprecated and may be removed in the future. Please listen for the relevant events instead. For more information, see: https://eips.ethereum.org/EIPS/eip-1193`,
    sendDeprecation: `MetaMask: 'ethereum.send(...)' is deprecated and may be removed in the future. Please use 'ethereum.sendAsync({ method: string, params: Array<any> | Object }, callback: Function)' instead.`,
    // misc
    experimentalMethods: `MetaMask: 'ethereum._metamask' exposes non-standard, experimental methods. They may be removed or changed without warning.`,
  },
}
