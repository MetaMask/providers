Object.assign(global, require('jest-chrome'));

// Clean up jsdom between tests.
// Courtesy @jhildenbiddle
// https://github.com/jestjs/jest/issues/1224#issuecomment-716075260
const sideEffects = {
  document: {
    addEventListener: {
      fn: document.addEventListener,
      refs: [],
    },
    keys: Object.keys(document),
  },
  window: {
    addEventListener: {
      fn: window.addEventListener,
      refs: [],
    },
    keys: Object.keys(window),
  },
};

// Lifecycle Hooks
// -----------------------------------------------------------------------------
beforeAll(async () => {
  // Spy addEventListener
  ['document', 'window'].forEach((obj) => {
    const { fn, refs } = sideEffects[obj].addEventListener;

    /**
     *
     * @param type
     * @param listener
     * @param options
     */
    function addEventListenerSpy(type, listener, options) {
      // Store listener reference so it can be removed during reset
      refs.push({ type, listener, options });
      // Call original window.addEventListener
      fn(type, listener, options);
    }

    // Add to default key array to prevent removal during reset
    sideEffects[obj].keys.push('addEventListener');

    // Replace addEventListener with mock
    global[obj].addEventListener = addEventListenerSpy;
  });
});

// Reset JSDOM. This attempts to remove side effects from tests, however it does
// not reset all changes made to globals like the window and document
// objects. Tests requiring a full JSDOM reset should be stored in separate
// files, which is only way to do a complete JSDOM reset with Jest.
beforeEach(async () => {
  const rootElm = document.documentElement;

  // Remove attributes on root element
  [...rootElm.attributes].forEach((attr) => rootElm.removeAttribute(attr.name));

  // Remove elements (faster than setting innerHTML)
  while (rootElm.firstChild) {
    rootElm.removeChild(rootElm.firstChild);
  }

  // Remove global listeners and keys
  ['document', 'window'].forEach((obj) => {
    const { refs } = sideEffects[obj].addEventListener;

    // Listeners
    while (refs.length) {
      const { type, listener, options } = refs.pop();
      global[obj].removeEventListener(type, listener, options);
    }

    // This breaks coverage.
    // // Keys
    // Object.keys(global[obj])
    //   .filter((key) => !sideEffects[obj].keys.includes(key))
    //   .forEach((key) => {
    //     delete global[obj][key];
    //   });
  });

  // Restore base elements
  rootElm.innerHTML = '<head></head><body></body>';
});
