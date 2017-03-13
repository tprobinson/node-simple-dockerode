const Stream = require('stream');
const isStream = require('isstream');
const StreamBattery = require('streambattery');

/**
 * A version of exec that wraps Dockerode's, reducing the stream handling for most use cases.
 * @param {Array<string>} Cmd The command to execute, in exec array form.
 * @param {Object} opts Object of options.
 * @param {boolean} opts.stdout True/false, if true, user will receive a stdout key with the output
 * @param {boolean} opts.stderr True/false, if true, user will receive a stderr key with the output
 * @param {string|Stream} opts.stdin If this key exists, whatever the user puts in here will be sent to the container.
 * @param {boolean} opts.live If true, the user will receive a function to plug into the demuxer, instead of finished values.
 * @param {Object} createOpts Args for the normal exec.create, processed via {@link processArgs}
 * @param {Object} execOpts Args for the normal exec.start, processed via {@link processArgs}
 * @param {function} callback Will be called with either a function to plug into demuxer, or an object with whatever output keys the user requested.
 */
function processExec(opts, createOpts, execOpts, callback) {
  this.execRaw(createOpts, (createErr, exec) => {
    if( createErr ) { callback(createErr); return; }
    exec.start(execOpts, (execErr, stream) => {
      if( execErr ) { callback(execErr); return; }

      if( 'live' in opts && opts.live ) {
        // If the user wants live streams, give them a function to attach to the builtin demuxStream
        callback(null, (stdout, stderr) => {
          if( stdout || stderr ) {
            this.modem.demuxStream(stream, stdout, stderr);
          }
          // Allow an .on('end').
          return stream;
        });
      } else {
        const results = {};
        let callbackCalled = false;
        const callbackOnce = err => {
          if( !callbackCalled ) {
            callbackCalled = true;
            if( err ) {
              Object.assign(results, {error: err});
            }
            // Inspect the exec and put that information into the results as well
            // Allow this to be turned off via option later
            // Workaround: if the user only has stdin and no stdout,
            // the process will sometimes not immediately end.
            let times = 10;
            const inspectLoop = () => {
              exec.inspect((inspError, inspect) => {
                if( inspect.ExitCode !== null ) {
                  if( times !== 10 ) {
                    inspect.tries = 10 - times;
                  }

                  Object.assign(results, {inspect});
                  callback(inspError, results);
                } else {
                  times--;
                  setTimeout(inspectLoop, 50);
                }
              });
            };
            inspectLoop();
          }
        };

        if( execOpts.Detach ) {
          // Bitbucket the stream's data, so that it can close.
          stream.on('data', () => {});
        }

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
        }

        if( opts.stdout || opts.stderr ) {
          // Set up the battery to merge in its results when it's done. If it had an error, trigger the whole thing returning.
          const battery = new StreamBattery(['stdout', 'stderr'], (battError, battResults) => {
            Object.assign(results, battResults);
            if( battError ) {
              callbackOnce(battError);
            }
          });

          // Start the stream demuxing
          this.modem.demuxStream(stream, ...battery.streams);
          stream.on('end', () => battery.end());
        }

        // Wait for the exec to end.
        stream.on('end', callbackOnce);
        stream.on('close', callbackOnce);
        stream.on('error', callbackOnce);
      }
    });
  });
}
module.exports = processExec;
