# MetaMask Inpage Provider

The inpage Ethereum provider object injected by MetaMask into web pages.
Contains a lot of implementation details specific to MetaMask, and is probably
not suitable for out-of-the-box use with other wallets.

## Installation

`yarn add @metamask/inpage-provider`

## Usage

```javascript
import { initProvider } from '@metamask/inpage-provider'

// Create a stream to a remote provider:
const metamaskStream = new LocalMessageDuplexStream({
  name: 'inpage',
  target: 'contentscript',
})

// this will initialize the provider and set it as window.ethereum
initProvider({
  connectionStream: metamaskStream,
})

const { ethereum } = window
```
