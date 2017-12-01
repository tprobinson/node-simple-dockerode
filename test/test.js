/* global describe:false, afterEach:false step:false */
const assert = require('chai').assert;
const SimpleDockerode = require('../lib/index.js');
const Stream = require('stream');
const StreamBattery = require('streambattery');
/* eslint max-nested-callbacks:0 no-console:0 */

const nonce = 'test';
const rand = 100;
function getTestString() {
  return nonce + Math.floor(Math.random() * rand);
}

function hasFailed(it) {
  let failed = false;
  let tests = it.test.parent.tests;
  for(let i = 0, limit = tests.length; !failed && i < limit; ++i) {
    failed = tests[i].state === 'failed';
  }
  return failed;
}

function checkResults(results) {
  assert.property(results, 'inspect', 'inspection results are available');
  assert.property(results.inspect, 'ExitCode', 'inspection results contain an exit code');
  assert.isNotNull(results.inspect.ExitCode, 'the exec has ended before presenting results');
  assert.equal(results.inspect.ExitCode, 0, 'exec exit code is 0');

  if( 'tries' in results.inspect ) {
    // This means that the workaround had to be engaged, and I want to be warned about that.
    console.warn('This process did not return immediately, causing ' + results.inspect.tries + ' extra inspect calls.');
  }
}

function checkProperty(results, key, val) {
  if( val ) {
    assert.property(results, key, `has a ${key} property`);
    assert.isNotNull(results[key], `has content in ${key}`);
    assert.equal(results[key], val, `${key} is correct`);
  }
}

function hasOutput(results, stdout, stderr) {
  checkProperty(results, 'stdout', stdout);
  checkProperty(results, 'stderr', stderr);
}

let Dockerode;
let container;
describe('Basic', function () {
  let d;
  step('Object Creation', function () {
    assert.doesNotThrow(function () {
      d = new SimpleDockerode();
    }, Error);
    assert.instanceOf(d, SimpleDockerode);
  });
});

