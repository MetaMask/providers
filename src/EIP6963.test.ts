/* eslint-disable no-restricted-globals */

import {
  announceProvider,
  requestProvider,
  MetaMaskEIP6963ProviderInfo,
} from './EIP6963';

describe('EIP6963', () => {
  describe('MetaMaskEIP6963ProviderInfo', () => {
    it('has expected shape and values', () => {
      expect(MetaMaskEIP6963ProviderInfo).toStrictEqual({
        walletId: 'io.metamask',
        uuid: expect.any(String),
        name: 'MetaMask',
        icon: 'https://raw.githubusercontent.com/MetaMask/brand-resources/cb6fd847f3a9cc5e231c749383c3898935e62eab/SVG/metamask-fox.svg',
      });
    });
  });

  describe('announceProvider', () => {
    it('should announce a provider', () => {
      const provider = { name: 'test' };
      const dispatchEvent = jest.spyOn(window, 'dispatchEvent');
      const addEventListener = jest.spyOn(window, 'addEventListener');

      announceProvider(provider as any);

      expect(dispatchEvent).toHaveBeenCalledTimes(1);
      expect(dispatchEvent).toHaveBeenCalledWith(
        new CustomEvent('eip6963:announceProvider', {
          detail: {
            info: MetaMaskEIP6963ProviderInfo,
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

    it('should not be affected by modifying MetaMaskEIP6963ProviderInfo', () => {
      const provider = { name: 'test' };
      const dispatchEvent = jest.spyOn(window, 'dispatchEvent');
      const addEventListener = jest.spyOn(window, 'addEventListener');

      const { walletId } = MetaMaskEIP6963ProviderInfo;
      (MetaMaskEIP6963ProviderInfo as any).walletId = 'foo';
      announceProvider(provider as any);

      expect(dispatchEvent).toHaveBeenCalledTimes(1);
      expect(dispatchEvent).toHaveBeenCalledWith(
        new CustomEvent('eip6963:announceProvider', {
          detail: {
            info: { ...MetaMaskEIP6963ProviderInfo, walletId },
            provider,
          },
        }),
      );
      expect((dispatchEvent as any).mock.calls[0][0].detail).toStrictEqual({
        info: { ...MetaMaskEIP6963ProviderInfo, walletId },
        provider,
      });

      expect(addEventListener).toHaveBeenCalledTimes(1);
      expect(addEventListener).toHaveBeenCalledWith(
        'eip6963:requestProvider',
        expect.any(Function),
      );

      // Reset
      (MetaMaskEIP6963ProviderInfo as any).walletId = walletId;
    });
  });

  describe('requestProvider', () => {
    it('should receive an announced provider (called before announceProvider)', async () => {
      const provider: any = { name: 'test' };
      const handleProvider = jest.fn();
      const dispatchEvent = jest.spyOn(window, 'dispatchEvent');
      const addEventListener = jest.spyOn(window, 'addEventListener');

      requestProvider(handleProvider);
      announceProvider(provider);
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
        info: MetaMaskEIP6963ProviderInfo,
        provider,
      });
    });

    it('should receive an announced provider (called after announceProvider)', async () => {
      const provider: any = { name: 'test' };
      const handleProvider = jest.fn();
      const dispatchEvent = jest.spyOn(window, 'dispatchEvent');
      const addEventListener = jest.spyOn(window, 'addEventListener');

      announceProvider(provider);
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
        info: MetaMaskEIP6963ProviderInfo,
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
