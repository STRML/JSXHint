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
var rimraf = require('rimraf');
var glob = require('glob-all');

// The jshint call will throw an error if it encounters an option that it does
// not recognize. Therefore, we need to filter out jsxhint options before
// calling jshint. Because jsxhint is run in part of a callback of jshint after
// this check, we need to store jsxhint options someplace globally so we can
// access them inside the callback.
var acceptedJSXHintOptions = [
  '--jsx-only',
  '--babel',
  '--babel-experimental',
  '--harmony',
  '--es6module',
  '--non-strict-es6module'
];
var jsxhintOptions = {};

/**
 * Intercept -h to show jshint help.
 */
function showHelp(){
  var jshint_proc = fork(require.resolve('jshint/bin/jshint'), ['-h'], {silent: true});
  var ts = through(function write(chunk){
    this.queue(chunk.toString().replace(/(jshint)\b/g, 'jsxhint'));
  }, function end() {
    // This feels like a hack. There might be a better way to do this.
    this.queue('\nThe above options are native to JSHint, which JSXHint extends.\n');
    this.queue('\x1b[1m'); // bold
    this.queue('\nJSXHint Options:\n');
    this.queue('\x1b[0m');
    this.queue('      --jsx-only         Only transform files with the .jsx extension.\n' +
               '                         Will run somewhat faster.\n');
    this.queue('      --babel            Use babel (6to5) instead of react esprima.\n' +
               '                         Useful if you are using es6-module, etc. You must \n' +
               '                         install the module `babel` manually with npm.\n');
    this.queue('      --babel-experimental  Use babel with experimental support for ES7.\n' +
               '                            Useful if you are using es7-async, etc.\n');
    this.queue('      --harmony          Use react esprima with ES6 transformation support.\n' +
               '                         Useful if you are using both es6-class and react.\n');
    this.queue('      --es6module             Pass the --es6module flag to react tools.\n');
    this.queue('      --non-strict-es6module  Pass this flag to react tools.\n');
  });
  jshint_proc.stderr.pipe(ts).pipe(process.stderr);
}

/**
 * Intercept -v, shows jsxhint and jshint versions.
 */
function showVersion(){
  var jshint_proc = fork(__dirname + '/node_modules/jshint/bin/jshint', ['-v'], {silent: true});
  var ts = through(function write(chunk){
    this.queue("JSXHint v" + require('./package.json').version + " (" +
      chunk.toString().replace("\n", "") + ")\n");
  });
  jshint_proc.stderr.pipe(ts).pipe(process.stderr);
}

/**
 * Wrapper around globbing function. Ignores '.' which has special meaning in jshint.
 * @param  {Array}    args File/glob list.
 * @param  {Object}   opts Glob options.
 * @param  {Function} cb   Callback.
 */
function runGlob(args, opts, cb) {
  var dotIdx = args.indexOf('.');
  if (dotIdx !== -1) {
    args.splice(dotIdx, 1);
  }
  glob(args, opts, function(err, globbed) {
    if (Array.isArray(globbed) && dotIdx !== -1) globbed.push('.');
    cb(err, globbed);
  });
}

/**
 * Proxy run function. Reaches out to jsxhint to transform
 * incoming stream or read files & transform.
 * @param  {Object}   opts Opts as created by JSHint.
 * @param  {Function} cb   Callback.
 */
function run(opts, cb){
  opts.extensions = opts.extensions ? opts.extensions + ',.jsx' : '.jsx';

  // glob-all fixes windows glob issues and provides array support
  // i.e. jsxhint ['jsx/**/*','!scripts/**/*','scripts/outlier.jsx']
  runGlob(opts.args, {nodir: true}, function(err, globbed) {
    if (err) return cb(err);

    // Reassign the globbed files back to opts.args, so it looks like we just
    // fed jshint a big list of files.
    opts.args = globbed;
    var files = jshintcli.gather(opts);

    if (opts.useStdin) {
      jsxhint.transformStream(process.stdin, jsxhintOptions, cb);
    } else {
      jsxhint.transformFiles(files, jsxhintOptions, cb);
    }
  });
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
    if (filesMap) {
      results.forEach(function(result){
        result.file = filesMap[result.file];
      });
    }
    return reporter(results, data, opts);
  };
}

/**
 * Unlink temporary files created by JSX processor.
 */
function unlinkTemp(){
  try {
    rimraf.sync(jsxhint.tmpdir);
  } catch(e) {
    // ignore
  }
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
        opts.reporter = interceptReporter(opts.reporter, files);

        // always false, stdin is never going to be usable as we may have read from it for the
        // transform.
        opts.useStdin = false;

        if (err) {
          opts.reporter([err], {}, opts);
          return process.exit(1);
        }

        opts.args = Object.keys(files);

        // Weird sync/async function, jshint oddity
        var done = function(passed){
          if (passed == null) return;
          unlinkTemp();
          cb(passed);
        };
        done(jshintcli.originalRun(opts, done));
      });
    };

    var argv = process.argv.filter(function(value) {
      if (acceptedJSXHintOptions.indexOf(value) > -1) {
        // Store the jsxhint specific option globally so we can access it when
        // we run the transformation.
        jsxhintOptions[value] = true;

        // Need to filter out jsxhint specific options so jshint doesn't throw
        // an unknown option error.
        return false;
      }

      return true;
    });

    jshintcli.interpret(argv);
  }
} catch (e){
  console.log(e.message.replace(/cli\.js/, 'jsxhint'));
  unlinkTemp();
  process.exit(1);
}
