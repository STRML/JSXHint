#!/usr/bin/env node
/**
 * JSXHint CLI tool
 *
 * Copyright 2013 (c) Condé Nast
 *
 * Please see LICENSE for details
 *
 */

'use strict';

var jsxhint = require('./jsxhint');
var jshintcli = require('jshint/src/cli');
var fork = require('child_process').fork;
var through = require('through');
var fs = require('fs');

/**
 * Intercept -h to show jshint help.
 */
function showHelp(){
  var jshint_proc = fork('./node_modules/jshint/bin/jshint', ['-h'], {silent: true});
  var ts = through(function write(chunk){
    this.queue(chunk.toString().replace(/jshint/g, 'jsxhint'));
  });
  jshint_proc.stderr.pipe(ts).pipe(process.stderr);
}

/**
 * Intercept -v, shows jsxhint and jshint versions.
 */
function showVersion(){
  var jshint_proc = fork('./node_modules/jshint/bin/jshint', ['-v'], {silent: true});
  var ts = through(function write(chunk){
    this.queue("JSXHint v" + require('./package.json').version + " (" +
      chunk.toString().replace("\n", "") + ")\n");
  });
  jshint_proc.stderr.pipe(ts).pipe(process.stderr);}

/**
 * Proxy run function. Reaches out to jsxhint to transform
 * incoming stream or read files & transform.
 * @param  {Object}   opts Opts as created by JSHint.
 * @param  {Function} cb   Callback.
 */
function run(opts, cb){
  var files = jshintcli.gather(opts);

  if (opts.useStdin) {
    jsxhint.transformStream(process.stdin, cb);
  } else {
    jsxhint.transformFiles(files, cb);
  }
}

/**
 * Intercept configured reporter and change file names so it looks
 * like nothing happened.
 * @param  {Reporter} reporter JSHint reporter
 * @param  {Object}   filesMap Map related transformed files to original file paths.
 * @return {Function}          Wrapper around configured reporter. Same arity as reporter.
 */
function interceptReporter(reporter, filesMap){
  if(!reporter) reporter = require('jshint/src/reporters/default').reporter;
  return function(results, data, opts){
    results.forEach(function(result){
      result.file = filesMap[result.file];
    });
    return reporter(results, data, opts);
  };
}

/**
 * Unlink temporary files created by JSX processor.
 * @param  {Object} files FileMap object (keys = transformed file paths)
 */
function unlinkTemp(files){
  if (typeof files !== "object") return;
  Object.keys(files).forEach(fs.unlinkSync);
}


// Run program. Intercept JSHintCLI.run to process JSX files.
try {
  if (process.argv.indexOf('-h') !== -1 || process.argv.indexOf('--help') !== -1){
    showHelp();
  } else if (process.argv.indexOf('-v') !== -1 || process.argv.indexOf('--version') !== -1){
    showVersion();
  } else {
    jshintcli.originalRun = jshintcli.run;
    jshintcli.run = function(opts, cb){
      // Files can either be string data (from stdin), or an object
      // where keys are the original file name and values are the temporary file
      // name where the transformed source is written.
      run(opts, function(err, files){
        opts.args = Object.keys(files);
        opts.reporter = interceptReporter(opts.reporter, files);
        // always false, stdin is never going to be usable as we may have read from it for the
        // transform.
        opts.useStdin = false;

        // Weird sync/async function, jshint oddity
        var done = function(passed){
          if (passed == null) return;
          unlinkTemp(files);
          cb();
        };
        done(jshintcli.originalRun(opts, done));
      });
    };
    jshintcli.interpret(process.argv);
  }
} catch (e){
  console.log(e.message.replace(/cli\.js/, 'jsxhint'));
  process.exit(1);
}
