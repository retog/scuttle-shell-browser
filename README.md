# page-to-extension-rpc

## What it does

This projet provides a webextension an a webpage that demostrate an RPC Connection between
page an extension.

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

To run the example you need to have the extension intalle and acce the example page.

    npm run-script start:ext

This should start a browser with the extension. Alternatively you can also load the extension from the `webext` folder as temporary extension in your browser. Access the file `page.html` in the `site` folder.

    npm run-script serve

Now you can access http://localhost:9090/page.html


## What it shows

How to make an RPC connection between an extension's content scripts, and scripts running in a web page.
