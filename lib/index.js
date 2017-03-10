'use strict';
const Stream = require('stream');
const isStream = require('isstream');
const StreamBattery = require('streambattery');
const Dockerode = require('dockerode');

function streamToPromise(stream) {
  return new Promise((resolve, reject) => {
    let hasResolved = false;
    const resolveOnce = function (...args) {
      if( !hasResolved ) {
        hasResolved = true;
        resolve(...args);
      }
    };

    stream.on('error', reject);
    stream.on('end', resolveOnce);
    stream.on('close', resolveOnce);
  });
}

/**
 * A version of exec that wraps Dockerode's, reducing the stream handling for most use cases.
 * @param {Array<string>} Cmd The command to execute, in exec array form.
 * @param {Object} opts Object of options.
 * @param {boolean} opts.stdout True/false, if true, user will receive a stdout key with the output
 * @param {boolean} opts.stderr True/false, if true, user will receive a stderr key with the output
 * @param {string|Stream} opts.stdin If this key exists, whatever the user puts in here will be sent to the container.
 * @param {boolean} opts.live If true, the user will receive a function to plug into the demuxer, instead of finished values.
 * @param {function} callback Will be called with either a function to plug into demuxer, or an object with whatever output keys the user requested.
 */
function easyExec(...args) {
  let createOpts = {Cmd, AttachStdin: false, AttachStdout: false, AttachStderr: false};
  let execOpts = {Detach: true, hijack: false};

  let Cmd, opts, callback;

  // Polymorphism
  switch(args.length) {
  default: return Promise.reject(new Error('Need arguments'));
  case 1: Cmd = args[0]; opts = {}; break;
  case 2:
    if( typeof args[1] === 'object' ) {
      opts = args[1];
    } else if( typeof args[1] === 'function' ) {
      callback = args[1];
    } else {
      return Promise.reject(new Error('Second argument cannot be anything but an object or a function'));
    }
    break;
  case 3: [Cmd, opts, callback] = args; break;
  }

  if( opts.stdin ) {
    createOpts.AttachStdin = true;
    execOpts.stdin = true;
    execOpts.hijack = true;
    execOpts.Detach = false;
  }

  if( opts.stdout ) {
    createOpts.AttachStdout = true;
    execOpts.hijack = true;
    execOpts.Detach = false;
  }

  if( opts.stderr ) {
    createOpts.AttachStderr = true;
    execOpts.hijack = true;
    execOpts.Detach = false;
  }

  // Need to make a detach case
  this.execRaw(createOpts, (createErr, exec) => {
    if( createErr ) { callback(createErr); return; }
    exec.start(execOpts, (execErr, stream) => {
      if( execErr ) { callback(execErr); return; }

      const promises = [];

      // Make a detach case here

      if( opts.stdin ) {
        // Send the process whatever the user's going for.
        if( isStream(opts.stdin) ) {
          opts.stdin.pipe(stream);
        } else {
          const sender = new Stream.Readable();
          sender.push(opts.stdin);
          sender.push(null);
          sender.pipe(stream);
        }

        promises.push(streamToPromise(stream));
      }

      if( 'live' in opts && opts.live ) {
        // If the user wants live streams, give them the builtin demuxStream that they can attach to.
        callback(null, (stdout, stderr) => {
          if( stdout != null || stderr != null ) {
            exec.modem.demuxStream(stream, stdout, stderr);
          }
          // Allow an .on('end').
          return stream;
        });
      } else if( opts.stdout || opts.stderr ) {
        // Set up the battery to inspect the exec, then callback when done.
        const battery = new StreamBattery(['stdout', 'stderr'], (battError, results) => {
          if( battError ) {
            callback(battError, results); return;
          }

          exec.inspect((inspError, inspect) => {
            Object.assign(results, {inspect});
            callback(inspError, results);
          });
        });

        // Start the stream demuxing
        this.modem.demuxStream(stream, ...battery.streams);
        stream.on('end', () => battery.end());
      } else {
        // Whenever it finishes, inspect the exec, then callback when done.
        stream.on('end', () => exec.inspect( (inspError, inspect) => callback(inspError, {inspect}) ));
      }
    });
  });
}

/**
 * A class to simplify certain functions that work with containers.
 */
class SimpleDockerode extends Dockerode {
  constructor(...args) {
    super(...args);
  }

  getContainer(...args) {
    const container = super.getContainer(...args);
    container.execRaw = container.exec;
    container.exec = easyExec;
    return container;
  }
}

module.exports = SimpleDockerode;
