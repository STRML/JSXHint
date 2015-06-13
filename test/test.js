'use strict';

var fs = require('fs');
var test = require('tap').test;
var jsxhint = require('../jsxhint');
var child_process = require('child_process');

// Util
function drainStream(stream, cb){
  var buf = '';
  stream.on('data', function(chunk){
    buf += chunk;
  });
  stream.on('error', function(e){
    cb(e);
  });
  stream.on('end', function(){
    cb(null, buf);
  });
}

function forkAndDrain(cmd, args, cb) {
  if (typeof args === 'string') args = [args];
  var proc = child_process.fork(cmd, args, {silent: true});
  drainStream(proc.stdout, cb);
}

function runJSXHint(args, cb) {
  forkAndDrain('../cli', args, cb);
}

function runJSHint(args, cb) {
  forkAndDrain('../node_modules/jshint/bin/jshint', args, cb);
}

test('Convert JSX to JS', function(t){
  t.plan(34);
  jsxhint.transformJSX('./fixtures/test_article_without_pragma.js', { '--jsx-only' : true }, function(err, data){
    t.ifError(err);
    t.equal(data.match(/React.DOM/), null, 'JS was converted but should not be.');
  });

  jsxhint.transformJSX('./fixtures/test_article_without_pragma.js', {}, function(err, data){
    t.ifError(err);
    t.equal(data.match(/<form/), null, 'JS was not properly converted.');
  });

  jsxhint.transformJSX('./fixtures/test_article.js', {}, function(err, data){
    t.ifError(err);
    t.equal(data.match(/<form/), null, 'JS was not properly converted.');
  });

  jsxhint.transformJSX('./fixtures/test_article.jsx', {}, function(err, data){
    t.ifError(err);
    t.equal(data.match(/<form/), null, 'JS was not properly converted.');
  });

  jsxhint.transformJSX('./fixtures/test_article_without_pragma.js', { '--babel': true, '--jsx-only' : true }, function(err, data){
    t.ifError(err);
    t.equal(data.match(/React.DOM/), null, 'JS was converted but should not be. (Using --babel)');
  });

  jsxhint.transformJSX('./fixtures/test_article_without_pragma.js', { '--babel':true }, function(err, data){
    t.ifError(err);
    t.equal(data.match(/<form/), null, 'JS was not properly converted. (Using --babel)');
  });

  jsxhint.transformJSX('./fixtures/test_article.js', { '--babel':true }, function(err, data){
    t.ifError(err);
    t.equal(data.match(/<form/), null, 'JS was not properly converted. (Using --babel)');
  });

  jsxhint.transformJSX('./fixtures/test_article.jsx', { '--babel':true }, function(err, data){
    t.ifError(err);
    t.equal(data.match(/<form/), null, 'JS was not properly converted. (Using --babel)');
  });

  jsxhint.transformJSX('./fixtures/test_harmony.js', { '--harmony':true }, function(err, data){
    t.ifError(err);
    t.equal(data.match(/class/), null, 'JS was not properly converted. (Using --harmony)');
  });

  runJSXHint('fixtures/test_es6module.jsx', function(err, jsxhintOut) {
    t.ifError(err);
    t.ok(jsxhintOut.length > 0, 'JSXHint should fail using esprima parser.');
  });

  runJSXHint(['--babel', 'fixtures/test_es6module.jsx'], function(err, jsxhintOut) {
    t.ifError(err);
    t.equal(jsxhintOut, '',
      'JSXHint should succeed using babel parser.');
  });

  runJSXHint(['--babel-experimental', 'fixtures/test_es6module.jsx'], function(err, jsxhintOut) {
    t.ifError(err);
    t.equal(jsxhintOut, '',
      'JSXHint should succeed using babel parser with experimental support.');
  });

  runJSXHint('fixtures/test_es7classproperties.jsx', function(err, jsxhintOut) {
    t.ifError(err);
    t.ok(jsxhintOut.length > 0, 'JSXHint should fail using esprima parser.');
  });

  runJSXHint(['--babel', 'fixtures/test_es7classproperties.jsx'], function(err, jsxhintOut) {
    t.ifError(err);
    t.ok(jsxhintOut.length > 0, 'JSXHint should fail using babel parser without experimental.');
  });

  runJSXHint(['--babel-experimental', 'fixtures/test_es7classproperties.jsx'], function(err, jsxhintOut) {
    t.ifError(err);
    t.equal(jsxhintOut, '',
      'JSXHint should succeed using babel parser with experimental support for ES7.');
  });

  runJSXHint('fixtures/test_es7exponentiation.jsx', function(err, jsxhintOut) {
    t.ifError(err);
    t.ok(jsxhintOut.length > 0, 'JSXHint should fail using esprima parser.');
  });

  runJSXHint(['--babel', 'fixtures/test_es7exponentiation.jsx'], function(err, jsxhintOut) {
    t.ifError(err);
    t.equal(jsxhintOut, '',
      'JSXHint should succeed using babel parser without experimental support for ES7.');
  });
});

