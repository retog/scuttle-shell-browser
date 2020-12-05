import MRPC from 'muxrpc'
import { pull } from 'pull-stream'
import { Buffer } from 'buffer'




let messageDataCallback = null
let messageDataBuffer = []

const fromWebExt = function read(abort, cb) {
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
      event.data.direction == "from-content-script") {
        const asBuffer = Buffer.from(event.data.message)
        if (messageDataCallback) {
          const _messageDataCallback = messageDataCallback
          messageDataCallback = null
          _messageDataCallback(null, asBuffer)
        } else {
          messageDataBuffer.push(asBuffer)
        }
  }
});

const toWebExt = function sink(done) {
  return function (source) {
    source(null, function more(end,data) {
      if (end) return done()
      window.postMessage({
        direction: "from-page-script",
        message: data
      }, "*")
      source(null, more)
    })
  }
}

const manifest = {
  //async is a normal async function
  hello: 'async',

  //source is a pull-stream (readable)
  stuff: 'source'

}

const client = MRPC(manifest, null) ()

const onClose = () => {
  console.log('connected to muxrpc server')
} 

const clientStream = client.createStream(onClose)

pull(
  fromWebExt,
  clientStream,
  toWebExt()
)

client.hello('world').then((value) => {
  console.log(value)
})
pull(client.stuff(), pull.drain(console.log))

console.log('adding client to window')
window.client = client