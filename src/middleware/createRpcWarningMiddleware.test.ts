import { JsonRpcEngine, JsonRpcFailure, JsonRpcSuccess } from 'json-rpc-engine';
import messages from '../messages';
import { createRpcWarningMiddleware } from './createRpcWarningMiddleware';

const warnings = [
  {
    method: 'eth_decrypt',
    warning: messages.warnings.rpc.ethDecryptDeprecation,
  },
  {
    method: 'eth_getEncryptionPublicKey',
    warning: messages.warnings.rpc.ethGetEncryptionPublicKeyDeprecation,
  },
];

describe('createRpcWarningMiddleware', () => {
  for (const { method, warning } of warnings) {
    describe(method, () => {
      it('should warn the first time the method is called', async () => {
        const consoleWarnSpy = jest.spyOn(globalThis.console, 'warn');
        const middleware = createRpcWarningMiddleware(globalThis.console);
        const engine = new JsonRpcEngine();
        engine.push(middleware);

        await engine.handle({ jsonrpc: '2.0', id: 1, method });

        expect(consoleWarnSpy).toHaveBeenCalledWith(warning);
        expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
      });

      it('should not warn the second time the method is called', async () => {
        const consoleWarnSpy = jest.spyOn(globalThis.console, 'warn');
        const middleware = createRpcWarningMiddleware(globalThis.console);
        const engine = new JsonRpcEngine();
        engine.push(middleware);

        await engine.handle({ jsonrpc: '2.0', id: 1, method });
        await engine.handle({ jsonrpc: '2.0', id: 1, method });

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

  describe('unaffected method', () => {
    it('should not issue a warning', async () => {
      const consoleWarnSpy = jest.spyOn(globalThis.console, 'warn');
      const middleware = createRpcWarningMiddleware(globalThis.console);
      const engine = new JsonRpcEngine();
      engine.push(middleware);

      await engine.handle({ jsonrpc: '2.0', id: 1, method: 'eth_chainId' });

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
        method: 'eth_chainId',
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
        method: 'eth_chainId',
      })) as JsonRpcFailure;

      expect(result.error.message).toBe('Failure!');
    });
  });
});
