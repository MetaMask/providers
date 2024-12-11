/**
 * Represents the base assets needed to display and identify a wallet.
 *
 * @type BaseProviderInfo
 * @property uuid - A locally unique identifier for the wallet. MUST be a v4 UUID.
 * @property name - The name of the wallet.
 * @property icon - The icon for the wallet. MUST be data URI.
 * @property rdns - The reverse syntax domain name identifier for the wallet.
 */
export type BaseProviderInfo = {
  uuid: string;
  name: string;
  icon: string;
  rdns: string;
};
