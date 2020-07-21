
const { errors } = require('./messages')
const { NOOP } = require('./utils')

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
      NOOP,
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
 */
async function getSiteIcon (window) {
  const { document } = window

  const icons = document.querySelectorAll('head > link[rel~="icon"]')
  for (const icon of icons) {
    if (icon && await resourceExists(icon.href)) {
      return true
    }
  }

  return null
}

/**
 * Returns whether the given resource exists
 * @param {string} url the url of the resource
 * @return {Promise<boolean>} whether the resource exists
 */
function resourceExists (url) {
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
