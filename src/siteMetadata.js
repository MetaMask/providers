
const { errors } = require('./messages')
const { NOOP } = require('./utils')

module.exports = {
  sendSiteMetadata,
}

/**
 * Sends site metadata over an RPC request.
 *
 * @param {JsonRpcEngine} engine - The JSON RPC Engine to send metadata over.
 * @param {Object} log - The logging API to use.
 */
async function sendSiteMetadata (engine, log) {
  try {
    const domainMetadata = await getSiteMetadata()
    // call engine.handle directly to avoid normal RPC request handling
    engine.handle(
      {
        method: 'wallet_sendDomainMetadata',
        domainMetadata,
      },
      NOOP,
    )
  } catch (error) {
    log.error({
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
  const { document } = window

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
 * @returns {string|null} an icon URL
 */
async function getSiteIcon (window) {
  const { document } = window

  const icons = document.querySelectorAll('head > link[rel~="icon"]')
  for (const icon of icons) {
    if (icon && await imgExists(icon.href)) {
      return icon.href
    }
  }

  return null
}

/**
 * Returns whether the given image URL exists
 * @param {string} url - the url of the image
 * @return {Promise<boolean>} whether the image exists
 */
function imgExists (url) {
  return new Promise((resolve, reject) => {
    try {
      const img = document.createElement('img')
      img.onload = () => resolve(true)
      img.onerror = () => resolve(false)
      img.src = url
    } catch (e) {
      reject(e)
    }
  })
}
