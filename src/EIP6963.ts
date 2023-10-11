import { isObject } from '@metamask/utils';

import { BaseProvider } from './BaseProvider';

/**
 * Describes the possible EIP-6963 event names
 */
enum EIP6963EventNames {
  Announce = 'eip6963:announceProvider',
  Request = 'eip6963:requestProvider', // eslint-disable-line @typescript-eslint/no-shadow
}

declare global {
  // eslint-disable-next-line @typescript-eslint/consistent-type-definitions
  interface WindowEventMap {
    [EIP6963EventNames.Request]: EIP6963RequestProviderEvent;
    [EIP6963EventNames.Announce]: EIP6963AnnounceProviderEvent;
  }
}

/**
 * Represents the assets needed to display and identify a wallet.
 *
 * @type EIP6963ProviderInfo
 * @property uuid - A locally unique identifier for the wallet. MUST be a v4 UUID.
 * @property name - The name of the wallet.
 * @property icon - The icon for the wallet. MUST be data URI.
 * @property rdns - The reverse syntax domain name identifier for the wallet.
 */
export type EIP6963ProviderInfo = {
  uuid: string;
  name: string;
  icon: string;
  rdns: string;
};

/**
 * Represents a provider and the information relevant for the dapp.
 *
 * @type EIP6963ProviderDetail
 * @property info - The EIP6963ProviderInfo object.
 * @property provider - The provider instance.
 */
export type EIP6963ProviderDetail = {
  info: EIP6963ProviderInfo;
  provider: BaseProvider;
};

/**
 * Event for requesting an EVM provider.
 *
 * @type EIP6963RequestProviderEvent
 * @property type - The name of the event.
 */
export type EIP6963RequestProviderEvent = Event & {
  type: EIP6963EventNames.Request;
};

/**
 * Event for announcing an EVM provider.
 *
 * @type EIP6963RequestProviderEvent
 * @property type - The name of the event.
 * @property detail - The detail object of the event.
 */
export type EIP6963AnnounceProviderEvent = CustomEvent & {
  type: EIP6963EventNames.Announce;
  detail: EIP6963ProviderDetail;
};

// https://github.com/thenativeweb/uuidv4/blob/bdcf3a3138bef4fb7c51f389a170666f9012c478/lib/uuidv4.ts#L5
const UUID_V4_REGEX =
  /(?:^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[a-f0-9]{4}-[a-f0-9]{12}$)|(?:^0{8}-0{4}-0{4}-0{4}-0{12}$)/u;

// https://stackoverflow.com/a/20204811
const FQDN_REGEX =
  /(?=^.{4,253}$)(^((?!-)[a-zA-Z0-9-]{0,62}[a-zA-Z0-9]\.)+[a-zA-Z]{2,63}$)/u;

/**
 * Intended to be used by a dapp. Forwards every announced provider to the
 * provided handler by listening for * {@link EIP6963AnnounceProviderEvent},
 * and dispatches an {@link EIP6963RequestProviderEvent}.
 *
 * @param handleProvider - A function that handles an announced provider.
 */
export function requestProvider<HandlerReturnType>(
  handleProvider: (providerDetail: EIP6963ProviderDetail) => HandlerReturnType,
): void {
  window.addEventListener(
    EIP6963EventNames.Announce,
    (event: EIP6963AnnounceProviderEvent) => {
      if (!isValidAnnounceProviderEvent(event)) {
        throwErrorEIP6963(
          `Invalid EIP-6963 AnnounceProviderEvent object received from ${EIP6963EventNames.Announce} event.`,
        );
      }
      handleProvider(event.detail);
    },
  );

  window.dispatchEvent(new Event(EIP6963EventNames.Request));
}

/**
 * Intended to be used by a wallet. Announces a provider by dispatching
 * an {@link EIP6963AnnounceProviderEvent}, and listening for
 * {@link EIP6963RequestProviderEvent} to re-announce.
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
    EIP6963EventNames.Request,
    (event: EIP6963RequestProviderEvent) => {
      if (!isValidRequestProviderEvent(event)) {
        throwErrorEIP6963(
          `Invalid EIP-6963 RequestProviderEvent object received from ${EIP6963EventNames.Request} event.`,
        );
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
  return event instanceof Event && event.type === EIP6963EventNames.Request;
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
  return (
    event instanceof CustomEvent &&
    event.type === EIP6963EventNames.Announce &&
    Object.isFrozen(event.detail) &&
    isValidProviderDetail(event.detail)
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
  const { info } = providerDetail;

  return (
    typeof info.uuid === 'string' &&
    UUID_V4_REGEX.test(info.uuid) &&
    typeof info.name === 'string' &&
    Boolean(info.name) &&
    typeof info.icon === 'string' &&
    info.icon.startsWith('data:image') &&
    typeof info.rdns === 'string' &&
    FQDN_REGEX.test(info.rdns)
  );
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
