/* global describe:false, it:false afterEach:false step:false */
const assert = require('chai').assert;
const SimpleDockerode = require('../lib/index.js');
const Stream = require('stream');
/* eslint-disable max-nested-callbacks */

const nonce = 'test';

let Dockerode;
let container;

function hasFailed(it) {
  let failed = false;
  let tests = it.test.parent.tests;
  for(let i = 0, limit = tests.length; !failed && i < limit; ++i) {
    failed = tests[i].state === 'failed';
  }
  return failed;
}

describe('Basic', function () {
  let d;
  it('should not throw', function () { assert.doesNotThrow(function () {
    d = new SimpleDockerode();
  }, Error); });

  it('should be a SimpleDockerode', function () { assert.instanceOf(d, SimpleDockerode); });
});

describe('Usage', function () {
  Dockerode = new SimpleDockerode();
  const testContainerName = 'simple-dockerode-test';

  step('should be able to pull an alpine image', function (done) {
    this.timeout(10000);
    Dockerode.pull('alpine:latest', (err, stream) => {
      if( err != null ) { done(err); return; }
      // stream.pipe(process.stdout);

      // Must consume stream's data or it won't exit.
      stream.on('data', () => {});
      stream.on('end', done);
    });
  });

  step('should be able to start an alpine container', function (done) {
    Dockerode.createContainer({Image: 'alpine:latest', Cmd: ['tail', '-f', '/dev/null'], name: testContainerName}, function (err, c) {
      if( err != null ) { done(err); return; }
      if( c == null ) { done(new Error('Container was null!')); return; }
      if( !('start' in c) ) { done(new Error('Container did not have start function!')); return; }

      container = c;
      container.start(done);
    });
  });

  // step('should be able to detached exec into the container', function (done) {
  //   this.timeout(10000);
  //   container.exec(['echo'], (err, results) => {
  //     if( err != null ) { done(err); return; }
  //     done();
  //   });
  // });

  step('should be able to get stdout', function (done) {
    this.timeout(10000);
    const testString = nonce + Math.floor(Math.random() * 10);
    container.exec(['echo', '-n', testString], {stdout: true}, (err, results) => {
      if( err != null ) { done(err); return; }
      assert.equal(results.inspect.ExitCode, 0, 'error code is 0');
      assert.equal(results.stdout, testString, 'output is correct');
      done();
    });
  });

  step('should be able to get stderr', function (done) {
    this.timeout(10000);
    const testString = nonce + Math.floor(Math.random() * 10);
    container.exec(['sh', '-c', `echo -n ${testString} >&2`], {stderr: true}, (err, results) => {
      if( err != null ) { done(err); return; }
      assert.equal(results.inspect.ExitCode, 0, 'error code is 0');
      assert.equal(results.stderr, testString, 'output is correct');
      done();
    });
  });

  step('should be able to get stdout and stderr', function (done) {
    this.timeout(10000);
    const testString = nonce + Math.floor(Math.random() * 10);
    const errorString = nonce + Math.floor(Math.random() * 10);
    container.exec(['sh', '-c', `echo -n ${errorString} >&2 | echo -n ${testString}`], {stdout: true, stderr: true}, (err, results) => {
      if( err != null ) { done(err); return; }
      assert.equal(results.inspect.ExitCode, 0, 'error code is 0');
      assert.equal(results.stdout, testString, 'stdout is correct');
      assert.equal(results.stderr, errorString, 'stderr is correct');
      done();
    });
  });

  step('should be able to send an input string', function (done) {
    this.timeout(10000);
    const testString = nonce + Math.floor(Math.random() * 10);
    container.exec(['tee', '/tmp/test'], {stdin: testString}, (err, results) => {
      if( err != null ) { done(err); return; }
      assert.equal(results.inspect.ExitCode, 0, 'error code is 0');

      container.exec(['cat', '/tmp/test'], {stdout: true}, (e, r) => {
        if( e != null ) { done(e); return; }
        assert.equal(r.inspect.ExitCode, 0, 'error code is 0');
        assert.equal(r.stdout, testString, 'output is correct');
        done();
      });
    });
  });

  step('should be able to send an input string and hear it back', function (done) {
    this.timeout(10000);
    const testString = nonce + Math.floor(Math.random() * 10);
    container.exec(['tee'], {stdin: testString, stdout: true}, (err, results) => {
      if( err != null ) { done(err); return; }
      assert.equal(results.inspect.ExitCode, 0, 'error code is 0');
      assert.equal(results.stdout, testString, 'output is correct');
      done();
    });
  });

  step('should be able to send an input stream', function (done) {
    this.timeout(10000);

    const testString = nonce + Math.floor(Math.random() * 10);

    // Set up a Stream
    const sender = new Stream.Readable();
    sender.push(testString);
    sender.push(null);

    container.exec(['tee', '/tmp/test'], {stdin: sender}, (err, results) => {
      if( err != null ) { done(err); return; }
      console.log(results.inspect);

      assert.equal(results.inspect.ExitCode, 0, 'error code is 0');

      container.exec(['cat', '/tmp/test'], {stdout: true}, (e, r) => {
        if( e != null ) { done(e); return; }

        console.log(r.inspect);
        assert.equal(r.inspect.ExitCode, 0, 'error code is 0');
        assert.equal(r.stdout, testString, 'output is correct');
        done();
      });
    });
  });

  step('should be able to send an input stream and hear it back', function (done) {
    this.timeout(10000);

    const testString = nonce + Math.floor(Math.random() * 10);

    // Set up a Stream
    const sender = new Stream.Readable();
    sender.push(testString);
    sender.push(null);

    container.exec(['tee'], {stdin: sender, stdout: true}, (err, results) => {
      if( err != null ) { done(err); return; }
      assert.equal(results.inspect.ExitCode, 0, 'error code is 0');
      assert.equal(results.stdout, testString, 'output is correct');
      done();
    });
  });

  step('should be able to detached exec into the container', function (done) {
    this.timeout(10000);
    container.exec(['echo'], (err, results) => {
      if( err != null ) { done(err); return; }
      console.log(err, results);
      done();
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
