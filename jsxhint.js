/**
 * JSXHint CLI tool
 *
 * Copyright 2013 (c) Samuel Reed
 * Inspired by and based on JSXHint by Conde Nast
 *
 * Please see LICENSE for details
 *
 */

'use strict';

var fs = require('graceful-fs');
var path = require('path');

var react = require('react-tools');
try {
  var babel = require('babel');
} catch(e) {
  // ignore
}
var async = require('async');
var path = require('path');
var mkdirp = require('mkdirp');
var debug = require('debug')('jsxhint');

// Check map for copied support files (package.json, .jshintrc) for a speedup.
var checkedSupportFiles = {};

/**
 * Transform a JSX file into a JS file for linting.
 * @async
 * @param  {String}   fileStream Readable stream containing file contents.
 * @param  {String}   fileName   Name of the file; "stdin" if reading from stdio.
 * @param  {Object}   opts       Options.
 * @param  {Function} cb         The callback to call when it's ready.
 */
function transformJSX(fileStream, fileName, opts, cb){

  function transformSource(source){
    if (opts['--babel'] || opts['--babel-experimental']) {
      return babel.transform(source, {experimental: opts['--babel-experimental'] || false}).code;
    } else {
      return react.transform(source, {
        harmony: opts['--harmony'],
        stripTypes: true,
        nonStrictEs6module: opts['--non-strict-es6module'] || false,
        es6module: opts['--es6module'] || false
      });
    }
  }

  function transformError(error){
    if (opts['--babel'] || opts['--babel-experimental']) {
      return {
        file: fileName,
        error: {
          line: error.loc.line,
          character: error.loc.column,
          reason: error.stack.match(/.*:\s(.*)\s\(\d+:\d+\)/)[1],
          code: 'E041'
        }
      };
    } else {
      return {
        file: fileName,
        error: {
          line: error.lineNumber,
          character: error.column,
          reason: error.description,
          code: 'E041'
        }
      };
    }
  }

  function processFile(){
    var hasExtension = /\.jsx$/.exec(fileName) || fileName === "stdin";
    var err;
    try {
      if ((opts['--jsx-only'] && hasExtension) || !opts['--jsx-only']) {
        source = transformSource(source);
      }
    } catch(e) {
      // Only throw an error if this was definitely a jsx file.
      // Seems that esprima has some problems with some js syntax.
      if (hasExtension) {
        console.error("Error while transforming jsx in file " + fileName + "\n", e.stack);
        err = transformError(e);
      }
    } finally {
      cb(err, source);
    }
  }

  // Allow omitting filename
  if (typeof fileName === "object"){
    cb = arguments[2];
    opts = arguments[1];
    fileName = typeof fileStream === "string" ? fileStream : 'stdin';
  }

  if (!babel && (opts['--babel'] || opts['--babel-experimental'])) {
    throw new Error("Optional babel parser not installed. Please `npm install [-g] babel`.");
  }

  // Allow passing strings into this method e.g. when using it as a lib
  if (typeof fileStream === "string"){
    fileStream = fs.createReadStream(fileStream, {encoding: "utf8"});
  }

  // Drain stream
  var source = '';
  fileStream.on('data', function(chunk){
    source += chunk;
  });
  fileStream.on('end', processFile);
  fileStream.on('error', cb);
}

/**
 * Given a fileName, get a multi-platform compatible file path that can be appended to an existing filepath.
 * This is not necessary on *nix but is important on Windows because absolutePath + absolutePath
 * leads to the concatenation of a drive letter (`c:/`) which is a broken path.
 * @param  {String} fileName file name.
 * @return {String}          Cleaned file name.
 */
function getCleanAbsolutePath(fileName) {
  return '/' + path.relative('/', path.resolve(fileName));
}

/**
 * Find a config file, searching up from dir, and copy it to the tmpdir. The
 * JSHint CLI uses these to determine settings.
 * We attempt to preserve the original folder structure inside the tmpdir
 * so that we have no unexpected configuration file priority.
 * @param  {String} dir Path
 */
