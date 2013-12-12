'use strict';

var fs = require('fs');
var test = require('tap').test;
var jsxhint = require('../jsxhint');

test('Load and enumerate regexps from .gitignore', function(t){
  t.plan(4);
  var ignoreString = 'test;'
  var ignoreData = fs.readFileSync('../.gitignore', 'utf-8').trim().split('\n');

  jsxhint.makeIgnores([ignoreString], null, null, function(err, ignores){
    t.equal(ignores.length, 1, 'More than one ignore');
    var regex = new RegExp('^'+ignoreString+'$','g');
    t.equal(ignores[0].toString(), regex.toString(), 'RegExp processed incorrectly');
  });

  jsxhint.makeIgnores(null, '.gitignore', '../', function(err, ignores){
    t.equal(ignores.length, ignoreData.length, 'Should be '+ignoreData.length);
  });

  jsxhint.makeIgnores([ignoreString], '.gitignore', '../', function(err, ignores){
    t.equal(ignores.length, ignoreData.length+1, 'Should have combined');
  });
});

test('Load .jshintrc, if it exists', function(t){
  t.plan(4);
  var jshintRC = JSON.parse(fs.readFileSync('../.jshintrc', 'utf-8'));
  jsxhint.getJSHintRc(null, null, function(err, jshintdata){
    t.ifError(err);
    t.deepEqual(jshintdata, {}, 'Should be an empty object');
  });

  jsxhint.getJSHintRc('.jshintrc', '../', function(err, jshintdata){
    t.ifError(err);
    t.deepEqual(jshintdata, jshintRC, 'Should match');
  });
});

test('Convert JSX to JS', function(t){
  t.plan(4);
  jsxhint.transformJSX('./test_article.js', function(err, data){
    t.ifError(err);
    var containsFormElement = data.match(/<form/);
    t.equal(data.match(/<form/), null, 'JS was not properly converted');
  });

  jsxhint.transformJSX('./test_article.jsx', function(err, data){
    t.ifError(err);
    t.equal(data.match(/<form/), null, 'JS was not properly converted');
  });
});

test('Generate tests', function(t){
  var tasks = jsxhint.generateTasks(['./test.js'], [], '', '', process.cwd());
  console.log(tasks);
  t.equal(tasks.length, 2, 'Should be a single task');
  t.equal(typeof tasks[0], 'function', 'First task should a function');
  t.end();
});