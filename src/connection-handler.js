import ssb from 'ssb-client'
import { pull } from 'pull-stream'
//pull.paraMap = require('pull-paramap')

const ssbHost = 'localhost'+':'+8989
const serverPubKey = '+qNos2XP9dfREX8qgNeA7V/KZPEYkRwreIuDqTWIqOI=.ed25519'
const remote = 'ws://'+ssbHost+'~shs:'+serverPubKey
console.log('remote: ', remote)
ssb({
  remote
}, (err, sbot) => {
  if (err) {
    const clientId = JSON.parse(localStorage['/.ssb/secret']).id
    console.log('could not get keys, got err', err);
    if (err.message.startsWith('method:manifest')) {
      const instructions = `
      It appears that access to the SSB Sever running on ${ssbHost} has not yet been granted to this web location and this browser.

      Copy the public key <code>${clientId}</code> and put it into your ~/.ssb/config
      as an item in a top-level array property called “master”, like this:
      
      "master": [
        "${clientId}"
      ],
      
      After adding the key you'll need to restart the server.</p>`.replaceAll('\n      ','\n')
      console.log(instructions)
    }
  } else {
    console.log('got sbot')
  }
})