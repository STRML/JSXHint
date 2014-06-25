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

var jshint = require('jshint').JSHINT;
var gather = require('jshint/src/cli').gather;
var react = require('react-tools');
var through = require('through');
var docblock = require('jstransform/src/docblock');
var fork = require('child_process').fork;
var async = require('async');
var path = require('path');
var mkdirp = require('mkdirp');

var currFile = require.main ? require.main.filename : undefined;
var prjRoot = path.dirname(currFile || process.cwd());

/**
 * Transform a JSX file into a JS file for linting.
 * @async
 * @param  {String}   fileStream Readable stream containing file contents.
 * @param  {String}   fileName   Name of the file; "stdin" if reading from stdio.
 * @param  {Function} cb   The callback to call when it's ready.
 */
function transformJSX(fileStream, fileName, cb){

  function processFile(){
    try {
      var hasDocblock = docblock.parseAsObject(docblock.extract(source)).jsx;
      var hasExtension = /\.jsx$/.exec(fileName) || fileName === "stdin";

      if (hasExtension && !hasDocblock) {
        source = '/** @jsx React.DOM */' + source;
      }

      if (hasExtension || hasDocblock) {
        source = react.transform(source, {harmony: true});
      }

      cb(null, source);
    } catch(e) {
      e.fileName = fileName;
      cb(e);
    }
  }

  // Allow omitting filename
  if (typeof fileName === "function"){
    cb = fileName;
    fileName = typeof fileStream === "string" ? fileStream : 'stdin';
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
  return path.relative('/', path.resolve(fileName));
}

/**
 * Find a config file, searching up from dir, and copy it to the tmpdir. The
 * JSHint CLI uses these to determine settings.
 * We attempt to preserve the original folder structure inside the tmpdir
 * so that we have no unexpected configuration file priority.
 * @param  {String} dir Path
 */
function copyConfig(dir, file, cb){
  var check = path.resolve(dir, file);
  if (fs.existsSync(check)) {
    var destination = path.join(exports.tmpdir, getCleanAbsolutePath(check));
    var rs = fs.createReadStream(check);
    var ws = fs.createWriteStream(destination);
    ws.on('close', cb);
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
 * @param  {Array}   files  File paths to transform.
 * @param  {Function} cb    Callback.
 */
function transformFiles(files, cb){
  async.map(files, transformJSX, function(err, fileContents){
    if(err) return cb(err);
    createTempFiles(files, fileContents, function(err, tempFileNames){
      if(err) return cb(err);
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
 * @param  {Function} cb                 Callback.
 */
function transformStream(fileStream, cb){
  transformJSX(fileStream, function(err, contents){
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
function run(files, cb){
  if (Array.isArray(files)){
    transformFiles(files, cb);
  } else if (files instanceof require('stream').Readable){
    transformStream(files, cb);
  } else {
    throw new Error("Invalid input.");
  }
}

exports.tmpdir = path.join(require('os').tmpdir(), 'jsxhint', String(process.pid));
exports.transformJSX = transformJSX;
exports.transformFiles = transformFiles;
exports.transformStream = transformStream;
exports.run = run;