test('Test stream input into transformJSX', function(t){
  t.plan(8);
  var readStream = fs.createReadStream('./fixtures/test_article.js');
  // Test with provided filename
  jsxhint.transformJSX(readStream, 'fixtures/test_article.js', {}, function(err, data){
    t.ifError(err);
    t.equal(data.match(/<form/), null, 'JS was not properly converted.');
  });
  // Test without provided filename (assumes 'stdin')
  jsxhint.transformJSX(readStream, {}, function(err, data){
    t.ifError(err);
    t.equal(data.match(/<form/), null, 'JS was not properly converted.');
  });
  // Test with provided filename
  jsxhint.transformJSX(readStream, 'fixtures/test_article.js', { '--babel': true }, function(err, data){
    t.ifError(err);
    t.equal(data.match(/<form/), null, 'JS was not properly converted. (Using --babel)');
  });
  // Test without provided filename (assumes 'stdin')
  jsxhint.transformJSX(readStream, { '--babel': true }, function(err, data){
    t.ifError(err);
    t.equal(data.match(/<form/), null, 'JS was not properly converted. (Using --babel)');
  });
});

// test('Test input from stdin', function(t) {
  // t.plan(2);
  //
// });

test('Error output should match jshint', function(t){
  t.plan(6);
  var file = 'fixtures/jshint_parity.js';

  runJSHint(file, function(err, jshintOut){
    t.ifError(err);
    runJSXHint(file, function(err, jsxhintOut){
      t.ifError(err);
      t.equal(jshintOut, jsxhintOut, "JSHint output formatting should match JSXHint output.");
    });
  });

  runJSHint(file, function(err, jshintOut){
    t.ifError(err);
    runJSXHint(['--babel', file], function(err, jsxhintOut){
      t.ifError(err);
      t.equal(jshintOut, jsxhintOut, "JSHint output formatting should match JSXHint output. (Using --babel)");
    });
  });
});

// https://github.com/STRML/JSXHint/pull/1
// Thanks @caseywebdev
test('JSX transpiler error should look like JSHint output, instead of crashing', function(t){
  t.plan(4);
  runJSXHint('fixtures/test_malformed.jsx', function(err, jsxhintOut){
    t.ifError(err);
    t.equal(jsxhintOut, 'fixtures/test_malformed.jsx: line 7, col 16, Unexpected token ;\n\n1 error\n',
      'JSXHint output should display the transplier error through the JSHint reporter.');
  });

  runJSXHint(['--babel', 'fixtures/test_malformed.jsx'], function(err, jsxhintOut){
    t.ifError(err);
    t.equal(jsxhintOut, 'fixtures/test_malformed.jsx: line 7, col 15, Unexpected token\n\n1 error\n',
      'JSXHint output should display the transplier error through the JSHint reporter. (Using --babel)');
  });
});

// https://github.com/STRML/JSXHint/pull/62
// Thanks @yungsters
test('JSX transpiler error should look like JSHint output, without .jsx extension and --transform-errors', function(t){
  t.plan(4);
  runJSXHint(['--transform-errors', 'always', 'fixtures/test_malformed.js'], function(err, jsxhintOut){
    t.ifError(err);
    t.equal(jsxhintOut, 'fixtures/test_malformed.js: line 9, col 16, Unexpected token ;\n\n1 error\n',
      'JSXHint output should display the transplier error through the JSHint reporter, even without .jsx extension, ' +
      'when using --transform-errors always.');
  });

  runJSXHint(['--babel', '--transform-errors', 'always', 'fixtures/test_malformed.js'], function(err, jsxhintOut){
    t.ifError(err);
    t.equal(jsxhintOut, 'fixtures/test_malformed.js: line 9, col 15, Unexpected token\n\n1 error\n',
      'JSXHint output should display the transplier error through the JSHint reporter, even without .jsx extension, ' +
      'when using --transform-errors always. (Using --babel)');
  });
});

test('Strip flow types', function(t){
  t.plan(2);
  jsxhint.transformJSX('./fixtures/test_flow.js', {}, function(err, data){
    t.ifError(err);
    t.equal(data.match(/text: string/), null, 'Flow types were not properly stripped.');
  });
});

test('Strip flow types with modules', function(t){
  t.plan(2);
  jsxhint.transformJSX('./fixtures/test_flow_import.js', { '--es6module': true }, function(err, data){
    t.ifError(err);
    t.equal(data.match(/import/), null, 'Flow types were not properly stripped.\n' + data);
  });
});

test('Strip flow types with non-strict modules', function(t){
  t.plan(2);
  jsxhint.transformJSX('./fixtures/test_flow_import.js', {'--non-strict-es6module': true}, function(err, data){
    t.ifError(err);
    t.equal(data.match(/import/), null, 'Flow types were not properly stripped.\n' + data);
  });
});

test('overrides', function(t) {
  t.plan(2);
  // Normally this would complain about missing 'use strict'
  runJSXHint(['fixtures/test_overrides.js'], function(err, jsxhintOut){
    t.ifError(err);
    t.equal(jsxhintOut, '',
      'use_strict override should squelch the strict error in test_overrides.js.');
  });
});

test('--babel-disable-strict option', function(t) {
  t.plan(2);

  runJSXHint(['--babel', 'fixtures/test_disable_strict.jsx'], function(err, jsxhintOut) {
    t.equal(jsxhintOut, '');
  });

  runJSXHint(['--babel', '--babel-disable-strict', 'fixtures/test_disable_strict.jsx'], function(err, jsxhintOut) {
    t.inequal(jsxhintOut, '');
  });
});