describe('Usage', function () {
  Dockerode = new SimpleDockerode();
  const testContainerName = 'simple-dockerode-test';

  describe('Normal Dockerode', function () {
    step('pull an alpine image', function (done) {
      this.timeout(10000);
      Dockerode.pull('alpine:latest', (err, stream) => {
        if( err ) { done(err); return; }
        // stream.pipe(process.stdout);

        // Must consume stream's data or it won't exit.
        stream.on('data', () => {});
        stream.on('end', done);
      });
    });

    step('start an alpine container', function (done) {
      Dockerode.createContainer({Image: 'alpine:latest', Cmd: ['tail', '-f', '/dev/null'], name: testContainerName}, function (err, c) {
        if( err ) { done(err); return; }
        if( c == null ) { done(new Error('Container was null!')); return; }
        if( !('start' in c) ) { done(new Error('Container did not have start function!')); return; }

        container = c;
        container.start(done);
      });
    });
  });

  describe('Output Only', function () {
    step('get stdout, callback', function (done) {
      this.timeout(10000);
      const testString = getTestString();
      container.exec(['echo', '-n', testString], {stdout: true}, (err, results) => {
        if( err ) { done(err); return; }
        checkResults(results);
        hasOutput(results, testString);
        done();
      });
    });
    step('get stdout, promise', function (done) {
      this.timeout(10000);
      const testString = getTestString();
      container.exec(['echo', '-n', testString], {stdout: true}).catch(done).then(results => {
        checkResults(results);
        hasOutput(results, testString);
        done();
      });
    });

    step('get stderr, callback', function (done) {
      this.timeout(10000);
      const testString = getTestString();
      container.exec(['sh', '-c', `echo -n ${testString} >&2`], {stderr: true}, (err, results) => {
        if( err ) { done(err); return; }
        checkResults(results);
        hasOutput(results, null, testString);
        done();
      });
    });
    step('get stderr, promise', function (done) {
      this.timeout(10000);
      const testString = getTestString();
      container.exec(['sh', '-c', `echo -n ${testString} >&2`], {stderr: true}).catch(done).then(results => {
        checkResults(results);
        hasOutput(results, null, testString);
        done();
      });
    });

    step('get stdout and stderr, callback', function (done) {
      this.timeout(10000);
      const testString = getTestString();
      const errorString = nonce + Math.floor(Math.random() * rand);
      container.exec(['sh', '-c', `echo -n ${errorString} >&2 | echo -n ${testString}`], {stdout: true, stderr: true}, (err, results) => {
        if( err ) { done(err); return; }
        checkResults(results);
        hasOutput(results, testString, errorString);
        done();
      });
    });
    step('get stdout and stderr, promise', function (done) {
      this.timeout(10000);
      const testString = getTestString();
      const errorString = nonce + Math.floor(Math.random() * rand);
      container.exec(['sh', '-c', `echo -n ${errorString} >&2 | echo -n ${testString}`], {stdout: true, stderr: true}).catch(done).then(results => {
        checkResults(results);
        hasOutput(results, testString, errorString);
        done();
      });
    });
  });

  describe('Input Only', function () {
    step('send an input string, callback', function (done) {
      this.timeout(10000);
      const testString = getTestString();
      container.exec(['tee', '/tmp/test'], {stdin: testString}, (err, results) => {
        if( err ) { done(err); return; }
        checkResults(results);

        container.exec(['cat', '/tmp/test'], {stdout: true}, (e, r) => {
          if( e != null ) { done(e); return; }
          checkResults(r);
          hasOutput(r, testString);
          done();
        });
      });
    });
    step('send an input string, promise', function (done) {
      this.timeout(10000);
      const testString = getTestString();
      container.exec(['tee', '/tmp/test'], {stdin: testString}).catch(done).then(results => {
        checkResults(results);
        return Promise.resolve();
      }).then(() => container.exec(['cat', '/tmp/test'], {stdout: true})).catch(done).then(results => {
        checkResults(results);
        hasOutput(results, testString);
        done();
      });
    });

    step('send an input stream, callback', function (done) {
      this.timeout(10000);
      const testString = getTestString();

      // Set up a Stream
      const sender = new Stream.Readable();
      sender.push(testString);
      sender.push(null);

      container.exec(['tee', '/tmp/test'], {stdin: sender}, (err, results) => {
        if( err ) { done(err); return; }
        checkResults(results);

        container.exec(['cat', '/tmp/test'], {stdout: true}, (e, r) => {
          if( e != null ) { done(e); return; }
          checkResults(r);
          hasOutput(r, testString);
          done();
        });
      });
    });
    step('send an input stream, promise', function (done) {
      this.timeout(10000);
      const testString = getTestString();

      // Set up a Stream
      const sender = new Stream.Readable();
      sender.push(testString);
      sender.push(null);

      container.exec(['tee', '/tmp/test'], {stdin: sender}).catch(done).then(results => {
        checkResults(results);
        return Promise.resolve();
      }).then(() => container.exec(['cat', '/tmp/test'], {stdout: true})).catch(done).then(results => {
        checkResults(results);
        hasOutput(results, testString);
        done();
      });
    });
  });

  describe('Input And Output', function () {
    step('send an input string and hear it back, callback', function (done) {
      this.timeout(10000);
      const testString = getTestString();
      container.exec(['tee'], {stdin: testString, stdout: true}, (err, results) => {
        if( err ) { done(err); return; }
        checkResults(results);
        hasOutput(results, testString);
        done();
      });
    });
    step('send an input string and hear it back, promise', function (done) {
      this.timeout(10000);
      const testString = getTestString();
      container.exec(['tee'], {stdin: testString, stdout: true}).catch(done).then((results) => {
        checkResults(results);
        hasOutput(results, testString);
        done();
      });
    });

    step('send an input stream and hear it back, callback', function (done) {
      this.timeout(10000);
      const testString = getTestString();

      // Set up a Stream
      const sender = new Stream.Readable();
      sender.push(testString);
      sender.push(null);

      container.exec(['tee'], {stdin: sender, stdout: true}, (err, results) => {
        if( err ) { done(err); return; }
        checkResults(results);
        hasOutput(results, testString);
        done();
      });
    });
    step('send an input stream and hear it back, promise', function (done) {
      this.timeout(10000);
      const testString = getTestString();

      // Set up a Stream
      const sender = new Stream.Readable();
      sender.push(testString);
      sender.push(null);

      container.exec(['tee'], {stdin: sender, stdout: true}).catch(done).then((results) => {
        checkResults(results);
        hasOutput(results, testString);
        done();
      });
    });
  });

  describe('Detached I/O', function () {
    step('detached exec into the container, callback, no options', function (done) {
      this.timeout(10000);
      const testString = getTestString();

      container.exec(['echo', testString], (err, results) => {
        if( err ) { done(err); return; }
        checkResults(results);
        assert.notProperty(results, 'stdout');
        assert.notProperty(results, 'stderr');
        done();
      });
    });
    step('detached exec into the container, promise, no options', function (done) {
      this.timeout(10000);
      const testString = getTestString();

      container.exec(['echo', testString]).then((results) => {
        checkResults(results);
        assert.notProperty(results, 'stdout');
        assert.notProperty(results, 'stderr');
        done();
      });
    });
    step('detached exec into the container, callback, blank options', function (done) {
      this.timeout(10000);
      const testString = getTestString();

      container.exec(['echo', testString], {}, (err, results) => {
        if( err ) { done(err); return; }
        checkResults(results);
        assert.notProperty(results, 'stdout');
        assert.notProperty(results, 'stderr');
        done();
      });
    });
    step('detached exec into the container, promise, blank options', function (done) {
      this.timeout(10000);
      const testString = getTestString();

      container.exec(['echo', testString], {}).then((results) => {
        checkResults(results);
        assert.notProperty(results, 'stdout');
        assert.notProperty(results, 'stderr');
        done();
      });
    });
  });

  describe('Output Only, Live', function () {
    step('fail bad arguments', function (done) {
      this.timeout(10000);
      container.exec(['echo'], {live: true}, err => {
        assert.instanceOf(err, Error, 'correctly identified invalid arguments');
        done();
      });
    });

    step('get stdout, callback', function (done) {
      this.timeout(10000);
      const testString = getTestString();

      container.exec(['echo', '-n', testString], {live: true, stdout: true}, (err, hose) => {
        if( err ) { done(err); return; }
        const battery = new StreamBattery(['stdout', 'stderr'], (battError, battResults) => {
          if( battError ) { done(battError); }
          hasOutput(battResults, testString);
          done();
        });
        hose(...battery.streams).on('end', () => battery.end());
      });
    });
    step('get stdout, promise', function (done) {
      this.timeout(10000);
      const testString = getTestString();

      container.exec(['echo', '-n', testString], {live: true, stdout: true}).catch(done).then(hose => {
        const battery = new StreamBattery(['stdout', 'stderr'], (battError, battResults) => {
          if( battError ) { done(battError); }
          hasOutput(battResults, testString);
          done();
        });
        hose(...battery.streams).on('end', () => battery.end());
      });
    });

    step('get stderr, callback', function (done) {
      this.timeout(10000);
      const testString = getTestString();
      container.exec(['sh', '-c', `echo -n ${testString} >&2`], {live: true, stderr: true}, (err, hose) => {
        if( err ) { done(err); return; }
        const battery = new StreamBattery(['stdout', 'stderr'], (battError, battResults) => {
          if( battError ) { done(battError); }
          hasOutput(battResults, null, testString);
          done();
        });
        hose(...battery.streams).on('end', () => battery.end());
      });
    });
    step('get stderr, promise', function (done) {
      this.timeout(10000);
      const testString = getTestString();
      container.exec(['sh', '-c', `echo -n ${testString} >&2`], {live: true, stderr: true}).catch(done).then(hose => {
        const battery = new StreamBattery(['stdout', 'stderr'], (battError, battResults) => {
          if( battError ) { done(battError); }
          hasOutput(battResults, null, testString);
          done();
        });
        hose(...battery.streams).on('end', () => battery.end());
      });
    });

    step('get stdout and stderr, callback', function (done) {
      this.timeout(10000);
      const testString = getTestString();
      const errorString = nonce + Math.floor(Math.random() * rand);
      container.exec(['sh', '-c', `echo -n ${errorString} >&2 | echo -n ${testString}`], {live: true, stdout: true, stderr: true}, (err, hose) => {
        if( err ) { done(err); return; }
        const battery = new StreamBattery(['stdout', 'stderr'], (battError, battResults) => {
          if( battError ) { done(battError); }
          hasOutput(battResults, testString, errorString);
          done();
        });
        hose(...battery.streams).on('end', () => battery.end());
      });
    });
    step('get stdout and stderr, promise', function (done) {
      this.timeout(10000);
      const testString = getTestString();
      const errorString = nonce + Math.floor(Math.random() * rand);
      container.exec(['sh', '-c', `echo -n ${errorString} >&2 | echo -n ${testString}`], {live: true, stdout: true, stderr: true}).catch(done).then(hose => {
        const battery = new StreamBattery(['stdout', 'stderr'], (battError, battResults) => {
          if( battError ) { done(battError); }
          hasOutput(battResults, testString, errorString);
          done();
        });
        hose(...battery.streams).on('end', () => battery.end());
      });
    });
  });

  describe('Input Only, Live', function () {
    step('send an input stream, callback', function (done) {
      this.timeout(10000);
      const testString = getTestString();

      // Set up a Stream
      const sender = new Stream.Readable();
      sender.push(testString);
      sender.push(null);

      container.exec(['tee', '/tmp/test'], {live: true, stdin: true}, (err, hose) => {
        if( err ) { done(err); return; }
        sender.pipe(hose());

        container.exec(['cat', '/tmp/test'], {stdout: true}, (e, r) => {
          if( e != null ) { done(e); return; }
          checkResults(r);
          hasOutput(r, testString);
          done();
        });
      });
    });
    step('send an input stream, promise', function (done) {
      this.timeout(10000);
      const testString = getTestString();

      // Set up a Stream
      const sender = new Stream.Readable();
      sender.push(testString);
      sender.push(null);

      container.exec(['tee', '/tmp/test'], {live: true, stdin: true}).catch(done).then(hose => {
        const stream = hose();
        sender.pipe(stream);
        return new Promise(resolve => {
          stream.on('end', resolve);
        });
      }).then(() => container.exec(['cat', '/tmp/test'], {stdout: true})).catch(done).then(results => {
        checkResults(results);
        hasOutput(results, testString);
        done();
      });
    });
  });

  describe('Input And Output, Live', function () {
    step('send an input stream and hear it back, callback', function (done) {
      this.timeout(10000);
      const testString = getTestString();

      // Set up a Stream
      const sender = new Stream.Readable();
      sender.push(testString);
      sender.push(null);

      container.exec(['tee'], {live: true, stdin: true, stdout: true}, (err, hose) => {
        if( err ) { done(err); return; }
        const battery = new StreamBattery(['stdout', 'stderr'], (battError, battResults) => {
          if( battError ) { done(battError); }
          hasOutput(battResults, testString);
          done();
        });
        const stream = hose(...battery.streams);
        sender.pipe(stream);
        stream.on('end', () => battery.end());
      });
    });
    step('send an input stream and hear it back, promise', function (done) {
      this.timeout(10000);
      const testString = getTestString();

      // Set up a Stream
      const sender = new Stream.Readable();
      sender.push(testString);
      sender.push(null);

      container.exec(['tee'], {live: true, stdin: true, stdout: true}).catch(done).then(hose => {
        const battery = new StreamBattery(['stdout', 'stderr'], (battError, battResults) => {
          if( battError ) { done(battError); }
          hasOutput(battResults, testString);
          done();
        });
        const stream = hose(...battery.streams);
        sender.pipe(stream);
        stream.on('end', () => battery.end());
      });
    });
  });

  afterEach(function () {
    if( hasFailed(this) ) {
      if( container != null ) {
        container.stop(err => {
          if( err != null ) { throw new Error(err); }
          container.remove(e => {
            if( e != null ) { throw new Error(e); }
          });
        });
      }
    }
  });
});

describe('Cleanup', function () {
  step('kill container', function (done) {
    if( container != null ) {
      this.timeout(10000);
      container.kill(done);
    }
  });

  step('remove container', function (done) {
    if( container != null ) {
      this.timeout(10000);
      container.remove(done);
    }
  });
});
