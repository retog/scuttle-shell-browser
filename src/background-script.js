import MRPC from 'muxrpc'
import { pull } from 'pull-stream'
import { Buffer } from 'buffer'



browser.runtime.onMessage.addListener(notify);

function notify(message) {
  if (message.direction === "from-menu-script") {
    if (message.message.action === 'grant') {
      console.log('granting acces to', message.message.target);
      //TODO implement
    }
  }
}

let ports = []

browser.runtime.onConnect.addListener(function connected(p) {
  ports[p.sender.tab.id] = p
  //p.sender.tab.onClose(() => console.log('tab closed, should close connection'))
  const [fromContentScript, toContentScript] = createConnection(p)
  const [fromNativeScript, toNativeScript] = createNativeConnection(p)

  pull(
    fromContentScript,
    //logger('from content to native'),
    toNativeScript
  )
  pull(
    fromNativeScript,
    //logger('from native to content'),
    toContentScript
  )
})

function createNativeConnection() {
  const port = browser.runtime.connectNative("ssb4all")
  return createConnection(port)
}


function createConnection(port) {
  let messageDataCallback = null
  let messageDataBuffer = []
 
  const fromPort = function read(abort, cb) {
    if (messageDataBuffer.length > 0) {
      const data = messageDataBuffer[0]
      messageDataBuffer = messageDataBuffer.splice(1)
      cb(null, data)
    } else {
      messageDataCallback = cb
    }
  }

  port.onMessage.addListener(function(message) {
    const asBuffer = Buffer.from(message)
    if (messageDataCallback) {
      const _messageDataCallback = messageDataCallback
      messageDataCallback = null
      _messageDataCallback(null, asBuffer)
    } else {
      console.log('buffering....')
      messageDataBuffer.push(asBuffer)
    }
  });

  const toPort = function(read) {
    read(null, function more (end,data) {
      if (end) return
      port.postMessage(data);
      read(null, more)
    })
  }

  return [fromPort, toPort]
}