import { isObject } from '@metamask/utils';

import { BaseProvider } from './BaseProvider';

enum EIP6963EventNames {
  Announce = 'eip6963:announceProvider',
  Request = 'eip6963:requestProvider', // eslint-disable-line @typescript-eslint/no-shadow
}

/**
 * Represents the assets needed to display and identify a wallet.
 */
export type EIP6963ProviderInfo = {
  /**
   * A locally unique identifier for the wallet. MUST be a v4 UUID.
   */
  uuid: string;
  /**
   * The name of the wallet.
   */
  name: string;
  /**
   * The URL of an icon for the wallet.
   */
  icon: string;
};

/**
 * Represents a provider and the information relevant for the dapp.
 */
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
      if (!isValidAnnounceProviderEvent(event)) {
        throwErrorEIP6963(`Invalid EIP-6963 AnnounceProviderEvent object received from ${EIP6963EventNames.Announce} event.`);
      }
      handleProvider(event.detail);
    },
  );

  window.dispatchEvent(new Event(EIP6963EventNames.Request));
}

/**
 * Courtesy https://github.com/thenativeweb/uuidv4/blob/bdcf3a3138bef4fb7c51f389a170666f9012c478/lib/uuidv4.ts#L5
 */
const UUID_V4_REGEX =
  /(?:^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[a-f0-9]{4}-[a-f0-9]{12}$)|(?:^0{8}-0{4}-0{4}-0{4}-0{12}$)/u;

/**
 * Announces a provider by dispatching an {@link EIP6963AnnounceProviderEvent}, and
 * listening for {@link EIP6963RequestProviderEvent} to re-announce.
 *
 * @throws If the {@link EIP6963ProviderDetail} is invalid.
 * @param providerDetail - The {@link EIP6963ProviderDetail} to announce.
 * @param providerDetail.info - The {@link EIP6963ProviderInfo} to announce.
 * @param providerDetail.provider - The provider to announce.
 */
export function announceProvider(providerDetail: EIP6963ProviderDetail): void {
  if (!isValidProviderDetail(providerDetail)) {
    throwErrorEIP6963('Invalid EIP-6963 ProviderDetail object.');
  }
  const { info, provider } = providerDetail;

  const _announceProvider = () =>
    window.dispatchEvent(
      new CustomEvent(EIP6963EventNames.Announce, {
        detail: Object.freeze({ info: { ...info }, provider }),
      }),
    );

  _announceProvider();
  window.addEventListener(
    EIP6963EventNames.Request as any,
    (event: EIP6963RequestProviderEvent) => {
      if (!isValidRequestProviderEvent(event)) {
        throwErrorEIP6963(`Invalid EIP-6963 RequestProviderEvent object received from ${EIP6963EventNames.Request} event.`);
      }
      _announceProvider();
    },
  );
}

/**
 * Validates an {@link EIP6963RequestProviderEvent} object.
 *
 * @param event - The {@link EIP6963RequestProviderEvent} to validate.
 * @returns Whether the {@link EIP6963RequestProviderEvent} is valid.
 */
function isValidRequestProviderEvent(
  event: unknown,
): event is EIP6963RequestProviderEvent {
  const providerEvent = event as EIP6963RequestProviderEvent;

  return (
    providerEvent instanceof Event &&
    providerEvent.type === EIP6963EventNames.Request
  );
}

/**
 * Validates an {@link EIP6963AnnounceProviderEvent} object.
 *
 * @param event - The {@link EIP6963AnnounceProviderEvent} to validate.
 * @returns Whether the {@link EIP6963AnnounceProviderEvent} is valid.
 */
function isValidAnnounceProviderEvent(
  event: unknown,
): event is EIP6963AnnounceProviderEvent {
  const providerEvent = event as EIP6963AnnounceProviderEvent;

  return (
    providerEvent instanceof CustomEvent &&
    providerEvent.type === EIP6963EventNames.Announce &&
    Object.isFrozen(providerEvent.detail) &&
    isValidProviderDetail(providerEvent.detail)
  );
}

/**
 * Validates an {@link EIP6963ProviderDetail} object.
 *
 * @param providerDetail - The {@link EIP6963ProviderDetail} to validate.
 * @returns Whether the {@link EIP6963ProviderDetail} is valid.
 */
function isValidProviderDetail(
  providerDetail: unknown,
): providerDetail is EIP6963ProviderDetail {
  if (
    !isObject(providerDetail) ||
    !isObject(providerDetail.info) ||
    !isObject(providerDetail.provider)
  ) {
    return false;
  }
  const { info } = providerDetail as EIP6963ProviderDetail;

  return (
    typeof info.icon === 'string' &&
    isValidUrl(info.icon) &&
    typeof info.name === 'string' &&
    Boolean(info.name) &&
    typeof info.uuid === 'string' &&
    UUID_V4_REGEX.test(info.uuid)
  );
}

/**
 * Checks if a string is a valid URL.
 *
 * @param url - The string to check.
 * @returns Whether the string is a valid URL.
 */
function isValidUrl(url: string) {
  try {
    // eslint-disable-next-line no-new
    new URL(url);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Throws an error with link to EIP-6963 specifications.
 *
 * @param message - The message to include.
 * @throws a friendly error with a link to EIP-6963.
 */
function throwErrorEIP6963(message: string) {
  throw new Error(
    `${message} See https://eips.ethereum.org/EIPS/eip-6963 for requirements.`,
  );
}
