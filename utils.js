'use strict';

var Promise = require('bluebird');
var fs = require('fs-extra');
var path = require('path');
var jshintcli = require('jshint/src/cli');
var debug = require('debug')('jsxhint');
var os = require('os');

// Check map for copied support files (package.json, .jshintrc) for a speedup.
var checkedSupportFiles = {};


var utils = module.exports = {
  /**
   * Places all temp files here.
   * @type {String}
   */
  tmpdir: path.join((os.tmpdir ? os.tmpdir() : os.tmpDir()), 'jsxhint', String(process.pid)),

  /**
   * Drain a readstream into a string.
   * @param  {ReadableStream}   stream Readable stream.
   * @promise {String} File contents.
   */
  drainStream: function drainStream(stream) {
    return new Promise(function(resolve, reject) {
      // Drain stream
      var source = '';
      stream.on('data', function(chunk){
        source += chunk;
      });
      stream.on('end', function() {
        resolve(source);
      });
      stream.on('error', reject);
    });
  },

  /**
   * Transforms a parse error into an object with 'file', 'error' properties so it can be fed back into jshint.
   * @param  {Error} error Parsing error.
   * @return {Object}      Object with filename and error that JSHint can read.
   */
  transformError: function transformError(fileName, error, opts){
    var err = {
      file: fileName,
      error: {
        line: error.lineNumber,
        character: error.column,
        reason: error.description,
        code: 'E041'
      }
    };
    if (opts['--babel'] || opts['--babel-experimental']) {
      err.error.line = error.loc.line;
      err.error.character = error.loc.column;
      err.error.reason = error.stack.match(/.*:\s(.*)\s\(\d+:\d+\)/)[1];
    }
    return err;
  },

  /**
   * Given a fileName, get a multi-platform compatible file path that can be appended to an existing filepath.
   * This is not necessary on *nix but is important on Windows because absolutePath + absolutePath
   * leads to the concatenation of a drive letter (`c:/`) which is a broken path.
   * @param  {String} fileName file name.
   * @return {String}          Cleaned file name.
   */
  getCleanAbsolutePath: function getCleanAbsolutePath(fileName) {
    return '/' + path.relative('/', path.resolve(fileName));
  },

  /**
   * As of JSHint 2.5.0 there is a new jshintrc option, overrides. This lets you set glob patterns with separate
   * rules. It's super useful, but it uses minimatch internally and doesn't match our temp files correctly.
   * This function modifies the input patterns so they'll work right on our temp dirs.
   * @param  {Object} jshintrc .jshintrc contents.
   * @return {Object}          Modified .jshintrc contents.
   */
  ensureJshintrcOverrides: function ensureJshintrcOverrides(jshintrc) {
    if (!jshintrc.overrides) return jshintrc;
    var base = path.join(utils.tmpdir, process.cwd());
    jshintrc.overrides = Object.keys(jshintrc.overrides).reduce(function(memo, key) {
      memo[path.join(base, key)] = jshintrc.overrides[key];
      return memo;
    }, {});
    return jshintrc;
  },

  /**
   * Find a config file, searching up from dir to the root, and copy it to the tmpdir. The
   * JSHint CLI uses these to determine settings.
   * We attempt to preserve the original folder structure inside the tmpdir
   * so that we have no unexpected configuration file priority.
   * @param  {String} dir Basename
   * @param  {String} file Filename.
   */
  copyConfig: function copyConfig(dir, file){
    var filePath = path.resolve(dir, file);
    if (checkedSupportFiles[filePath]) return;
    // Indicate that this is copied already to prevent unnecessary file operations.
    checkedSupportFiles[filePath] = true;

    if (fs.existsSync(filePath)) {
      var destination = path.join(utils.tmpdir, utils.getCleanAbsolutePath(filePath));
      debug("Copying support file from %s to temp directory at %s.", filePath, destination);
      if (file === '.jshintrc') {
        try {
          var jshintrc = jshintcli.loadConfig(filePath);
          fs.writeJSONSync(destination, utils.ensureJshintrcOverrides(jshintrc));
        } catch(e) {
          console.error('Unable to parse .jshintrc file at %s. It must be valid JSON. Error: %s', filePath, e.message);
          return;
        }
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
  },

  /**
   * Given a filename and contents, write to disk.
   * @private
   * @param  {String}   fileName File name.
   * @param  {String}   contents File contents.
   */
  createTempFile: function createTempFile(fileName, contents){
    fileName = utils.getCleanAbsolutePath(fileName);
    var fileTempDestination = path.join(utils.tmpdir, fileName);

    // Write the file to the temp directory.
    // outputFile is from fs-extra and will mkdirp() automatically.
    fs.outputFileSync(fileTempDestination, contents);

    // For every file, we need to go up the path to find .jshintrc and package.json files, since
    // they can modify the lint.
    var dir = path.dirname(fileName);
    utils.copyConfig(dir, '.jshintrc');
    utils.copyConfig(dir, 'package.json');
    return fileTempDestination;
  },

  /**
   * Given a list of filenames and their contents, write temporary files
   * to disk.
   * @private
   * @param  {Array}   fileNames    File names.
   * @param  {Array}   fileContents File contents.
   */
  createTempFiles: function createTempFiles(fileNames, fileContents){
    return fileNames.map(function(fileName) {
      return utils.createTempFile(fileName, fileContents[fileNames.indexOf(fileName)]);
    });
  }
};
