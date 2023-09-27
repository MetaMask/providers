import { announceProvider, requestProvider } from './EIP6963';

const getProviderInfo = () => ({
  uuid: '350670db-19fa-4704-a166-e52e178b59d2',
  name: 'Example Wallet',
  icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"/>',
  rdns: 'com.example.wallet',
});

const providerInfoValidationError = () =>
  new Error(
    'Invalid EIP-6963 ProviderDetail object. See https://eips.ethereum.org/EIPS/eip-6963 for requirements.',
  );

describe('EIP-6963', () => {
  describe('announceProvider', () => {
    describe('provider info validation', () => {
      it('throws if the provider info is not a plain object', () => {
        [null, undefined, Symbol('bar'), []].forEach((invalidInfo) => {
          expect(() => announceProvider(invalidInfo as any)).toThrow(
            providerInfoValidationError(),
          );
        });
      });

      it('throws if the `icon` field is invalid', () => {
        [
          null,
          undefined,
          '',
          'not-a-data-uri',
          'https://example.com/logo.png',
          'data:text/plain;blah',
          Symbol('bar'),
        ].forEach((invalidIcon) => {
          const provider: any = { name: 'test' };
          const providerDetail = { info: getProviderInfo(), provider };
          providerDetail.info.icon = invalidIcon as any;

          expect(() => announceProvider(providerDetail)).toThrow(
            providerInfoValidationError(),
          );
        });
      });

      it('throws if the `name` field is invalid', () => {
        [null, undefined, '', {}, [], Symbol('bar')].forEach((invalidName) => {
          const provider: any = { name: 'test' };
          const providerDetail = { info: getProviderInfo(), provider };
          providerDetail.info.name = invalidName as any;

          expect(() => announceProvider(providerDetail)).toThrow(
            providerInfoValidationError(),
          );
        });
      });

      it('throws if the `uuid` field is invalid', () => {
        [null, undefined, '', 'foo', Symbol('bar')].forEach((invalidUuid) => {
          const provider: any = { name: 'test' };
          const providerDetail = { info: getProviderInfo(), provider };
          providerDetail.info.uuid = invalidUuid as any;

          expect(() => announceProvider(providerDetail)).toThrow(
            providerInfoValidationError(),
          );
        });
      });

      it('throws if the `rdns` field is invalid', () => {
        [
          null,
          undefined,
          '',
          'not-a-valid-domain',
          '..com',
          'com.',
          Symbol('bar'),
        ].forEach((invalidRdns) => {
          const provider: any = { name: 'test' };
          const providerDetail = { info: getProviderInfo(), provider };
          providerDetail.info.rdns = invalidRdns as any;

          expect(() => announceProvider(providerDetail)).toThrow(
            providerInfoValidationError(),
          );
        });
      });
    });

    describe('provider validation', () => {
      it('throws if the provider is not a plain object', () => {
        [null, undefined, Symbol('bar'), []].forEach((invalidProvider) => {
          const provider: any = invalidProvider;
          const providerDetail = { info: getProviderInfo(), provider };

          expect(() => announceProvider(providerDetail)).toThrow(
            providerInfoValidationError(),
          );
        });
      });
    });

    it('should announce a provider', () => {
      const provider: any = { name: 'test' };
      const providerDetail = { info: getProviderInfo(), provider };
      const dispatchEvent = jest.spyOn(window, 'dispatchEvent');
      const addEventListener = jest.spyOn(window, 'addEventListener');

      announceProvider(providerDetail);

      expect(dispatchEvent).toHaveBeenCalledTimes(1);
      expect(dispatchEvent).toHaveBeenCalledWith(
        new CustomEvent('eip6963:announceProvider', {
          detail: {
            info: getProviderInfo(),
            provider,
          },
        }),
      );
      expect(addEventListener).toHaveBeenCalledTimes(1);
      expect(addEventListener).toHaveBeenCalledWith(
        'eip6963:requestProvider',
        expect.any(Function),
      );
    });
  });

  describe('requestProvider', () => {
    it('should receive an announced provider (called before announceProvider)', async () => {
      const provider: any = { name: 'test' };
      const providerDetail = { info: getProviderInfo(), provider };
      const handleProvider = jest.fn();
      const dispatchEvent = jest.spyOn(window, 'dispatchEvent');
      const addEventListener = jest.spyOn(window, 'addEventListener');

      requestProvider(handleProvider);
      announceProvider(providerDetail);
      await delay();

      expect(dispatchEvent).toHaveBeenCalledTimes(2);
      expect(dispatchEvent).toHaveBeenNthCalledWith(
        1,
        new Event('eip6963:requestProvider'),
      );
      expect(dispatchEvent).toHaveBeenNthCalledWith(
        2,
        new CustomEvent('eip6963:announceProvider'),
      );

      expect(addEventListener).toHaveBeenCalledTimes(2);
      expect(addEventListener).toHaveBeenCalledWith(
        'eip6963:announceProvider',
        expect.any(Function),
      );
      expect(addEventListener).toHaveBeenCalledWith(
        'eip6963:requestProvider',
        expect.any(Function),
      );

      expect(handleProvider).toHaveBeenCalledTimes(1);
      expect(handleProvider).toHaveBeenCalledWith({
        info: getProviderInfo(),
        provider,
      });
    });

    it('should receive an announced provider (called after announceProvider)', async () => {
      const provider: any = { name: 'test' };
      const providerDetail = { info: getProviderInfo(), provider };
      const handleProvider = jest.fn();
      const dispatchEvent = jest.spyOn(window, 'dispatchEvent');
      const addEventListener = jest.spyOn(window, 'addEventListener');

      announceProvider(providerDetail);
      requestProvider(handleProvider);
      await delay();

      // Notice that 3 events are dispatched in total when requestProvider is
      // called after announceProvider.
      expect(dispatchEvent).toHaveBeenCalledTimes(3);
      expect(dispatchEvent).toHaveBeenNthCalledWith(
        1,
        new CustomEvent('eip6963:announceProvider'),
      );
      expect(dispatchEvent).toHaveBeenNthCalledWith(
        2,
        new Event('eip6963:requestProvider'),
      );
      expect(dispatchEvent).toHaveBeenNthCalledWith(
        3,
        new CustomEvent('eip6963:announceProvider'),
      );

      expect(addEventListener).toHaveBeenCalledTimes(2);
      expect(addEventListener).toHaveBeenCalledWith(
        'eip6963:announceProvider',
        expect.any(Function),
      );
      expect(addEventListener).toHaveBeenCalledWith(
        'eip6963:requestProvider',
        expect.any(Function),
      );

      expect(handleProvider).toHaveBeenCalledTimes(1);
      expect(handleProvider).toHaveBeenCalledWith({
        info: getProviderInfo(),
        provider,
      });
    });
  });
});

/**
 * Delay for a number of milliseconds by awaiting a promise
 * resolved after the specified number of milliseconds.
 *
 * @param ms - The number of milliseconds to delay for.
 */
async function delay(ms = 1) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