function copyConfig(dir, file, cb){
  var filePath = path.resolve(dir, file);
  if (checkedSupportFiles[filePath]) return cb();
  checkedSupportFiles[filePath] = true;

  if (fs.existsSync(filePath)) {
    var destination = path.join(exports.tmpdir, getCleanAbsolutePath(filePath));
    var rs = fs.createReadStream(filePath);
    var ws = fs.createWriteStream(destination);
    debug("Copying support file from %s to temp directory.", filePath);
    ws.on('close', cb);
    // Indicate that this is copied already to prevent unnecessary file operations.
    return rs.pipe(ws);
  }

  // Return null at the root. This is the case when dir and its parent are the same.
  var parent = path.resolve(dir, '..');
  return dir === parent ? cb() : copyConfig(parent, file, cb);
}

/**
 * Given a filename and contents, write to disk.
 * @private
 * @param  {String}   fileName File name.
 * @param  {String}   contents File contents.
 * @param  {Function} cb       Callback.
 */
function createTempFile(fileName, contents, cb){
  fileName = getCleanAbsolutePath(fileName);
  var file = path.join(exports.tmpdir, fileName);
  mkdirp(path.dirname(file), function(){
    var dir = path.dirname(fileName);
    // We need to write the file's contents to disk, but also grab
    // its associated .jshintrc and package.json so that jshint can lint it
    // with the proper settings.
    async.parallel([
      function(cb){ fs.createWriteStream(file).end(contents, cb); },
      async.apply(copyConfig, dir, '.jshintrc'),
      async.apply(copyConfig, dir, 'package.json')
    ], function(){ cb(null, file); });
  });
}

/**
 * Given a list of filenames and their contents, write temporary files
 * to disk.
 * @private
 * @param  {Array}   fileNames    File names.
 * @param  {Array}   fileContents File contents.
 * @param  {Function} cb          Callback.
 */
function createTempFiles(fileNames, fileContents, cb){
  async.map(fileNames, function(fileName, cb){
    createTempFile(fileName, fileContents[fileNames.indexOf(fileName)], cb);
  }, cb);
}

/**
 * Transform a list of files from jsx. Calls back with a map relating
 * the new files (temp files) to the old file names, e.g.
 * {tempFile: originalFileName}
 *
 * @param  {Array}    files File paths to transform.
 * @param  {Object}   opts  Options.
 * @param  {Function} cb    Callback.
 */
function transformFiles(files, opts, cb){
  async.map(files, function(fileStream, fileName, cb){
    if (arguments.length === 2) {
      cb = arguments[1];
      fileName = arguments[0];
      return transformJSX(fileName, opts, cb);
    } else {
      return transformJSX(fileStream, fileName, opts, cb);
    }
  }, function(err, fileContents){
    if(err) return cb(err);
    debug("Successfully transformed %d files to JSX.", files.length);
    createTempFiles(files, fileContents, function(err, tempFileNames){
      if(err) return cb(err);
      debug("Moved %d files to temp directory at %s.", files.length, exports.tmpdir);
      // Create map of temp file names to original file names
      var fileNameMap = {};
      files.forEach(function(fileName, index){
        fileNameMap[tempFileNames[index]] = fileName;
      });
      cb(null, fileNameMap);
    });
  });
}

/**
 * Given a stream (stdin), transform and save to a temporary file so it can be piped
 * into JSHint.
 * JSHint in stream mode attempts to read from process.stdin.
 * Since we can't reload process.stdin with the new transformed data (without forking),
 * we instead just write to a temp file and load it into JSHint.
 *
 * @param  {ReadableStream}   fileStream Readable stream containing data to transform.
 * @param  {Object}   opts               Options.
 * @param  {Function} cb                 Callback.
 */
function transformStream(fileStream, opts, cb){
  transformJSX(fileStream, opts, function(err, contents){
    if(err) return cb(err);
    createTempFile(path.join(process.cwd(), 'stdin'), contents, function(noErr, tempFileName){
      var out = {};
      out[tempFileName] = 'stdin';
      cb(null, out);
    });
  });
}

/**
 * Called directly from cli.
 * There are two ways files can be added; either they are specified on the cli
 * or they are entered via stdin.
 * If they are named from the cli, we need to treat them as globs.
 */
function run(files, opts, cb){
  if (Array.isArray(files)){
    transformFiles(files, opts, cb);
  } else if (files instanceof require('stream').Readable){
    transformStream(files, opts, cb);
  } else {
    throw new Error("Invalid input.");
  }
}

exports.tmpdir = path.join(require('os').tmpdir(), 'jsxhint', String(process.pid));
exports.transformJSX = transformJSX;
exports.transformFiles = transformFiles;
exports.transformStream = transformStream;
exports.run = run;
