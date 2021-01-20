import { pull } from 'pull-stream'
import ssbHash from 'pull-hash/ext/ssb'
import multicb from 'multicb'
import crypto from 'crypto'

function isFunction(f) {
 return 'function' === typeof f
}

// sbot.blobs.add function decorator
// that returns a function that complies with the spec at
// - http://scuttlebot.io/apis/scuttlebot/blobs.html#add-sink
// - http://scuttlebot.io/docs/advanced/publish-a-file.html
//
// Temporary solution until muxrpc supports sinks that can callback
// with arguments.
// See ssb thread for details:
// https://viewer.scuttlebot.io/%252YFBVzniDPuuyLnLk%2FsYSbIJzjhS7ctEIOv5frt9n9Q%3D.sha256

export default function fixAddBlob(add) {
  console.log('fixing', crypto)
  return function (hash, cb) {
    console.log('adding', ssbHash)
    if (typeof hash === 'function') cb = hash, hash = null
    var done = multicb({ pluck: 1, spread: true })
    console.log('pulling', done)
    var sink = pull(
      ssbHash(done()),
      pull.collect(done())
    )
    console.log('we have', sink)
    done(function(err, actualHash, buffers) {
      if (hash && hash !== actualHash) return cb(new Error('Invalid blob hash value. expected: ' + hash + ', actual: ' + actualHash))
      console.log('now we start to actually add', buffers)
      pull(
        pull.values(buffers),
        add(hash, function(err) {
          if(isFunction(cb))
          {
            cb(err, actualHash)
          }
        })
      )
    })
    return sink
  }
}