// mobile/plugins/withXcodeEnvLocal.js
const fs   = require('fs');
const path = require('path');
const { withDangerousMod } = require('expo/config-plugins');

/**
 * ═════════════════════════════════════════════════════════════════
 * withXcodeEnvLocal — tell Xcode where Node is, on every prebuild.
 *
 * Xcode's "Bundle React Native code and images" build phase needs
 * Node, and finds it through NODE_BINARY in ios/.xcode.env, which
 * defaults to `$(command -v node)`. Xcode runs build phases in a bare
 * shell that never loads nvm, so with an nvm install that lookup
 * comes back empty and the Release build can't bundle the JS.
 *
 * ios/.xcode.env.local overrides it, but `prebuild --clean` deletes
 * the whole ios/ folder, so a hand-made one is lost every time. This
 * writes it as part of prebuild instead, pointing NODE_BINARY at the
 * exact Node running the prebuild (process.execPath), which is the
 * nvm one when you run it from your terminal.
 *
 * An existing .xcode.env.local keeps everything except its
 * NODE_BINARY line. The file lives in ios/, which git ignores, so
 * the machine-specific path never gets committed.
 * ═════════════════════════════════════════════════════════════════
 */
const EXPORT_LINE = /^\s*export\s+NODE_BINARY=.*$/m;

function withXcodeEnvLocal(config) {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const file = path.join(config.modRequest.platformProjectRoot, '.xcode.env.local');
      const line = `export NODE_BINARY="${process.execPath}"`;

      let contents = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
      if (EXPORT_LINE.test(contents)) {
        contents = contents.replace(EXPORT_LINE, line);
      } else {
        const header = contents ? '' : '# Written by plugins/withXcodeEnvLocal.js during expo prebuild.\n';
        contents = `${header}${contents}${contents && !contents.endsWith('\n') ? '\n' : ''}${line}\n`;
      }

      fs.writeFileSync(file, contents);
      return config;
    },
  ]);
}

module.exports = withXcodeEnvLocal;
