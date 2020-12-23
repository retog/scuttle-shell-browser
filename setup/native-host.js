#!/usr/bin/env node

import {Setup} from "web-ext-native-msg"
import path from 'path'
import fs from 'fs-extra'

const handlerAfterSetup = info => {
  const {configDirPath, shellScriptPath, manifestPath} = info;
  console.log('-----')
  console.log('The Scuttle Shell Browser host has been installed.')
  console.log('Install the Scuttle Shell Browser Firefox Add-on if you haven\'t already.')
  console.log('You can download the Add-On here: https://github.com/retog/scuttle-shell-browser/releases/tag/1.0.0')
};

const getProjectRoot = () => {
  const [, binPath] = process.argv;
  const scriptPath = fs.realpathSync(binPath);
  const root = path.resolve(path.dirname(scriptPath), '../');
  return root;
};

const getMainScriptPath = () => {
  const [, binPath] = process.argv;
  const scriptPath = fs.realpathSync(binPath);
  const mainScriptPath = path.resolve(path.dirname(scriptPath), '../host/host-script.js');
  console.log('mainScriptPath: '+mainScriptPath)
  return mainScriptPath;
};


const setup = new Setup({
  hostDescription: "Exposes an ssb-client to the scuttle shell browser extension",
  browser: "firefox",
  hostName: "scuttle_shell_browser",
  mainScriptFile: getMainScriptPath(),
  chromeExtensionIds: ["chrome-extension://xxxxxx"],
  webExtensionIds: ["scuttle-shell-browser@example.org"],
  overwriteConfig: true,
  callback: handlerAfterSetup,
});

const origCreateShellFunction = setup._createShellScript

setup._createShellScript = async function(configDir) {
  const targetPath = path.resolve(configDir, 'app')
  fs.ensureDir(targetPath)
  await fs.copy(getProjectRoot(), targetPath, { overwrite: true })
  setup.mainScriptFile = path.resolve(targetPath, './host/host-script.js')
  return origCreateShellFunction.apply(setup, [configDir])
}

setup.run();