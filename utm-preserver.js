/**
 * UTM Passthrough Library
 * -----------------------
 * Captures UTM parameters from the landing URL, persists them across the
 * session (localStorage + root-domain cookie), pushes them to the GTM dataLayer,
 * and re-attaches them to any outbound link that points to the Shopify checkout
 * domain (or any configured destination).
 *
 * This solves the problem where Framer strips UTM params during the handoff to
 * shop.celltheory.com / Seal Subscriptions checkout.
 */
(function () {
  'use strict';

  const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
  const DEFAULT_DESTINATION = 'shop.celltheory.com';

  function readUrlParams() {
    const params = new URLSearchParams(window.location.search);
    const result = {};
    UTM_KEYS.forEach((key) => {
      const value = params.get(key);
      if (value) result[key] = value;
    });
    return result;
  }

  function readCookieParams() {
    const result = {};
    const cookies = document.cookie.split(';').map((c) => c.trim());
    UTM_KEYS.forEach((key) => {
      const found = cookies.find((c) => c.startsWith(`${key}=`));
      if (found) {
        const value = decodeURIComponent(found.split('=').slice(1).join('='));
        if (value) result[key] = value;
      }
    });
    return result;
  }

  function readLocalStorageParams() {
    const result = {};
    UTM_KEYS.forEach((key) => {
      try {
        const value = window.localStorage.getItem(key);
        if (value) result[key] = value;
      } catch (e) {
        // localStorage may be blocked in private mode or by user settings.
      }
    });
    return result;
  }

  function mergeParams(...sources) {
    return sources.reduce((acc, source) => ({ ...acc, ...source }), {});
  }

  function setRootDomainCookie(name, value, days = 30) {
    const date = new Date();
    date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
    const expires = `expires=${date.toUTCString()}`;
    // Set on root domain so both celltheory.com and shop.celltheory.com can read it.
    const domain = window.location.hostname.split('.').slice(-2).join('.');
    document.cookie = `${name}=${encodeURIComponent(value)};${expires};path=/;domain=${domain};SameSite=Lax`;
  }

  function saveParams(params) {
    Object.entries(params).forEach(([key, value]) => {
      try {
        window.localStorage.setItem(key, value);
      } catch (e) {
        // ignore
      }
      setRootDomainCookie(key, value);
    });
  }

  function pushToDataLayer(params) {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({
      event: 'utm_parameters_captured',
      ...params,
    });
  }

  function buildOutboundUrl(originalUrl, params) {
    if (!originalUrl) return originalUrl;
    const url = new URL(originalUrl, window.location.href);
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
    return url.toString();
  }

  function decorateLinks(destinationHost = DEFAULT_DESTINATION) {
    document.querySelectorAll('a[href], button[data-href]').forEach((el) => {
      const href = el.getAttribute('href') || el.dataset.href;
      if (!href) return;
      if (!href.includes(destinationHost)) return;

      const decorated = buildOutboundUrl(href, getStoredParams());
      if (el.tagName === 'A') {
        el.setAttribute('href', decorated);
      } else {
        el.dataset.href = decorated;
      }
    });
  }

  let storedParams = {};

  function getStoredParams() {
    return storedParams;
  }

  function init(options = {}) {
    const urlParams = readUrlParams();
    const cookieParams = readCookieParams();
    const lsParams = readLocalStorageParams();

    // New URL params always win, then fall back to cookies, then localStorage.
    storedParams = mergeParams(lsParams, cookieParams, urlParams);

    if (Object.keys(storedParams).length > 0) {
      saveParams(storedParams);
      pushToDataLayer(storedParams);
    }

    decorateLinks(options.destinationHost);

    // Re-decorate when DOM changes (for dynamically injected checkout buttons).
    if (window.MutationObserver) {
      const observer = new MutationObserver(() => decorateLinks(options.destinationHost));
      observer.observe(document.body, { childList: true, subtree: true });
    }

    return storedParams;
  }

  window.UtmPreserver = {
    init,
    getStoredParams,
    buildOutboundUrl,
    UTM_KEYS,
  };
})();
