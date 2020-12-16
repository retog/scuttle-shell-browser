import MRPC from 'muxrpc'
import { pull } from 'pull-stream'
import { Buffer } from 'buffer'
import { inspect } from 'util'
import Client from 'ssb-client'

import {Input, Output} from 'web-ext-native-msg'


const handleReject = e => {
  e = (new Output()).encode(e);
  e && process.stdout.write(e);
  return false;
};

const writeStdout = async msg => {
  //TODO check msg length < 1048576 bytes.
  //console.error('msg', msg, inspect(msg))
  //console.error('msg.toString()', msg.toString())
  //console.error('msg.length', msg.length)
  msg = await (new Output()).encode(msg);
  return msg && process.stdout.write(msg);
};


const input = new Input();

let messageDataCallback = null
let messageDataBuffer = []

const readStdin = chunk => {
  const arr = input.decode(chunk);
  const func = [];
  Array.isArray(arr) && arr.length && arr.forEach(msg => {
    msg && func.push(handleMsg(msg));
  });
  return Promise.all(func).catch(handleReject);
};

process.stdin.on("data", readStdin);

const fromWebExt = function read(abort, cb) {
  if (messageDataBuffer.length > 0) {
    const data = messageDataBuffer[0]
    messageDataBuffer = messageDataBuffer.splice(1)
    cb(null, data)
  } else {
    messageDataCallback = cb
  }
}


const handleMsg = async message => {
  //console.error('msg', message, inspect(message))
  const asBuffer = Buffer.from(message)
  if (messageDataCallback) {
    const _messageDataCallback = messageDataCallback
    messageDataCallback = null
    _messageDataCallback(null, asBuffer)
  } else {
    //console.log('buffering....')
    messageDataBuffer.push(asBuffer)
  }
}

const toWebExt = function(read) {
  read(null, function more (end,data) {
    if (end) return
    writeStdout(data);
    read(null, more)
  })
}





const manifest = {
  //async is a normal async function
  hello: 'async',

  //source is a pull-stream (readable)
  stuff: 'source', 
  
  manifest: 'sync'
}

const api = {
  hello(name, cb) {
    cb(null, 'hello, ' + name + '!')
  },
  stuff() {
    return pull.values([1, 2, 3, 4, 5])
  },
  manifest: function () {
    return manifest
  }
}

const onClose = () => {
  //console.log('muxrpc server closed')
} 

/*const server = MRPC(null, manifest) (api)
const serverStream = server.createStream(onClose)

pull(fromWebExt, serverStream, toWebExt)*/

function asyncifyManifest(manifest) {
  if (typeof manifest !== 'object' || manifest === null) return manifest
  let asyncified = {}
  for (let k in manifest) {
    var value = manifest[k]
    // Rewrite re-exported sync methods as async,
    // except for manifest method, as we define it later
    if (value === 'sync' && k !== 'manifest') {
      value = 'async'
    }
    asyncified[k] = value
  }
  return asyncified
}

Client((err, sbot) => {
  if (err) {
    console.error("could not connect to ssb-server instance", err)
    return
  }
  sbot.manifest().then(manifest => {
    //console.error('manifest', inspect(manifest))
    const asyncManifest = asyncifyManifest(manifest)
    sbot.manifest = function () {
      return manifest
    }
    const server = MRPC(null, asyncManifest) (sbot)
    const serverStream = server.createStream(onClose)

    pull(fromWebExt, serverStream, toWebExt)
  })
})
