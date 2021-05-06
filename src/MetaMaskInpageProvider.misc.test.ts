import MockDuplexStream from '../mocks/DuplexStream';
import MetaMaskInpageProvider from './MetaMaskInpageProvider';
import messages from './messages';

describe('MetaMaskInpageProvider: Miscellanea', () => {
  describe('constructor', () => {
    beforeAll(() => {
      jest.useFakeTimers();
    });

    afterAll(() => {
      jest.runAllTimers();
    });

    it('succeeds if stream is provided', () => {
      expect(
        () => new MetaMaskInpageProvider(new MockDuplexStream()),
      ).not.toThrow();
    });

    it('succeeds if stream and valid options are provided', () => {
      const stream = new MockDuplexStream();

      expect(
        () =>
          new MetaMaskInpageProvider(stream, {
            maxEventListeners: 10,
          }),
      ).not.toThrow();

      expect(
        () =>
          new MetaMaskInpageProvider(stream, {
            shouldSendMetadata: false,
          }),
      ).not.toThrow();

      expect(
        () =>
          new MetaMaskInpageProvider(stream, {
            maxEventListeners: 10,
            shouldSendMetadata: false,
          }),
      ).not.toThrow();
    });

    it('throws if no or invalid stream is provided', () => {
      expect(() => new MetaMaskInpageProvider(undefined as any)).toThrow(
        messages.errors.invalidDuplexStream(),
      );

      expect(() => new MetaMaskInpageProvider('foo' as any)).toThrow(
        messages.errors.invalidDuplexStream(),
      );

      expect(() => new MetaMaskInpageProvider({} as any)).toThrow(
        messages.errors.invalidDuplexStream(),
      );
    });

    it('accepts valid custom logger', () => {
      const stream = new MockDuplexStream();
      const customLogger = {
        debug: console.debug,
        error: console.error,
        info: console.info,
        log: console.log,
        trace: console.trace,
        warn: console.warn,
      };

      expect(
        () =>
          new MetaMaskInpageProvider(stream, {
            logger: customLogger,
          }),
      ).not.toThrow();
    });
  });

  describe('isConnected', () => {
    it('returns isConnected state', () => {
      jest.useFakeTimers();
      const provider: any = new MetaMaskInpageProvider(new MockDuplexStream());
      provider.autoRefreshOnNetworkChange = false;

      expect(provider.isConnected()).toBe(false);

      provider._state.isConnected = true;

      expect(provider.isConnected()).toBe(true);

      provider._state.isConnected = false;

      expect(provider.isConnected()).toBe(false);

      jest.runAllTimers();
    });
  });
});
