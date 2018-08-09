# MetaMask Inpage Provider

Used to initialize the inpage ethereum provider injected by MetaMask.

## Installation

`npm install metamask-inpage-provider -S`

## Usage

```javascript
// Create a stream to a remote provider:
var metamaskStream = new LocalMessageDuplexStream({
  name: 'inpage',
  target: 'contentscript',
})

// compose the inpage provider
var inpageProvider = new MetamaskInpageProvider(metamaskStream)
```
