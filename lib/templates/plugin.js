import { Minimatch } from 'minimatch'

/**
 * @class Fb
 * fix nuxt-facebook-pixel-module 
 * This change adds event queuing until the Facebook sdk is loaded
 */
class Fb {
  constructor (options) {
    this.eventsQueue = []
    this.fqbLoaded = false
    this.options = options
    this.fbq = null

    this.isEnabled = !options.disabled
  }

  setFbq (fbq) {
    this.fbq = fbq
    this.fqbLoaded = true

    this.send()
  }

  setPixelId (pixelId) {
    this.options.pixelId = pixelId
    this.init()
  }

  /**
   * @method enable
   */
  enable () {
    this.isEnabled = true
    this.init()
    this.track()
  }

  /**
   * @method disable
   */
  disable () {
    this.isEnabled = false
  }

  /**
   * @method init
   */
  init () {
    this.query('init', this.options.pixelId)
  }

  /**
   * @method track
   */
  track (event = null, parameters = null) {
    if (!event) {
      event = this.options.track
    }

    this.query('track', event, parameters)
  }

  /**
   * @method query
   * @param {string} cmd
   * @param {object} option
   * @param {object} parameters
   */
  query (cmd, option, parameters = null) {
    if (this.options.debug) log('Command:', cmd, 'Option:', option, 'Additional parameters:', parameters)
    if (!this.isEnabled) return

    this.eventsQueue.push({
      cmd,
      option,
      parameters
    })

    this.send()
  }

  send () {
    if (!this.fqbLoaded) {
      return
    }

    while (this.eventsQueue.length) {
      let event = this.eventsQueue.shift()

      if (this.options.debug) log('Send event: ', event)

      if (event.parameters) {
        this.fbq(event.cmd, event.option, event.parameters)
      } else {
        this.fbq(event.cmd, event.option)
      }
    }
  }
}

function getMatchingPixel (options, path) {
  return options.pixels.find(pixel => {
    const routeIndex = pixel.routes.findIndex(route => {
      const minimatch = new Minimatch(route)
      return minimatch.match(path)
    })

    return routeIndex !== -1
  })
}

function log (...messages) {
  console.info.apply(this, ['[nuxt-facebook-pixel-module]', ...messages])
}

export default (ctx, inject) => {
  const parsedOptions = <%= JSON.stringify(options) %>
  const isDev = parsedOptions.dev && !parsedOptions.debug

  if (isDev) log('You are running in development mode. Set "debug: true" in your nuxt.config.js if you would like to trigger tracking events in local.')

  const { path } = ctx.route
  const matchingPixel = getMatchingPixel(parsedOptions, path)

  const pixelOptions = Object.assign({}, matchingPixel || parsedOptions)

  const instance = new Fb(pixelOptions)

  /* eslint-disable */
  if (typeof window !== 'undefined') {
    ((f, b, e, v, n, t, s) => {
      if (f.fbq) return; n = f.fbq = function () {
        n.callMethod ?
          n.callMethod.apply(n, arguments) : n.queue.push(arguments)
      };
      if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = pixelOptions.version;
      n.queue = [];
      t = b.createElement(e);
      t.async = true;
      t.defer = true;
      t.src = v;
      s = b.getElementsByTagName('body')[0];
      s.parentNode.appendChild(t, s);

      let onLoadCallback = () => {
        instance.setFbq(fbq)

        if (!isDev && !pixelOptions.disabled) {
          if (pixelOptions.manualMode) {
            fbq('set', 'autoConfig', false, pixelOptions.pixelId)
          }

          fbq('init', pixelOptions.pixelId)
          fbq('track', pixelOptions.track)
        }
      }

      if (t.readyState) {
        t.onreadystatechange = function() {
          if (t.readyState === "loaded" || t.readyState === "complete") {
            t.onreadystatechange = null;
            onLoadCallback();
          }
        }
      }else {
        t.onload = onLoadCallback
      }
    })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
  }
  /* eslint-enable */

  if (ctx.app && ctx.app.router) {
    const router = ctx.app.router
    router.afterEach(({ path }) => {
      /**
       * Change the current pixelId according to the route.
       */
      const matchingPixel = getMatchingPixel(parsedOptions, path)

      const pixelOptions = Object.assign({}, matchingPixel || parsedOptions)
      if (pixelOptions.pixelId !== instance.options.pixelId) {
        instance.setPixelId(pixelOptions.pixelId)
      }

      /**
       * Automatically track PageView
       */
      if (parsedOptions.autoPageView) {
        instance.track('PageView')
      }
    })
  }

  /* eslint-enable */
  ctx.$fb = instance
  inject('fb', instance)
}
