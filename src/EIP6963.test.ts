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

  it('provider is initialized before dapp', async () => {
    const provider: any = { name: 'test' };
    const providerDetail = { info: getProviderInfo(), provider };
    const handleProvider = jest.fn();
    const dispatchEvent = jest.spyOn(window, 'dispatchEvent');
    const addEventListener = jest.spyOn(window, 'addEventListener');

    announceProvider(providerDetail);
    requestProvider(handleProvider);
    await delay();

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

  it('dapp is initialized before provider', async () => {
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
