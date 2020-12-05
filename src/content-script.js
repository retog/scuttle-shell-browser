import MRPC from 'muxrpc'
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

/*
Send a message to the page script.
*/
function messagePageScript() {
  window.postMessage({
    direction: "from-content-script",
    message: "Message from the köntent skript"
  }, window.location.origin);
}



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

const server = MRPC(null, manifest) (api)

const onClose = () => {
  console.log('muxrpc server closed')
} 

const serverStream = server.createStream(onClose)

pull(
  fromPage,
  serverStream,
  toPage()
)

client.hello('world').then((value) => {
  console.log(value)
})

