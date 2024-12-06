import {
  announceWallet,
  CAIP294EventNames,
  type CAIP294WalletData,
  requestWallet,
} from './CAIP294';

const getWalletData = (): CAIP294WalletData => ({
  uuid: '350670db-19fa-4704-a166-e52e178b59d2',
  name: 'Example Wallet',
  icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"/>',
  rdns: 'com.example.wallet',
  extensionId: 'abcdefghijklmnopqrstuvwxyz',
});

const walletDataValidationError = () =>
  new Error(
    `Invalid CAIP-294 WalletData object received from ${CAIP294EventNames.Prompt}. See https://github.com/ChainAgnostic/CAIPs/blob/bc4942857a8e04593ed92f7dc66653577a1c4435/CAIPs/caip-294.md for requirements.`,
  );

describe('CAIP-294', () => {
  describe('wallet data validation', () => {
    it('throws if the wallet data is not a plain object', () => {
      [null, undefined, Symbol('bar'), []].forEach((invalidInfo) => {
        expect(() => announceWallet(invalidInfo as any)).toThrow(
          walletDataValidationError(),
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
        const walletInfo = getWalletData();
        walletInfo.icon = invalidIcon as any;

        expect(() => announceWallet(walletInfo)).toThrow(
          walletDataValidationError(),
        );
      });
    });

    it('throws if the `name` field is invalid', () => {
      [null, undefined, '', {}, [], Symbol('bar')].forEach((invalidName) => {
        const walletInfo = getWalletData();
        walletInfo.name = invalidName as any;

        expect(() => announceWallet(walletInfo)).toThrow(
          walletDataValidationError(),
        );
      });
    });

    it('throws if the `uuid` field is invalid', () => {
      [null, undefined, '', 'foo', Symbol('bar')].forEach((invalidUuid) => {
        const walletInfo = getWalletData();
        walletInfo.uuid = invalidUuid as any;

        expect(() => announceWallet(walletInfo)).toThrow(
          walletDataValidationError(),
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
        const walletInfo = getWalletData();
        walletInfo.rdns = invalidRdns as any;

        expect(() => announceWallet(walletInfo)).toThrow(
          walletDataValidationError(),
        );
      });
    });

    it('allows `extensionId` to be undefined or a string', () => {
      const walletInfo = getWalletData();
      expect(() => announceWallet(walletInfo)).not.toThrow();

      delete walletInfo.extensionId;

      expect(() => announceWallet(walletInfo)).not.toThrow();

      walletInfo.extensionId = 'valid-string';
      expect(() => announceWallet(walletInfo)).not.toThrow();
    });
  });

  it('wallet is announced before dapp requests', async () => {
    const walletData = getWalletData();
    const handleWallet = jest.fn();
    const dispatchEvent = jest.spyOn(window, 'dispatchEvent');
    const addEventListener = jest.spyOn(window, 'addEventListener');

    announceWallet(walletData);
    requestWallet(handleWallet);
    await delay();

    expect(dispatchEvent).toHaveBeenCalledTimes(3);
    expect(dispatchEvent).toHaveBeenNthCalledWith(
      1,
      new CustomEvent(CAIP294EventNames.Announce, expect.any(Object)),
    );
    expect(dispatchEvent).toHaveBeenNthCalledWith(
      2,
      new CustomEvent(CAIP294EventNames.Prompt, expect.any(Object)),
    );
    expect(dispatchEvent).toHaveBeenNthCalledWith(
      3,
      new CustomEvent(CAIP294EventNames.Announce, expect.any(Object)),
    );

    expect(addEventListener).toHaveBeenCalledTimes(2);
    expect(addEventListener).toHaveBeenCalledWith(
      CAIP294EventNames.Announce,
      expect.any(Function),
    );
    expect(addEventListener).toHaveBeenCalledWith(
      CAIP294EventNames.Prompt,
      expect.any(Function),
    );

    expect(handleWallet).toHaveBeenCalledTimes(1);
    expect(handleWallet).toHaveBeenCalledWith(
      expect.objectContaining({ params: walletData }),
    );
  });

  it('dapp requests before wallet is announced', async () => {
    const walletData = getWalletData();
    const handleWallet = jest.fn();
    const dispatchEvent = jest.spyOn(window, 'dispatchEvent');
    const addEventListener = jest.spyOn(window, 'addEventListener');

    requestWallet(handleWallet);
    announceWallet(walletData);
    await delay();

    expect(dispatchEvent).toHaveBeenCalledTimes(2);
    expect(dispatchEvent).toHaveBeenNthCalledWith(
      1,
      new CustomEvent(CAIP294EventNames.Prompt, expect.any(Object)),
    );
    expect(dispatchEvent).toHaveBeenNthCalledWith(
      2,
      new CustomEvent(CAIP294EventNames.Announce, expect.any(Object)),
    );

    expect(addEventListener).toHaveBeenCalledTimes(2);
    expect(addEventListener).toHaveBeenCalledWith(
      CAIP294EventNames.Announce,
      expect.any(Function),
    );
    expect(addEventListener).toHaveBeenCalledWith(
      CAIP294EventNames.Prompt,
      expect.any(Function),
    );

    expect(handleWallet).toHaveBeenCalledTimes(1);
    expect(handleWallet).toHaveBeenCalledWith(
      expect.objectContaining({ params: walletData }),
    );
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
