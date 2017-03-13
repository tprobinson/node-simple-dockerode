# Simple-Dockerode
<!-- MDTOC maxdepth:2 firsth1:0 numbering:0 flatten:0 bullets:1 updateOnSave:1 -->

- [Usage](#usage)   
- [Properties and Methods](#properties-and-methods)   
   - [`exec()`](#exec)   
   - [`execRaw()`](#execraw)   
- [Testing](#testing)   

<!-- /MDTOC -->

Wraps Dockerode container exec function to make it easier to use.

Wrangling streams and four levels of callbacks on exec is a pain. This makes it simpler, hopefully.

[![https://nodei.co/npm/simple-dockerode.svg?downloads=true&downloadRank=true&stars=true](https://nodei.co/npm/simple-dockerode.svg?downloads=true&downloadRank=true&stars=true)](https://www.npmjs.com/package/simple-dockerode)

[![npm version](https://badge.fury.io/js/simple-dockerode.svg)](https://badge.fury.io/js/simple-dockerode)
[![Dependency Status](https://david-dm.org/tprobinson/node-simple-dockerode.svg)](https://david-dm.org)

master: [![Build Status](https://travis-ci.org/tprobinson/node-simple-dockerode.svg?branch=master)](https://travis-ci.org/tprobinson/node-simple-dockerode)
[![Docs Status](https://inch-ci.org/github/tprobinson/node-simple-dockerode.svg?branch=master)](https://inch-ci.org/github/tprobinson/node-simple-dockerode)

dev: [![Build Status](https://travis-ci.org/tprobinson/node-simple-dockerode.svg?branch=dev)](https://travis-ci.org/tprobinson/node-simple-dockerode)
[![Docs Status](https://inch-ci.org/github/tprobinson/node-simple-dockerode.svg?branch=dev)](https://inch-ci.org/github/tprobinson/node-simple-dockerode)

[![bitHound Overall Score](https://www.bithound.io/github/tprobinson/node-simple-dockerode/badges/score.svg)](https://www.bithound.io/github/tprobinson/node-simple-dockerode)
[![bitHound Code](https://www.bithound.io/github/tprobinson/node-simple-dockerode/badges/code.svg)](https://www.bithound.io/github/tprobinson/node-simple-dockerode)
[![Code Climate](https://codeclimate.com/github/tprobinson/node-simple-dockerode/badges/gpa.svg)](https://codeclimate.com/github/tprobinson/node-simple-dockerode)

[![contributions welcome](https://img.shields.io/badge/contributions-welcome-brightgreen.svg?style=flat)](https://github.com/tprobinson/simple-dockerode/issues)

## Usage

Use this package just like you would Dockerode. The only difference is `exec()`.

The first argument is your command, in exec array form. The second is an object of options. The third is a callback.
```javascript
const Dockerode = require('simple-dockerode');

const docker = new Dockerode({protocol: 'http', host: 'localhost', port: 2375});

const myContainer = docker.getContainer('hello-world');

// Simple to grab the stdout and stderr.
myContainer.exec(['echo', 'goodbye world'], {stdout: true}, (err, results) => {
  console.log(results.stdout);
  // goodbye world
});
```
The results contain your [exec's inspect values](https://docs.docker.com/engine/api/v1.23/#/exec-inspect) too, for the exit code and other information.
```javascript
myContainer.exec(['stat', '/non-existent-file'], {stdout: true, stderr: true})
  .catch(console.error)
  .then(results => {
    if( results.inspect.ExitCode !== 0 ) {
      // This file obviously doesn't exist, we get an exit code of 1
      console.error(results.stderr);
      // stat: cannot stat '/non-existent-file': No such file or directory
    } else {
      console.log(results.stdout);
    }
  })
;
```
Stdin can be either a string or a Stream:
```javascript
myContainer.exec(['tee', '/non-existent-file'], {stdin: 'this is impossible!'}, (err, results) => { ... });

myContainer.exec(['cat', '/non-existent-file'], {stdout: true, stderr: true}, (err, results) => {
  if( results.inspect.ExitCode !== 0 ) {
    console.error(results.stderr);
  } else {
    console.log(results.stdout);
    // this is impossible!
  }
});

// Set up a nonsense little stream
const sender = new Stream.Readable();
sender.push('this is impossible!');
sender.push(null);
myContainer.exec(['tee', '/non-existent-file'], {stdin: sender}, (err, results) => { ... });
```
In [live mode](#live) (`{live: true}` in the options), it allows you to play with the streams yourself. The results in the callback become a function that you can use to plug in to Dockerode's demuxer. It also returns the main stream object.
```javascript
myContainer.exec(['someInteractiveCommand'], {live: true, stdin: true}, (err, streamLink) => {
  const stream = streamLink(process.stdout, process.stderr);
  myStream.pipe(stream);
  stream.on('end', () => console.log('done!'));
});

// I haven't tested this since I have no idea why you would want to do it, but you probably could.
myContainer.exec(['cat', '/non-existent-file'], {live: true, stdout: true}, (err, streamLink) => {
  myContainer.exec(['tee', '/another-file'], {stdin: streamLink()}, (err, results) => { ... });
});
```


## Properties and Methods

### `exec()`

Arguments:
* `Cmd`: an array of the command you want to run, exec style.

  This should look the same as normal Dockerode's `Cmd` option.


* `options`: Optional. An object of options.

  See [below](#Options) for an explanation of the options.


* `callback`: Optional. A function to be called when your exec is done.

  Called with (err, results), where results is an object containing `inspect`. If `stdout` or `stderr` are true, the object contains `stdout` and `stderr` as well.

  Or, if `live` is true, see [live option](#live) below.

  If omitted, a Promise is returned instead.


#### Options


##### stdout
Default: `false`

When set to true, the exec's stdout will be returned to you in results.

##### stderr
Default: `false`

When set to true, the exec's stderr will be returned to you in results.

Actually, setting either `stdout` or `stderr` will return both of them anyway.

##### stdin
Default: `null`

This option supports either a string or a Readable Stream. The contents will be sent to the exec's stdin pipe.

If you're using live mode (`live: true`), then you should also set `stdin` if you want to be able to pipe into the returned stream object. It will not pipe the content for you, so you can just set `stdin: true`, or any other truthy value.


##### live
Default: `false`

This mode will allow you to manipulate the streams yourself. You must add `stdout: true`, `stderr: true`, `stdin: true`, or any combination.

Instead of calling your callback with (err, results), it calls it with `(err, streamLink)`, where `streamLink` is a function that can be called with up to two arguments. These arguments are directly fed to Dockerode's modem demuxer, and must be Writeable Stream objects. `streamLink()` returns the (possibly) muxed stream object, allowing you to attach events like `.on('end')`.

### `execRaw()`
The original exec function in Dockerode, preserved under this name if you want to use it.

## Testing
Run `npm test` to execute the test suite. You may need `sudo` if your user does not have permissions to access Docker.

The tests require that your local machine is running an instance of Docker, can pull an image from Docker Hub, and is not already running a container called `simple-dockerode-test`.
