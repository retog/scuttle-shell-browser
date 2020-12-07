import MRPC from 'muxrpc'
import { pull } from 'pull-stream'
import { Buffer } from 'buffer'


const manifest = {
  //async is a normal async function
  hello: 'async',

  //source is a pull-stream (readable)
  stuff: 'source'
}

const api = {
  hello(name, cb) {
    cb(null, 'hello, ' + name + '!')
  },
  stuff() {
    return pull.values([1, 2, 3, 4, 5])
  }
}




let connections = []
let ports = []

browser.runtime.onConnect.addListener(function connected(p) {
  ports[p.sender.tab.id] = p
  connections.push(createConnection(p))
})

function createConnection(port) {
  let messageDataCallback = null
  let messageDataBuffer = []

  const fromContentScript = function read(abort, cb) {
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

  const toContentScript = function(read) {
    read(null, function more (end,data) {
      if (end) return
      port.postMessage(data);
      read(null, more)
    })
  }

  const onClose = () => {
    console.log('muxrpc server closed')
  } 
  
  const server = MRPC(null, manifest) (api)
  const serverStream = server.createStream(onClose)

  pull(
    fromContentScript,
    serverStream,
    toContentScript
  )
  
  console.log('created server for', port)

  return {fromContentScript, toContentScript}
}