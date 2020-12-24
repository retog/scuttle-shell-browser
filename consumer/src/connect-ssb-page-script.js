import { pull } from 'pull-stream'
import _pullParamap from 'pull-paramap'
import ssbConnect from './ssb-connect.js'

pull.paraMap = _pullParamap

window.pull = pull

window.connectSsb = ssbConnect