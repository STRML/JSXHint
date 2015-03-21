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

var react = require('react-tools');
try {
  var babel = require('babel');
} catch(e) {
  // ignore
}
var async = require('async');
var path = require('path');
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
      return react.transform(source, {harmony: opts['--harmony'], stripTypes: true});
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

  function processFile(source){
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

  drainStream(fileStream, function(err, source) {
    if (err) return cb(err);
    processFile(source);
  });
}

/**
 * Drain a readstream into a string.
 * @param  {ReadableStream}   stream Readable stream.
 * @param  {Function} cb     Callback.
 */
function drainStream(stream, cb) {
  // Drain stream
  var source = '';
  stream.on('data', function(chunk){
    source += chunk;
  });
  stream.on('end', function() {
    cb(null, source);
  });
  stream.on('error', cb);
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
 * As of JSHint 2.5.0 there is a new jshintrc option, overrides. This lets you set glob patterns with separate
 * rules. It's super useful, but it uses minimatch internally and doesn't match our temp files correctly.
 * This function modifies the input patterns so they'll work right on our temp dirs.
 * @param  {Object} jshintrc .jshintrc contents.
 * @return {Object}          Modified .jshintrc contents.
 */
function ensureJshintrcOverrides(jshintrc) {
  if (!jshintrc.overrides) return jshintrc;
  var base = path.join(exports.tmpdir, process.cwd());
  jshintrc.overrides = Object.keys(jshintrc.overrides).reduce(function(memo, key) {
    memo[path.join(base, key)] = jshintrc.overrides[key];
    return memo;
  }, {});
  return jshintrc;
}

/**
 * Find a config file, searching up from dir to the root, and copy it to the tmpdir. The
 * JSHint CLI uses these to determine settings.
 * We attempt to preserve the original folder structure inside the tmpdir
 * so that we have no unexpected configuration file priority.
 * @param  {String} dir Basename
 * @param  {String} file Filename.
 */
function copyConfig(dir, file){
  var filePath = path.resolve(dir, file);
  if (checkedSupportFiles[filePath]) return;
  // Indicate that this is copied already to prevent unnecessary file operations.
  checkedSupportFiles[filePath] = true;

  if (fs.existsSync(filePath)) {
    var destination = path.join(exports.tmpdir, getCleanAbsolutePath(filePath));
    debug("Copying support file from %s to temp directory at %s.", filePath, destination);
    if (file === '.jshintrc') {
      var jshintrc = fs.readJSONSync(filePath);
      fs.writeJSONSync(destination, ensureJshintrcOverrides(jshintrc));
    } else {
      fs.copySync(filePath, destination);
    }
  }
  // Not found, keep looking up the root.
  else {
    var parent = path.resolve(dir, '..');
    // Return null at the root, which is also when dir and its parent are the same.
    if (dir === parent) return;
    return copyConfig(parent, file);
  }

}

/**
 * Given a filename and contents, write to disk.
 * @private
 * @param  {String}   fileName File name.
 * @param  {String}   contents File contents.
 */
function createTempFile(fileName, contents){
  fileName = getCleanAbsolutePath(fileName);
  var fileTempDestination = path.join(exports.tmpdir, fileName);

  // Write the file to the temp directory.
  // outputFile is from fs-extra and will mkdirp() automatically.
  fs.outputFileSync(fileTempDestination, contents);

  // For every file, we need to go up the path to find .jshintrc and package.json files, since
  // they can modify the lint.
  var dir = path.dirname(fileName);
  copyConfig(dir, '.jshintrc');
  copyConfig(dir, 'package.json');
  return fileTempDestination;
}

/**
 * Given a list of filenames and their contents, write temporary files
 * to disk.
 * @private
 * @param  {Array}   fileNames    File names.
 * @param  {Array}   fileContents File contents.
 */
function createTempFiles(fileNames, fileContents){
  return fileNames.map(function(fileName) {
    return createTempFile(fileName, fileContents[fileNames.indexOf(fileName)]);
  });
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
  async.map(files, function(fileStream, fileName, cb){
    if (arguments.length === 2) {
      cb = arguments[1];
      fileName = arguments[0];
      return transformJSX(fileName, jsxhintOpts, cb);
    } else {
      return transformJSX(fileStream, fileName, jsxhintOpts, cb);
    }
  }, function(err, fileContents){
    if(err) return cb(err);
    debug("Successfully transformed %d files to JSX.", files.length);

    var tempFileNames = createTempFiles(files, fileContents);
    debug("Moved %d files to temp directory at %s.", files.length, exports.tmpdir);
    // Create map of temp file names to original file names
    var fileNameMap = {};
    files.forEach(function(fileName, index){
      fileNameMap[tempFileNames[index]] = fileName;
    });
    cb(null, fileNameMap);
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
 * @param  {Object}   jsxhintOpts        Options for JSXHint.
 * @param  {Object}   jshintOpts         Options for JSHint.
 * @param  {Function} cb                 Callback.
 */
function transformStream(fileStream, jsxhintOpts, jshintOpts, cb){
  // JSHint now supports a '--filename' option for stdin, allowing overrides to work properly.
  var fileName = jshintOpts && jshintOpts.filename.replace(process.cwd(), '') || 'stdin';

  transformJSX(fileStream, fileName, jsxhintOpts, function(err, contents){
    if(err) return cb(err);
    var tempFileName = createTempFile(path.join(process.cwd(), fileName), contents);
    var out = {};
    out[tempFileName] = fileName;
    cb(null, out);
  });
}

exports.tmpdir = path.join(require('os').tmpdir(), 'jsxhint', String(process.pid));
exports.transformJSX = transformJSX;
exports.transformFiles = transformFiles;
exports.transformStream = transformStream;
