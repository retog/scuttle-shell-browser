import {Setup} from "web-ext-native-msg"

const handlerAfterSetup = info => {
  const {configDirPath, shellScriptPath, manifestPath} = info;
  // do something
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