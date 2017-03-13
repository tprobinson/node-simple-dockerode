'use strict';
const Dockerode = require('dockerode');
const processExec = require('./processExec');

/**
 * Process the arguments to pass into {@link processExec}
 * @param {Array} args A spread parameter to catch all arguments. Broken into later arguments.
 * @param {Array<string>} Cmd An array of strings, specifying an exec-style array of arguments.
 * @param {Object}        [opts] An optional object of parameters.
 * @param {function}      [callback] An optional callback. If omitted, the function will return a Promise.
 * @returns {Promise}     If no callback is given, return a Promise.
 */
function processArgs(...args) {
  let Cmd;
  let opts;
  let callback;

  // Polymorphism
  switch(args.length) {
  default: throw new Error('Need arguments');
  case 1: Cmd = args[0]; opts = {}; break;
  case 2:
    Cmd = args[0];
    if( typeof args[1] === 'object' ) {
      opts = args[1];
    } else if( typeof args[1] === 'function' ) {
      callback = args[1];
      opts = {};
    } else {
      throw new Error('Second argument cannot be anything but an object or a function');
    }
    break;
  case 3: [Cmd, opts, callback] = args; break;
  }

  let createOpts = {Cmd, AttachStdin: false, AttachStdout: false, AttachStderr: false};
  let execOpts = {Detach: true, hijack: false};

  if( opts.stdin || opts.stdout || opts.stderr ) {
    execOpts.hijack = true;
    execOpts.Detach = false;
  }

  if( opts.stdin ) {
    createOpts.AttachStdin = true;
    execOpts.stdin = true;
  }

  if( opts.stdout ) {
    createOpts.AttachStdout = true;
  }

  if( opts.stderr ) {
    createOpts.AttachStderr = true;
  }

  if( opts.live ) {
    if( execOpts.Detach ) {
      const err = new Error('The live option requires that you also pass stdout, stderr, or stdin.');
      if( !callback ) {
        return Promise.reject(err);
      }
      return callback(err);
    }
  }

  if( !callback ) {
    return new Promise((resolve, reject) =>
      processExec.call(this, opts, createOpts, execOpts, (err, results) => err ? reject(err, results) : resolve(results))
    );
  }

  return processExec.call(this, opts, createOpts, execOpts, callback);
}

/**
 * A class to simplify certain functions that work with containers.
 */
class SimpleDockerode extends Dockerode {
  constructor(...args) {
    super(...args);
  }

  /**
   * Wrapper for Dockerode's native function, to swap exec for {@link processArgs}
   * @param {Array} args A spread parameter, passed through to Dockerode's getContainer
   */
  getContainer(...args) {
    const container = super.getContainer(...args);
    container.execRaw = container.exec;
    container.exec = processArgs;
    return container;
  }
}

module.exports = SimpleDockerode;
