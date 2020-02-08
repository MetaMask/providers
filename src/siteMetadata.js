
const { errors } = require('./messages')

module.exports = {
  sendSiteMetadata,
}

/**
 * Sends site metadata over an RPC request.
 */
async function sendSiteMetadata (engine) {
  try {
    const domainMetadata = await getSiteMetadata()
    // call engine.handle directly to avoid normal RPC request handling
    engine.handle(
      {
        method: 'wallet_sendDomainMetadata',
        domainMetadata,
      },
      () => {},
    )
  } catch (error) {
    console.error({
      message: errors.sendSiteMetadata(),
      originalError: error,
    })
  }
}

/**
 * Gets site metadata and returns it
 *
 */
async function getSiteMetadata () {
  return {
    name: getSiteName(window),
    icon: await getSiteIcon(window),
  }
}

/**
 * Extracts a name for the site from the DOM
 */
function getSiteName (window) {
  const document = window.document

  const siteName = document.querySelector('head > meta[property="og:site_name"]')
  if (siteName) {
    return siteName.content
  }

  const metaTitle = document.querySelector('head > meta[name="title"]')
  if (metaTitle) {
    return metaTitle.content
  }

  if (document.title && document.title.length > 0) {
    return document.title
  }

  return window.location.hostname
}

/**
 * Extracts an icon for the site from the DOM
 */
async function getSiteIcon (window) {
  const document = window.document

  // Use the site's favicon if it exists
  let icon = document.querySelector('head > link[rel="shortcut icon"]')
  if (icon && await resourceExists(icon.href)) {
    return icon.href
  }

  // Search through available icons in no particular order
  icon = Array.from(document.querySelectorAll('head > link[rel="icon"]'))
    .find((icon) => Boolean(icon.href))
  if (icon && await resourceExists(icon.href)) {
    return icon.href
  }

  return null
}

/**
 * Returns whether the given resource exists
 * @param {string} url the url of the resource
 */
function resourceExists (url) {
  return fetch(url, { method: 'HEAD', mode: 'same-origin' })
    .then(res => res.status === 200)
    .catch(_ => false)
}
