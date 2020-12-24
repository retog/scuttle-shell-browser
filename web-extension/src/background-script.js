import MRPC from 'muxrpc'
import { pull } from 'pull-stream'
import { Buffer } from 'buffer'



browser.runtime.onMessage.addListener(notify);

function notify(message) {
  if (message.direction === "from-menu-script") {
    if (message.message.action === 'grant') {
      console.log('granting acces to', message.message.target);
      browser.storage.local.get({'granted': []}).then(({granted}) => {
        console.log('granted acces to', granted)
        Object.values(portConnections).filter(connection => !connection.connected).forEach((con) => {
          const relevantURL = con.port.sender.url.split('?')[0].split('#')[0]
          if (~granted.indexOf(relevantURL)) {
            connectPort(con.stream)
            portConnections[con.port.sender.tab.id].connected = true
          } else {
            console.log(con.stream)
            con.stream.abort()
          }
        })
      })
    }
  }
}

let portConnections = []

browser.runtime.onConnect.addListener(async function connected(port) {
  console.log('connection from', port.sender.url)
  const stream = createConnection(port)
  const relevantURL = port.sender.url.split('?')[0].split('#')[0]
  const { granted } = await browser.storage.local.get({'granted': []})
  if (~granted.indexOf(relevantURL)) {
    connectPort(stream) 
    portConnections[port.sender.tab.id] = { port, stream, connected: true }
  } else {
    portConnections[port.sender.tab.id] = { port, stream, connected: false }
  }
})


function connectPort(contentScriptStream) {
  //p.sender.tab.onClose(() => console.log('tab closed, should close connection'))
  
  const nativeScriptStream = createNativeConnection()

  pull(
    contentScriptStream,
    //logger('from content to native'),
    nativeScriptStream
  )
  pull(
    nativeScriptStream,
    //logger('from native to content'),
    contentScriptStream
  )
}

function createNativeConnection() {
  const port = browser.runtime.connectNative("scuttle_shell_browser")
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

  return {source: fromPort, sink: toPort}
}