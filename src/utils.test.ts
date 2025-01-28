import { isValidChainId, isValidNetworkVersion } from './utils';

describe('utils', () => {
  describe('isValidChainId', () => {
    it('returns `true` for valid values', () => {
      ['0x1', '0xabc', '0x999'].forEach((value) => {
        expect(isValidChainId(value)).toBe(true);
      });
    });

    it('returns `false` for invalid values', () => {
      ['', '0', 'x', '9', 'abc', null, undefined, true, 2, 0x1, {}].forEach(
        (value) => {
          expect(isValidChainId(value)).toBe(false);
        },
      );
    });
  });

  describe('isValidNetworkVersion', () => {
    it('returns `true` for valid values', () => {
      [
        '1',
        '10',
        '999',
        'loading', // this is a hack that we use
      ].forEach((value) => {
        expect(isValidNetworkVersion(value)).toBe(true);
      });
    });

    it('returns `false` for invalid values', () => {
      ['', null, undefined, true, 2, 0x1, {}].forEach((value) => {
        expect(isValidNetworkVersion(value)).toBe(false);
      });
    });
  });
});
