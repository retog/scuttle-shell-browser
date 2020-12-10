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



const client = MRPC(function (err, manifest) {
  if (err) throw err

  //console.log(JSON.stringify(manifest,undefined, 2))

  console.log('adding client to window')
  window.client = client
  window.pull = pull

  const outElem = document.getElementById('output')

  const opts = {
    limit: 100,
    reverse: true
  }

  pull(
    client.query.read(opts),
    pull.drain(msg => {
      outElem.innerHTML += `<pre>${JSON.stringify(msg, null, 2)}</pre>`
      outElem.innerHTML += '<hr/>'
    })
  )

})()

const onClose = () => {
  console.log('connected to muxrpc server')
} 

const clientStream = client.createStream(onClose)

pull(
  fromWebExt,
  clientStream,
  toWebExt()
)