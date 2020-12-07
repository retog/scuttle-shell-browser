import { pull } from 'pull-stream'
import { Buffer } from 'buffer'

let messageDataCallback = null
let messageDataBuffer = []

const fromPage = function read(abort, cb) {
  if (messageDataBuffer.length > 0) {
    const data = messageDataBuffer[0]
    messageDataBuffer = messageDataBuffer.splice(1)
    cb(null, data)
  } else {
    messageDataCallback = cb
  }

}


window.addEventListener("message", (event) => {
  if (event.source == window &&
      event.data &&
      event.data.direction == "from-page-script") {
        //new Uint8Array(event.data.message) is not accepted by muxrpc
        const asBuffer = Buffer.from(event.data.message)
        if (messageDataCallback) {
          const _messageDataCallback = messageDataCallback
          messageDataCallback = null
          _messageDataCallback(null, asBuffer)
        } else {
          console.log('buffering....')
          messageDataBuffer.push(asBuffer)
        }
  }
});

const toPage = function sink(done) {
  return function (source) {
    source(null, function more (end,data) {
      window.postMessage({
        direction: "from-content-script",
        message: data
      }, window.location.origin);
      source(null, more)
    })
  }
}



const myPort = browser.runtime.connect({name:"port-from-cs"});

let bgMessageDataCallback = null
let bgMessageDataBuffer = []

myPort.onMessage.addListener(function(message) {
  const asBuffer = Buffer.from(message)
  if (bgMessageDataCallback) {
    const _messageDataCallback = bgMessageDataCallback
    bgMessageDataCallback = null
    _messageDataCallback(null, asBuffer)
  } else {
    console.log('buffering....')
    bgMessageDataBuffer.push(asBuffer)
  }
});

const fromBackgroundScript = function read(abort, cb) {
  if (bgMessageDataBuffer.length > 0) {
    const data = bgMessageDataBuffer[0]
    bgMessageDataBuffer = bgMessageDataBuffer.splice(1)
    cb(null, data)
  } else {
    bgMessageDataCallback = cb
  }

}

const toBackgroundScript = function sink(done) {
  return function (source) {
    source(null, function more (end,data) {
      if (end) return done()
      myPort.postMessage(data);
      source(null, more)
    })
  }
}
/*function logger(text) {
  return pull.map(v => {
    console.log(text,v)
    return v
  })
}*/

pull(fromPage, toBackgroundScript())
pull(fromBackgroundScript, toPage())