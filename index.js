#!/usr/bin/env node
'use strict';

var fs = require('fs');
var glob = require('glob');
var log = require('npmlog');
var path = require('path');
var jshint = require('jshint').JSHINT;
var log = require('npmlog');
var react = require('react-tools');
var docblock = require('react-tools/vendor/fbtransform/lib/docblock');
var runnel = require('runnel');
var prjRoot = path.dirname(require.main.filename);

function makeIgnores(cb){
    fs.readFile(path.join(prjRoot, '.gitignore'), 'utf8', function(err, gitignore){
      if(err){
        cb(err);
      } else {
        var ignores = gitignore.trim().split(/\n/).map(function(gi){
          return new RegExp(gi.replace('*',''), 'g');
        });
        cb(null, ignores);
      }
  });
}

function getJSHintRc(cb){
  var rc_loc = path.join(prjRoot, '.jshintrc');
  fs.exists(rc_loc, function(exist){
    if(exist){
      fs.readFile(rc_loc, 'utf8', function(err, data){
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
}

function transformJSX(file, cb){
  fs.readFile(file, 'utf8', function(err, source){
    if(err){
      cb(err);
    } else {
      if(docblock.parseAsObject(docblock.extract(source))){
        source = react.transform(source);
      }

      cb(null, source);
    }
  });
}


// calling cb() directly immediately aborts execution.
// calling done() aborts execution for a particular glob set
// we need to
// 1. get ignores, if failure, die
// 2. get jshinrc, if failure, die
// 3. run process globs
//  a. for each glob
//    1. filter
//    2. transform
//    3. lint
var lintJSX = exports.lintJSX = function (glb, cb){
  var _processed = 0;
  var errs = false;

  function ignoreHandler(err, ignores){
    if(err){
      cb(err);
    } else {
      getJSHintRc(function(err, jshintrc){
        var globals = {};
        if(jshintrc.globals){
          globals = jshintrc.globals;
          delete jshintrc.globals;
        }
        hintRCHandler(err, jshintrc, globals, ignores);
      });
    }
  }

  function hintRCHandler(err, jshintrc, globals, ignores){
    if(err){
      cb(err);
    } else {
      processGlobs(ignores, jshintrc, globals);
    }
  }

  function processGlobs(ignores, jshintrc, globals){
    var wc = path.join(prjRoot, glb);
    glob(wc, function(err, files){
      var jsxFiles = files.filter(filterIgnores);
      jsxFiles.forEach(processJSXFile);
    });

    function filterIgnores(file){
      var keep = true;
      ignores.forEach(function(matcher){
        if(file.match(matcher)){
          keep = false;
        }
      });

      return keep;
    }

    function processJSXFile(file){
      function processed(err, source){
        if(err){
          done(err);
        } else {
          runLint(source, jshintrc, globals);
        }
      }
      transformJSX(file, processed);
    }
  }

  function done(err){
    if(err){
      cb(err);
    } else {
      cb();
    }
  }

  function runLint(file, jshintrc, globals){
    if(jshint(file, jshintrc, globals)){
      done();
    } else {
      jshint.errors.forEach(function(e){
        if(e){
          log.error(e.evidence, '[%s] %s:%s,%s', e.code, e.reason, e.line, e.character);
        }
      });
      done(true);
    }
  }

  makeIgnores(ignoreHandler);
}

var generateTasks = exports.generateTasks = function(globList){
  function done(err){
    if(err){
      process.exit(1);
    }
  }

  var tasks = globList.map(function(g){
    return lintJSX.bind(null, g);
  });
  tasks.push(done);
  return tasks;
}

// if we're running this from the command line we want to override
// `prjRoot` to the current path and automatically take the rest of the argument
// and generate runnel tasks to run each glob in sequence
if(!module.parent){
  prjRoot = process.cwd();
  var globs = process.argv.slice(2);
  if(globs.length < 2){
    log.info('JSXHint', 'You must provide an input file');
    process.exit();
  }
  var tasks = generateTasks(globs);
  runnel(tasks);
}