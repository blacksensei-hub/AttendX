// server/src/test/fakes.js
//
// Test helpers. `fake` swaps a module for a stand-in before the code under
// test loads it, so no test ever opens a database connection, sends an
// email or emits to a real socket. node --test runs each test file in its
// own process, so a fake never leaks from one file into another.

const path = require('path');

const SRC = path.join(__dirname, '..');

/** Replace src/<rel> with `exports` for everything loaded after this call. */
function fake(rel, exports) {
  const file = require.resolve(path.join(SRC, rel));
  require.cache[file] = { id: file, filename: file, loaded: true, exports };
}

/** A minimal Express response that records what the handler sent. */
function response() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

module.exports = { fake, response };
