var asyncHooks = require('async_hooks')
var stackback = require('stackback')
var path = require('path')
var fs = require('fs')
var sep = path.sep

var active = new Map()
var hook = asyncHooks.createHook({
  init (asyncId, type, triggerAsyncId, resource) {
    if (type === 'TIMERWRAP' || type === 'PROMISE') return
    if (type === 'PerformanceObserver' || type === 'RANDOMBYTESREQUEST') return
    var err = new Error('whatevs')
    var stacks = stackback(err)
    active.set(asyncId, {type, stacks, resource})
  },
  destroy (asyncId) {
    active.delete(asyncId)
  }
})

hook.enable()
module.exports = whyIsNodeRunning

/**
 * May be called at any time to obtain a list of processes keeping Node.js running
 * 
 * @param {*} logger 
 */
function whyIsNodeRunning() {
 
  hook.disable()
  var activeResources = [...active.values()].filter(function(r) {
    if (
      typeof r.resource.hasRef === 'function'
      && !r.resource.hasRef()
    ) return false
    return true
  })

  return {
    runningHandles: activeResources.length,
    blockers: activeResources.map(ar => {
      const filteredStacks = ar.stacks.slice(1)
        .filter(function (s) {
          var filename = s.getFileName()
          return filename && filename.indexOf(sep) > -1 && filename.indexOf('internal' + sep) !== 0
        })

      return {
        type: ar.type,
        cause: {
          file: filteredStacks[0].getFileName(),
          lineNumber: filteredStacks[0].getLineNumber()
        }
       }
    })
  }
}
