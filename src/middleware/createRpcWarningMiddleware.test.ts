import { JsonRpcEngine } from '@metamask/json-rpc-engine';
import {
  Json,
  JsonRpcFailure,
  JsonRpcParams,
  JsonRpcRequest,
  JsonRpcSuccess,
} from '@metamask/utils';

import { createRpcWarningMiddleware } from './createRpcWarningMiddleware';
import messages from '../messages';

type Scenario = {
  scenario: string;
  method: string;
  warning?: string;
  params?: JsonRpcParams;
};

const affected: Scenario[] = [
  {
    scenario: 'eth_decrypt',
    method: 'eth_decrypt',
    warning: messages.warnings.rpc.ethDecryptDeprecation,
  },
  {
    scenario: 'eth_getEncryptionPublicKey',
    method: 'eth_getEncryptionPublicKey',
    warning: messages.warnings.rpc.ethGetEncryptionPublicKeyDeprecation,
  },
  {
    scenario: 'wallet_watchAsset with `type: "ERC721"`',
    method: 'wallet_watchAsset',
    params: {
      type: 'ERC721',
      options: {},
    },
    warning: messages.warnings.rpc.walletWatchAssetNFTExperimental,
  },
  {
    scenario: 'wallet_watchAsset with `type: "ERC1155"`',
    method: 'wallet_watchAsset',
    params: {
      type: 'ERC1155',
      options: {},
    },
    warning: messages.warnings.rpc.walletWatchAssetNFTExperimental,
  },
];

const unaffected: Scenario[] = [
  {
    scenario: 'eth_chainId',
    method: 'eth_chainId',
  },
  {
    scenario: 'wallet_watchAsset with `type: "ERC20"`',
    method: 'wallet_watchAsset',
    params: {
      type: 'ERC20',
      options: {},
    },
  },
];

describe('createRpcWarningMiddleware', () => {
  describe.each(affected)(
    '$scenario',
    ({ method, params = {}, warning }: Scenario) => {
      it('should warn the first time the method is called', async () => {
        const consoleWarnSpy = jest.spyOn(globalThis.console, 'warn');
        const middleware = createRpcWarningMiddleware(globalThis.console);
        const engine = new JsonRpcEngine();
        engine.push(middleware);

        await engine.handle({
          jsonrpc: '2.0',
          id: 1,
          method,
          params,
        } as JsonRpcRequest);
        expect(consoleWarnSpy).toHaveBeenCalledWith(warning);
        expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
      });

      it('should not warn the second time the method is called', async () => {
        const consoleWarnSpy = jest.spyOn(globalThis.console, 'warn');
        const middleware = createRpcWarningMiddleware(globalThis.console);
        const engine = new JsonRpcEngine();
        engine.push(middleware);

        await engine.handle({
          jsonrpc: '2.0',
          id: 1,
          method,
          params,
        } as JsonRpcRequest);
        await engine.handle({
          jsonrpc: '2.0',
          id: 1,
          method,
          params,
        } as JsonRpcRequest);

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
        })) as JsonRpcSuccess<Json>;

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

        expect(result.error.message).toBe('Internal JSON-RPC error.');
      });
    },
  );

  describe.each(unaffected)('$scenario', ({ method, params = {} }) => {
    it('should not issue a warning', async () => {
      const consoleWarnSpy = jest.spyOn(globalThis.console, 'warn');
      const middleware = createRpcWarningMiddleware(globalThis.console);
      const engine = new JsonRpcEngine();
      engine.push(middleware);

      await engine.handle({
        jsonrpc: '2.0',
        id: 1,
        method,
        params,
      } as JsonRpcRequest);

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
      } as JsonRpcRequest)) as JsonRpcSuccess<Json>;

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
      } as JsonRpcRequest)) as JsonRpcFailure;

      expect(result.error.message).toBe('Internal JSON-RPC error.');
    });
  });
});
