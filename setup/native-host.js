#!/usr/bin/env node

import {Setup} from "web-ext-native-msg"

const handlerAfterSetup = info => {
  const {configDirPath, shellScriptPath, manifestPath} = info;
  console.log('-----')
  console.log('The Scuttle Shell Browser host has been installed.')
  console.log('Install the Scuttle Shell Browser Firefox Add-on if you haven\'t already.')
  console.log('You can download the Add-On here: https://github.com/retog/scuttle-shell-browser/releases/tag/1.0.0')
};

const setup = new Setup({
  hostDescription: "Exposes an ssb-client to the scuttle shell browser extension",
  browser: "firefox",
  hostName: "scuttle_shell_browser",
  mainScriptFile: "host/host-script.js",
  chromeExtensionIds: ["chrome-extension://xxxxxx"],
  webExtensionIds: ["scuttle-shell-browser@example.org"],
  overwriteConfig: true,
  callback: handlerAfterSetup,
});

setup.run();