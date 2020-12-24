# Scuttle Shell Browser - Consumer

This project contains web pages that access the [Scuttlebutt Network](https://scuttlebutt.nz/) in browsers with Scuttle Shell Browser.

The project generates the script [ssb-connect.js](https://retog.github.io/scuttle-shell-browser/ssb-connect.js) that provides the SSB Client.

It can be used as follows within the scipts of your page:
```js
import {default as ssbConnnect, pull} from 'https://retog.github.io/scuttle-shell-browser/ssb-connect.js'
ssbConnnect().then(sbot => {
  //access sbot
})
```

See the various examples in the site folder. They are accessible online at [https://retog.github.io/scuttle-shell-browser/](https://retog.github.io/scuttle-shell-browser/).