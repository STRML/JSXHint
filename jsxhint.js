/**
 * JSXHint CLI tool
 *
 * Copyright 2013 (c) Condé Nast
 *
 * Please see LICENSE for details
 *
 */

'use strict';

var fs = require('fs');
var glob = require('glob');
var path = require('path');

var colors = require('colors');
var jshint = require('jshint').JSHINT;
var react = require('react-tools');
var docblock = require('react-tools/vendor/fbtransform/lib/docblock');
var runnel = require('runnel');

var currFile = require.main ? require.main.filename : undefined;
var prjRoot = path.dirname(currFile || process.cwd());


/**
 * Generate an array of regular expressions used to filter the file
 * list against.
 * @private
 * @async
 * @param  {Array}    ignoreList Array of strings
 * @param  {String}   ignoreFile Filename to read ignore list from
 * @param  {Function} cb         Callback to return ignore data
 * @return {Object}              Undefined
 */
function makeIgnores(ignoreList, ignoreFile, prjRoot, cb){
  var _ignores = [];
  var resolvedFn;

  /**
   * Transform an array of strings into an array of regular
   * expressions. Clean pattern converts the ? and * from globs into
   * regular expression compatible syntax and then makes sure that
   * it's not as greedy as normal by specifiying start and end syntax.
   *
   * This does mean thought that if you're trying to ignore something like
   * node_modules you'll need to have `*node_modules*` in your glob and NOT
   * `node_modules`
   *
   * @private
   * @param  {Array} ignores Array of strings or regular expressions
   * @return {Array}         Array of regular expressions
   */
  var _makeRegex = function(ignores){
    return ignores.map(function(gi){
      if(gi instanceof RegExp){
        return gi;
      } else {
        var cleanPattern = gi.replace(/\?/, '.').replace(/\*/, '.*?');
        cleanPattern = '^'+cleanPattern+'$';
        return new RegExp(cleanPattern, 'g');
      }
    });
  };

  if(Array.isArray(ignoreList)){
    _ignores = _ignores.concat(_makeRegex(ignoreList));
  }

  if(typeof ignoreFile === 'string'){
    resolvedFn = path.resolve(prjRoot, ignoreFile);

    fs.exists(resolvedFn, function(exists){
      if(exists){
        fs.readFile(resolvedFn, 'utf8', function(err, ignoreData){
          if(err){
            cb(err);
          } else {
            _ignores = _ignores.concat(_makeRegex(ignoreData.trim().split(/\n/)));
            cb(null, _ignores);
          }
        });
      } else {
        cb(null, _ignores);
      }
    });
  } else {
    cb(null, _ignores);
  }
}

/**
 * Read in a jshintrc file and return the data
 * @private
 * @async
 * @param  {String}   jshintfile Filename for the jshintrc file
 * @param  {Function} cb         The callback to call when the data is ready
 * @return {Object}              Undefined
 */
function getJSHintRc(jshintfile, prjRoot, cb){
  if(typeof prjRoot === 'string' && typeof jshintfile === 'string'){
    var resolvedFn = path.resolve(prjRoot, jshintfile);
    fs.exists(resolvedFn, function(exist){
      if(exist){
        fs.readFile(resolvedFn, 'utf8', function(err, data){
          if(err){
            cb(err);
          } else {
            var rc = JSON.parse(data);
            cb(null, rc);
          }
        });
      } else {
        cb(null, {});
      }
    });
  } else {
    cb(null, {});
  }
}

/**
 * Transform a JSX file into a JS file for linting
 * @private
 * @async
 * @param  {String}   file The file to read in
 * @param  {Function} cb   The callback to call when it's ready
 * @return {Object}        Undefined
 */
function transformJSX(file, cb){
  fs.readFile(file, 'utf8', function(err, source){
    if(err){
      cb(err);
    } else {
      try {
        var hasDocblock = docblock.parseAsObject(docblock.extract(source)).jsx;
        var hasExtension = /\.jsx$/.exec(file);

        if (hasExtension && !hasDocblock) {
          source = '/** @jsx React.DOM */' + source;
        }

        if (hasExtension || hasDocblock) {
          source = react.transform(source);
        }

        cb(null, source);
      } catch(e) {
        cb(new Error(file+' contained an illegal character'.red));
      }
    }
  });
}

/**
 * Generate the ignores, the hint options, transform the files
 * and then hint them
 *
 * calling cb() directly immediately aborts execution.
 * calling done() aborts execution for a particular glob set
 * we need to
 * 1. get ignores, if failure, die
 * 2. get jshinrc, if failure, die
 * 3. run process globs
 *  a. for each glob
 *    1. filter
 *    2. transform
 *    3. lint
 *
 * @async
 * @param  {Array}    glb        File patterns to lint
 * @param  {Array}    ignoreList File patterns to ignore
 * @param  {String}   ignoreFile File ot generate ignore patterns from
 * @param  {String}   hintFile   File to generate hint options from
 * @param  {Function} cb         `Runnel` provided callback
 * @return {Object}              Undefined
 */
