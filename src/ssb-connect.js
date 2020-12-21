import MRPC from 'muxrpc'
import { pull } from 'pull-stream'
import { Buffer } from 'buffer'
import _pullParamap from 'pull-paramap' 

pull.paraMap = _pullParamap

export { pull as pull }

function ping() {
  window.postMessage({
    direction: 'from-page-script',
    action: 'ping'
  }, '*');
}

function contentLoaded() {
  ping()
  return new Promise((resolve, reject) => {
    const onMessage = (event) => {
      if (event.source == window &&
          event.data &&
          event.data.direction == 'from-content-script') {
        if (event.data.action == 'ping') {
          window.removeEventListener('message', onMessage)
          resolve()
        } 
      }
    }
    window.addEventListener('message', onMessage)
  })
}

function ssbConnect() {
  return contentLoaded().then(connectSsbNoWait)
}

export default ssbConnect

export { ssbConnect as ssbConnect }

function connectSsbNoWait() {
  return new Promise((resolve, reject) => {

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


    window.addEventListener('message', (event) => {
      if (event.source == window &&
          event.data &&
          event.data.direction == 'from-content-script') {
        if (event.data.action == 'ping') {
          //ignored ping()
        } else {
          const asBuffer = Buffer.from(event.data.message)
          if (messageDataCallback) {
            const _messageDataCallback = messageDataCallback
            messageDataCallback = null
            _messageDataCallback(null, asBuffer)
          } else {
            messageDataBuffer.push(asBuffer)
          }
        }
      }
    });

    const toWebExt = function sink(done) {
      return function (source) {
        source(null, function more(end,data) {
          if (end) return done()
          window.postMessage({
            direction: 'from-page-script',
            message: data
          }, '*')
          source(null, more)
        })
      }
    }

    const clientBuilder = MRPC(function (err, manifest) {
      if (err) {
        reject(err) 
      } else {
        resolve(client)
      }
    })

    const client = clientBuilder()
    
    const onClose = () => {
      console.log('connected to muxrpc server')
    } 
    
    const clientStream = client.createStream(onClose)
    pull(
      fromWebExt,
      clientStream,
      toWebExt()
    )
  })
}


