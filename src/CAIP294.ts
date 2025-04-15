import { isObject } from '@metamask/utils';

import type { BaseProviderInfo } from './types';
import { FQDN_REGEX, UUID_V4_REGEX } from './utils';

/**
 * Describes the possible CAIP-294 event names
 */
export enum CAIP294EventNames {
  Announce = 'caip294:wallet_announce',
  Prompt = 'caip294:wallet_prompt',
}

declare global {
  // eslint-disable-next-line @typescript-eslint/consistent-type-definitions
  interface WindowEventMap {
    [CAIP294EventNames.Prompt]: CAIP294RequestWalletEvent;
    [CAIP294EventNames.Announce]: CAIP294AnnounceWalletEvent;
  }
}

/**
 * Represents the protocol/transport supported by the wallet.
 * @type CAIP294Target
 * @property type - The type of the target. SHOULD reference a CAIP number in the `caip-x` format.
 * @property value - The value specifying how to connect to the target as specified by the specification in the `type` property.
 */
export type CAIP294Target = { type: string; value?: unknown };

/**
 * Represents the assets needed to display and identify a wallet.
 * @type CAIP294WalletData
 * @property uuid - A locally unique identifier for the wallet. MUST be a v4 UUID.
 * @property name - The name of the wallet.
 * @property icon - The icon for the wallet. MUST be data URI.
 * @property rdns - The reverse syntax domain name identifier for the wallet.
 * @property targets - The target objects specifying the protocol/transport supported by the wallet.
 */
export type CAIP294WalletData = BaseProviderInfo & {
  targets?: CAIP294Target[];
};

/**
 * Event for requesting a wallet.
 *
 * @type CAIP294RequestWalletEvent
 * @property detail - The detail object of the event.
 * @property type - The name of the event.
 */
export type CAIP294RequestWalletEvent = CustomEvent & {
  detail: {
    id: number;
    jsonrpc: '2.0';
    method: 'wallet_prompt';
    params: Record<string, any>;
  };
  type: CAIP294EventNames.Prompt;
};

/**
 * Event for announcing a wallet.
 *
 * @type CAIP294AnnounceWalletEvent
 * @property detail - The detail object of the event.
 * @property type - The name of the event.
 */
export type CAIP294AnnounceWalletEvent = CustomEvent & {
  detail: {
    id: number;
    jsonrpc: '2.0';
    method: 'wallet_announce';
    params: CAIP294WalletData;
  };
  type: CAIP294EventNames.Announce;
};

/**
 * Validates an {@link CAIP294RequestWalletEvent} object.
 *
 * @param event - The {@link CAIP294RequestWalletEvent} to validate.
 * @returns Whether the {@link CAIP294RequestWalletEvent} is valid.
 */
function isValidRequestWalletEvent(
  event: unknown,
): event is CAIP294RequestWalletEvent {
  return (
    event instanceof CustomEvent &&
    event.type === CAIP294EventNames.Prompt &&
    isObject(event.detail) &&
    event.detail.method === 'wallet_prompt' &&
    isValidWalletPromptParams(event.detail.params)
  );
}

/**
 * Validates a {@link CAIP294RequestWalletEvent} params field.
 *
 * @param params - The parameters to validate.
 * @returns Whether the parameters are valid.
 */
function isValidWalletPromptParams(params: any): params is Record<string, any> {
  const isValidChains =
    params.chains === undefined ||
    (Array.isArray(params.chains) &&
      params.chains.every((chain: any) => typeof chain === 'string'));

  const isValidAuthName =
    params.authName === undefined || typeof params.authName === 'string';

  return isValidChains && isValidAuthName;
}

/**
 * Validates an {@link CAIP294AnnounceWalletEvent} object.
 *
 * @param event - The {@link CAIP294AnnounceWalletEvent} to validate.
 * @returns Whether the {@link CAIP294AnnounceWalletEvent} is valid.
 */
function isValidAnnounceWalletEvent(
  event: unknown,
): event is CAIP294AnnounceWalletEvent {
  return (
    event instanceof CustomEvent &&
    event.type === CAIP294EventNames.Announce &&
    isObject(event.detail) &&
    event.detail.method === 'wallet_announce' &&
    isValidWalletData(event.detail.params)
  );
}