var lintJSX = function (glb, ignoreList, ignoreFile, hintFile, prjRoot, cb){
  var errs = false;

  /**
   * Callback for `makeIgnores`
   * @private
   * @async
   * @param  {Object} err     Errors, if any
   * @param  {Array}  ignores Array of regular expressions to filter
   * @return {Object}         Undefined
   */
  function ignoreHandler(err, ignores){
    if(err){
      cb(err);
    } else {
      getJSHintRc(hintFile, prjRoot, function(err, jshintrc){
        var globals = {};
        if(jshintrc.globals){
          globals = jshintrc.globals;
          delete jshintrc.globals;
        }
        hintRCHandler(err, jshintrc, globals, ignores);
      });
    }
  }

  /**
   * `getJSHintRC` callback
   * @private
   * @async
   * @param  {Object} err      Errors, if any
   * @param  {Object} jshintrc JSHint options
   * @param  {Object} globals  JSHint globals
   * @param  {Array}  ignores  Array of regular expression to filter
   * @return {Object}          Undefined
   */
  function hintRCHandler(err, jshintrc, globals, ignores){
    if(err){
      cb(err);
    } else {
      processGlobs(ignores, jshintrc, globals);
    }
  }

  /**
   * Finally, this actually transforms each file (if necessary)
   * and then hints it
   * @async
   * @private
   * @param  {Array} ignores  Ignore patterns
   * @param  {Object} jshintrc JSHint options
   * @param  {Object} globals  JSHint globals
   * @return {Object}          Undefined
   */
  function processGlobs(ignores, jshintrc, globals){
    var wc = path.join(prjRoot, glb);
    glob(wc, function(err, files){
      var jsxFiles = files.filter(filterIgnores);
      jsxFiles.forEach(processJSXFile);
    });

    /**
     * Function for map to remove ignored files
     * @private
     * @param  {String}  file Filename we want to check
     * @return {Boolean}      True if we want to lint the file
     */
    function filterIgnores(file){
      var keep = true;
      ignores.forEach(function(matcher){
        if(file.match(matcher)){
          keep = false;
        }
      });

      return keep;
    }

    /**
     * Attempts to transform the file, and then passes
     * javascript into linter
     * @async
     * @private
     * @param  {String} file Filename to check
     * @return {Object}      Undefined
     */
    function processJSXFile(file){
      function processed(err, source){
        if(err){
          done(err);
        } else {
          runLint(source, file, jshintrc, globals);
        }
      }
      transformJSX(file, processed);
    }
  }

  /**
   * Call the `runnel` provided callback when the operation
   * is either done or an error has occured
   * @private
   * @async
   * @param  {Object}   err Error, if any
   * @return {Object}       Undefined
   */
  function done(err){
    if(err){
      cb(err);
    } else {
      cb();
    }
  }

  /**
   * This is what actually passes the data into jshint and captures
   * the errors if any exist
   * @private
   * @async
   * @param  {String} file     The contents of the file we want to hint
   * @param  {Object} jshintrc JSHint options
   * @param  {Object} globals  JSHint globals
   * @return {Object}          Undefined
   */
  function runLint(source, file, jshintrc, globals){
    if(jshint(source, jshintrc, globals)){
      done();
    } else {
      jshint.errors.forEach(function(e){
        if(e){
          console.log('['+e.code.bold.red+']',
                      e.reason.cyan,
                      file+':'+e.line+','+e.character);
        }
      });
      done(true);
    }
  }

  makeIgnores(ignoreList, ignoreFile, prjRoot, ignoreHandler);
};

/**
 * Generate an array of tasks for passing into `runnel`
 * @param  {Array} globList    List of file patterns to lint
 * @param  {Array} ingoreList  List of file patterns to ignore
 * @param  {String} ignoreFile File name to generate ignore patterns from
 * @param  {String} hintFile   File name to retrieve jshint options from
 * @param  {String} [prjRoot]  Specify the project root for finding files
 * @return {Array}             Array of bound functions to pass to `runnel`
 */
var generateTasks = function(globList, ignoreList, ignoreFile, hintFile, prjRoot){

  function done(err){
    if(err){
      console.log(err.message.red);
    } else {
      console.log('All files passed linter'.magenta.bold);
    }
  }

  var tasks = globList.map(function(g){
    return lintJSX.bind(null, g, ignoreList, ignoreFile, hintFile, prjRoot);
  });
  tasks.push(done);
  return tasks;
};

exports.getJSHintRc = getJSHintRc;
exports.transformJSX = transformJSX;
exports.makeIgnores = makeIgnores;
exports.generateTasks = generateTasks;
exports.lintJSX = lintJSX;
