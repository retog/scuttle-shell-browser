# Scuttle Shell Browser

## What it does

This projet provides a webextension that allows accessing scuttlebutt from scripts in websites.

An script running on the Host provides an RPC connection to scuttlebutt via native messages. The web exension allows to decide which pages can access Scuttlebutt.


![Context menu to enable SSB aceess](images/scuttle-shell-browser-screenshot.png)

This extension includes a content script, which is injected into the accessed pages. This
content script provides an api that can be accessed from any page using a [muxrpc](https://github.com/ssb-js/muxrpc) connection.

The communication uses the page to extension messaging described at https://github.com/mdn/webextensions-examples/tree/master/page-to-extension-messaging, builds [pull-streams](https://github.com/pull-stream/pull-stream) on top of those messages and uses these streams for the RPC connection.


## How to try it

Building
```
  npm install
  npm run-script build
```

Running

To use Scuttle Shell Browser you need an ssb-sever running on your machine (this is the case when you
are running Patchwork). You need to install native messaging for the manifest in `host/scuttle_shell_browser.json`, see https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Native_messaging to learn how to do this on your platform. Note that you need to adapt the paths in the manifest file and that `host/host-script.js` must be executable.


To run the example you need to have the extension intalled and access the example page.

    npm run-script start:ext

This should start a browser with the extension. Alternatively you can also load the extension from the `webext` folder as temporary extension in your browser. Access the file `page.html` in the `site` folder.

    npm run-script serve

Now you can access http://localhost:9090/page.html


