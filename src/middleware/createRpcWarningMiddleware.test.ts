import { JsonRpcEngine, JsonRpcFailure, JsonRpcSuccess } from 'json-rpc-engine';

import { createRpcWarningMiddleware } from './createRpcWarningMiddleware';
import messages from '../messages';

const affected = [
  {
    method: 'eth_decrypt',
    warning: messages.warnings.rpc.ethDecryptDeprecation,
  },
  {
    method: 'eth_getEncryptionPublicKey',
    warning: messages.warnings.rpc.ethGetEncryptionPublicKeyDeprecation,
  },
  {
    method: 'wallet_watchAsset',
    params: {
      type: 'ERC721',
      options: {},
    },
    scenario: 'ERC721',
    warning: messages.warnings.rpc.walletWatchAssetNFTExperimental,
  },
  {
    method: 'wallet_watchAsset',
    params: {
      type: 'ERC1155',
      options: {},
    },
    scenario: 'ERC1155',
    warning: messages.warnings.rpc.walletWatchAssetNFTExperimental,
  },
];

const unaffected = [
  {
    method: 'eth_chainId',
  },
  {
    method: 'wallet_watchAsset',
    params: {
      type: 'ERC20',
      options: {},
    },
    scenario: 'ERC20',
  },
];

describe('createRpcWarningMiddleware', () => {
  for (const { scenario = '', method, params = {}, warning } of affected) {
    const name = [method, scenario].join(' ');
    describe(`${name}`, () => {
      it('should warn the first time the method is called', async () => {
        const consoleWarnSpy = jest.spyOn(globalThis.console, 'warn');
        const middleware = createRpcWarningMiddleware(globalThis.console);
        const engine = new JsonRpcEngine();
        engine.push(middleware);

        await engine.handle({ jsonrpc: '2.0', id: 1, method, params });

        expect(consoleWarnSpy).toHaveBeenCalledWith(warning);
        expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
      });

      it('should not warn the second time the method is called', async () => {
        const consoleWarnSpy = jest.spyOn(globalThis.console, 'warn');
        const middleware = createRpcWarningMiddleware(globalThis.console);
        const engine = new JsonRpcEngine();
        engine.push(middleware);

        await engine.handle({ jsonrpc: '2.0', id: 1, method, params });
        await engine.handle({ jsonrpc: '2.0', id: 1, method, params });

        expect(consoleWarnSpy).toHaveBeenCalledWith(warning);
        expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
      });

      it('should allow the method to succeed', async () => {
        const middleware = createRpcWarningMiddleware(globalThis.console);
        const engine = new JsonRpcEngine();
        engine.push(middleware);
        engine.push((_req, res, _next, end) => {
          res.result = 'success!';
          end();
        });

        const response = (await engine.handle({
          jsonrpc: '2.0',
          id: 1,
          method,
        })) as JsonRpcSuccess<unknown>;

        expect(response.result).toBe('success!');
      });

      it('should allow the method to fail', async () => {
        const middleware = createRpcWarningMiddleware(globalThis.console);
        const engine = new JsonRpcEngine();
        engine.push(middleware);
        engine.push(() => {
          throw new Error('Failure!');
        });

        const result = (await engine.handle({
          jsonrpc: '2.0',
          id: 1,
          method,
        })) as JsonRpcFailure;

        expect(result.error.message).toBe('Failure!');
      });
    });
  }

  for (const { scenario = '', method, params = {} } of unaffected) {
    const name = [method, scenario].join(' ');
    describe(`${name}`, () => {
      it('should not issue a warning', async () => {
        const consoleWarnSpy = jest.spyOn(globalThis.console, 'warn');
        const middleware = createRpcWarningMiddleware(globalThis.console);
        const engine = new JsonRpcEngine();
        engine.push(middleware);

        await engine.handle({ jsonrpc: '2.0', id: 1, method, params });

        expect(consoleWarnSpy).not.toHaveBeenCalled();
      });

      it('should allow the method to succeed', async () => {
        const middleware = createRpcWarningMiddleware(globalThis.console);
        const engine = new JsonRpcEngine();
        engine.push(middleware);
        engine.push((_req, res, _next, end) => {
          res.result = 'success!';
          end();
        });

        const response = (await engine.handle({
          jsonrpc: '2.0',
          id: 1,
          method,
          params,
        })) as JsonRpcSuccess<unknown>;

        expect(response.result).toBe('success!');
      });

      it('should allow the method to fail', async () => {
        const middleware = createRpcWarningMiddleware(globalThis.console);
        const engine = new JsonRpcEngine();
        engine.push(middleware);
        engine.push(() => {
          throw new Error('Failure!');
        });

        const result = (await engine.handle({
          jsonrpc: '2.0',
          id: 1,
          method,
          params,
        })) as JsonRpcFailure;

        expect(result.error.message).toBe('Failure!');
      });
    });
  }
});
