import { isObject } from '@metamask/utils';

import { BaseProvider } from './BaseProvider';

enum EIP6963EventNames {
  Announce = 'eip6963:announceProvider',
  Request = 'eip6963:requestProvider', // eslint-disable-line @typescript-eslint/no-shadow
}

/**
 * Represents the assets needed to display a wallet
 */
export type EIP6963ProviderInfo = {
  walletId: string;
  uuid: string;
  name: string;
  icon: string;
};

export type EIP6963ProviderDetail = {
  info: EIP6963ProviderInfo;
  provider: BaseProvider;
};

// Requesting an EVM provider
export type EIP6963RequestProviderEvent = Event & {
  type: EIP6963EventNames.Request;
};

// Annoucing an EVM provider
export type EIP6963AnnounceProviderEvent = CustomEvent & {
  type: EIP6963EventNames.Announce;
  detail: EIP6963ProviderDetail;
};

/**
 * Forwards every announced provider to the provided handler by listening for
 * {@link EIP6963AnnounceProviderEvent}, and dispatches an
 * {@link EIP6963RequestProviderEvent}.
 *
 * @param handleProvider - A function that handles an announced provider.
 */
export function requestProvider<HandlerReturnType>(
  handleProvider: (providerDetail: EIP6963ProviderDetail) => HandlerReturnType,
): void {
  window.addEventListener(
    EIP6963EventNames.Announce as any,
    (event: EIP6963AnnounceProviderEvent) => {
      if (
        event.type === EIP6963EventNames.Announce &&
        isObject(event.detail?.provider)
      ) {
        handleProvider(event.detail);
      }
    },
  );

  window.dispatchEvent(new Event(EIP6963EventNames.Request));
}

/**
 * Announces a provider by dispatching an {@link EIP6963AnnounceProviderEvent}, and
 * listening for {@link EIP6963RequestProviderEvent} to re-announce.
 *
 * @param providerDetail - The {@link EIP6963ProviderDetail} to announce.
 * @param providerDetail.info - The {@link EIP6963ProviderInfo} to announce.
 * @param providerDetail.provider - The provider to announce.
 */
export function announceProvider({
  info,
  provider,
}: EIP6963ProviderDetail): void {
  const _announceProvider = () =>
    window.dispatchEvent(
      new CustomEvent(EIP6963EventNames.Announce, {
        detail: { info: { ...info }, provider },
      }),
    );

  _announceProvider();
  window.addEventListener(
    EIP6963EventNames.Request as any,
    (_event: EIP6963RequestProviderEvent) => {
      _announceProvider();
    },
  );
}
