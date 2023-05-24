import { announceProvider, requestProvider } from './EIP6963';

const getProviderInfo = () => ({
  name: 'test',
  icon: 'https://wallet.io/icon.svg',
  walletId: 'testWalletId',
  uuid: 'testUuid',
});

describe('EIP6963', () => {
  describe('announceProvider', () => {
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
      expect(dispatchEvent).toHaveBeenCalledWith(
        new Event('eip6963:requestProvider'),
      );
      expect(dispatchEvent).toHaveBeenCalledWith(
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
      expect(dispatchEvent).toHaveBeenCalledWith(
        new Event('eip6963:requestProvider'),
      );
      expect(dispatchEvent).toHaveBeenCalledWith(
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