/**
 * Validates an {@link CAIP294Target} object.
 *
 * @param data - The {@link CAIP294Target} to validate.
 * @returns Whether the {@link CAIP294Target} is valid.
 */
function isValidWalletTarget(data: unknown): data is CAIP294Target {
  return isObject(data) && typeof data.type === 'string' && Boolean(data.type);
}

/**
 * Validates an {@link CAIP294WalletData} object.
 *
 * @param data - The {@link CAIP294WalletData} to validate.
 * @returns Whether the {@link CAIP294WalletData} is valid.
 */
function isValidWalletData(data: unknown): data is CAIP294WalletData {
  return (
    isObject(data) &&
    typeof data.uuid === 'string' &&
    UUID_V4_REGEX.test(data.uuid) &&
    typeof data.name === 'string' &&
    Boolean(data.name) &&
    typeof data.icon === 'string' &&
    data.icon.startsWith('data:image') &&
    typeof data.rdns === 'string' &&
    FQDN_REGEX.test(data.rdns) &&
    (data.targets === undefined ||
      (Array.isArray(data.targets) && data.targets.every(isValidWalletTarget)))
  );
}

/**
 * Intended to be used by a wallet. Announces a wallet by dispatching
 * an {@link CAIP294AnnounceWalletEvent}, and listening for
 * {@link CAIP294RequestWalletEvent} to re-announce.
 *
 * @throws If the {@link CAIP294WalletData} is invalid.
 * @param walletData - The {@link CAIP294WalletData} to announce.
 */
export function announceWallet(walletData: CAIP294WalletData): void {
  if (!isValidWalletData(walletData)) {
    throwErrorCAIP294(
      `Invalid CAIP-294 WalletData object received from ${CAIP294EventNames.Prompt}.`,
    );
  }

  const _announceWallet = () =>
    window.dispatchEvent(
      new CustomEvent(CAIP294EventNames.Announce, {
        detail: {
          id: 1,
          jsonrpc: '2.0',
          method: 'wallet_announce',
          params: walletData,
        },
      }),
    );

  _announceWallet();
  window.addEventListener(
    CAIP294EventNames.Prompt,
    (event: CAIP294RequestWalletEvent) => {
      if (!isValidRequestWalletEvent(event)) {
        throwErrorCAIP294(
          `Invalid CAIP-294 RequestWalletEvent object received from ${CAIP294EventNames.Prompt}.`,
        );
      }
      _announceWallet();
    },
  );
}

/**
 * Intended to be used by a dapp. Forwards announced wallet to the
 * provided handler by listening for * {@link CAIP294AnnounceWalletEvent},
 * and dispatches an {@link CAIP294RequestWalletEvent}.
 *
 * @param handleWallet - A function that handles an announced wallet.
 */
export function requestWallet<HandlerReturnType>(
  handleWallet: (walletData: CAIP294WalletData) => HandlerReturnType,
): void {
  window.addEventListener(
    CAIP294EventNames.Announce,
    (event: CAIP294AnnounceWalletEvent) => {
      if (!isValidAnnounceWalletEvent(event)) {
        throwErrorCAIP294(
          `Invalid CAIP-294 WalletData object received from ${CAIP294EventNames.Announce}.`,
        );
      }
      handleWallet(event.detail);
    },
  );

  window.dispatchEvent(
    new CustomEvent(CAIP294EventNames.Prompt, {
      detail: {
        id: 1,
        jsonrpc: '2.0',
        method: 'wallet_prompt',
        params: {},
      },
    }),
  );
}

/**
 * Throws an error with link to CAIP-294 specifications.
 *
 * @param message - The message to include.
 * @throws a friendly error with a link to CAIP-294.
 */
function throwErrorCAIP294(message: string) {
  throw new Error(
    `${message} See https://github.com/ChainAgnostic/CAIPs/blob/bc4942857a8e04593ed92f7dc66653577a1c4435/CAIPs/caip-294.md for requirements.`,
  );
}
