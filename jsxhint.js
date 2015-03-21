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

var fs = require('fs-extra');
var path = require('path');
var Promise = require('bluebird');
var utils = require('./utils');
var debug = require('debug')('jsxhint');

var react = require('react-tools');
try {
  var babel = require('babel');
} catch(e) {
  // ignore
}

/**
 * Transform a JSX file into a JS file for linting.
 * @async
 * @param  {String}   fileStream Readable stream containing file contents.
 * @param  {String}   fileName   Name of the file; "stdin" if reading from stdio.
 * @param  {Object}   opts       Options.
 * @param  {Function} cb         The callback to call when it's ready.
 */
function transformJSX(fileStream, fileName, opts, cb){

  // Allow omitting filename
  if (typeof fileName === "object"){
    cb = opts;
    opts = fileName;
    fileName = fileStream;
  }

  if (!babel && (opts['--babel'] || opts['--babel-experimental'])) {
    throw new Error("Optional babel parser not installed. Please `npm install [-g] babel`.");
  }

  // Allow passing strings into this method e.g. when using it as a lib
  if (typeof fileStream === "string"){
    fileStream = fs.createReadStream(fileStream, {encoding: "utf8"});
  }

  return utils.drainStream(fileStream)
  .then(function processFile(source) {
    var hasExtension = /\.jsx$/.exec(fileName) || fileName === "stdin";
    // console.error('has extension', hasExtension);
    // console.log(fileName);
    if ((opts['--jsx-only'] && hasExtension) || !opts['--jsx-only']) {
      try {
        return transformSource(source, opts);
      } catch(e) {
        // Only throw an error if this was definitely a jsx file.
        // Seems that esprima has some problems with some js syntax.
        if (hasExtension) {
          console.error("Error while transforming jsx in file " + fileName + "\n", e.stack);
          throw utils.transformError(fileName, e, opts);
        }
      }
    }
    return source;
  })
  .nodeify(cb);
}

function transformSource(source, opts){
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

/**
 * Transform a list of files from jsx. Calls back with a map relating
 * the new files (temp files) to the old file names, e.g.
 * {tempFile: originalFileName}
 *
 * @param  {Array}    files File paths to transform.
 * @param  {Object}   jsxhintOpts        Options for JSXHint.
 * @param  {Object}   jshintOpts         Options for JSHint.
 * @param  {Function} cb    Callback.
 */
function transformFiles(files, jsxhintOpts, jshintOpts, cb){
  return Promise.map(files, function(fileName) {
    return transformJSX(fileName, jsxhintOpts);
  })
  .then(function(filesContents) {
    debug("Successfully transformed %d files to JSX.", files.length);

    var tempFileNames = utils.createTempFiles(files, filesContents);
    debug("Moved %d files to temp directory at %s.", files.length, exports.tmpdir);
    // Create map of temp file names to original file names
    var fileNameMap = {};
    files.forEach(function(fileName, index){
      fileNameMap[tempFileNames[index]] = fileName;
    });
    return fileNameMap;
  })
  .nodeify(cb);
}

/**
 * Given a stream (stdin), transform and save to a temporary file so it can be piped
 * into JSHint.
 * JSHint in stream mode attempts to read from process.stdin.
 * Since we can't reload process.stdin with the new transformed data (without forking),
 * we instead just write to a temp file and load it into JSHint.
 *
 * @param  {ReadableStream}   fileStream Readable stream containing data to transform.
 * @param  {Object}   jsxhintOpts        Options for JSXHint.
 * @param  {Object}   jshintOpts         Options for JSHint.
 * @param  {Function} cb                 Callback.
 */
function transformStream(fileStream, jsxhintOpts, jshintOpts, cb){
  // JSHint now supports a '--filename' option for stdin, allowing overrides to work properly.
  var fileName = jshintOpts && jshintOpts.filename.replace(process.cwd(), '') || 'stdin';

  return transformJSX(fileStream, fileName, jsxhintOpts)
  .then(function(contents){
    var tempFileName = utils.createTempFile(path.join(process.cwd(), fileName), contents);
    var out = {};
    out[tempFileName] = fileName;
    return out;
  })
  .nodeify(cb);
}

exports.tmpdir = utils.tmpdir;
exports.transformJSX = transformJSX;
exports.transformFiles = transformFiles;
exports.transformStream = transformStream;
