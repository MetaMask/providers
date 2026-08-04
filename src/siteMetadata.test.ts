import type { JsonRpcEngine } from '@metamask/json-rpc-engine';

import { sendSiteMetadata } from './siteMetadata';

describe('sendSiteMetadata', () => {
  it('sends site metadata from the DOM', async () => {
    const meta = globalThis.document.createElement('meta');
    meta.setAttribute('property', 'og:site_name');
    meta.content = 'Test Site';
    globalThis.document.head.appendChild(meta);

    const handle = jest.fn();
    await sendSiteMetadata({ handle } as unknown as JsonRpcEngine, console);

    expect(handle).toHaveBeenCalledTimes(1);
    expect(handle).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'metamask_sendDomainMetadata',
        params: {
          name: 'Test Site',
          icon: null,
        },
      }),
      expect.any(Function),
    );
  });

  it('falls back to the hostname if there is no document, e.g. in an extension background script', async () => {
    const documentSpy = jest
      .spyOn(globalThis, 'document', 'get')
      .mockReturnValue(undefined as unknown as Document);

    const handle = jest.fn();
    await sendSiteMetadata({ handle } as unknown as JsonRpcEngine, console);

    expect(handle).toHaveBeenCalledTimes(1);
    expect(handle).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'metamask_sendDomainMetadata',
        params: {
          name: globalThis.location.hostname,
          icon: null,
        },
      }),
      expect.any(Function),
    );

    documentSpy.mockRestore();
  });
});
