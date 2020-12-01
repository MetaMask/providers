const MetaMaskInpageProvider = require('./src/MetaMaskInpageProvider')
const { initializeProvider, setGlobalProvider } = require('./src/initializeProvider')
const shimWeb3 = require('./src/shimWeb3')

module.exports = {
  initializeProvider,
  MetaMaskInpageProvider,
  setGlobalProvider,
  shimWeb3,
}
