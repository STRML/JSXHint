'use strict';

var fs = require('fs');
var test = require('tap').test;
var jsxhint = require('../jsxhint');
var child_process = require('child_process');

// Util
function drain_stream(stream, cb){
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

test('Convert JSX to JS', function(t){
  t.plan(28);
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

  var jsxhint_proc = child_process.fork('../cli', ['fixtures/test_es6module.jsx'], {silent: true});
  drain_stream(jsxhint_proc.stdout, function(err, jsxhintOut){
    t.ifError(err);
    t.ok(jsxhintOut.length > 0, 'JSXHint should fail using esprima parser.');
  });

  jsxhint_proc = child_process.fork('../cli', ['--babel', 'fixtures/test_es6module.jsx'], {silent: true});
  drain_stream(jsxhint_proc.stdout, function(err, jsxhintOut){
    t.ifError(err);
    t.equal(jsxhintOut, '',
      'JSXHint should succeed using acorn parser.');
  });

  jsxhint_proc = child_process.fork('../cli', ['fixtures/test_es7exponentiation.jsx'], {silent: true});
  drain_stream(jsxhint_proc.stdout, function(err, jsxhintOut){
    t.ifError(err);
    t.ok(jsxhintOut.length > 0, 'JSXHint should fail using esprima parser.');
  });

  jsxhint_proc = child_process.fork('../cli', ['--babel', 'fixtures/test_es7exponentiation.jsx'], {silent: true});
  drain_stream(jsxhint_proc.stdout, function(err, jsxhintOut){
    t.ifError(err);
    t.ok(jsxhintOut.length > 0,
    'JSXHint should fail using acorn parser.');
  });

  jsxhint_proc = child_process.fork('../cli', ['--babel-experimental', 'fixtures/test_es7exponentiation.jsx'], {silent: true});
  drain_stream(jsxhint_proc.stdout, function(err, jsxhintOut){
    t.ifError(err);
    t.equal(jsxhintOut, '',
      'JSXHint should succeed using acorn parser with experimental support for ES7.');
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

test('Error output should match jshint', function(t){
  t.plan(6);
  var jshint_proc = child_process.fork('../node_modules/jshint/bin/jshint', ['fixtures/jshint_parity.js'], {silent: true});
  var jsxhint_proc = child_process.fork('../cli', ['fixtures/jshint_parity.js'], {silent: true});

  drain_stream(jshint_proc.stdout, function(err, jshintOut){
    t.ifError(err);
    drain_stream(jsxhint_proc.stdout, function(err, jsxhintOut){
      t.ifError(err);
      t.equal(jshintOut, jsxhintOut, "JSHint output formatting should match JSXHint output.");
    });
  });

  jsxhint_proc = child_process.fork('../cli', ['--babel', 'fixtures/jshint_parity.js'], {silent: true});
  drain_stream(jshint_proc.stdout, function(err, jshintOut){
    t.ifError(err);
    drain_stream(jsxhint_proc.stdout, function(err, jsxhintOut){
      t.ifError(err);
      t.equal(jshintOut, jsxhintOut, "JSHint output formatting should match JSXHint output. (Using --babel)");
    });
  });
});

// https://github.com/STRML/JSXHint/pull/1
// Thanks @caseywebdev
test('JSX transpiler error should look like JSHint output, instead of crashing', function(t){
  t.plan(4);
  var jsxhint_proc = child_process.fork('../cli', ['fixtures/test_malformed.jsx'], {silent: true});

  drain_stream(jsxhint_proc.stdout, function(err, jsxhintOut){
    t.ifError(err);
    t.equal(jsxhintOut, 'fixtures/test_malformed.jsx: line 7, col 16, Unexpected token ;\n\n1 error\n',
      'JSXHint output should display the transplier error through the JSHint reporter.');
  });

  jsxhint_proc = child_process.fork('../cli', ['--babel', 'fixtures/test_malformed.jsx'], {silent: true});
  drain_stream(jsxhint_proc.stdout, function(err, jsxhintOut){
    t.ifError(err);
    t.equal(jsxhintOut, 'fixtures/test_malformed.jsx: line 7, col 15, Unexpected token\n\n1 error\n',
      'JSXHint output should display the transplier error through the JSHint reporter. (Using --babel)');
  });
});

test('JSX transpiler error should look like JSHint output', function(t){
  t.plan(4);
  var jsxhint_proc = child_process.fork('../cli', ['fixtures/test_malformed.jsx'], {silent: true});

  drain_stream(jsxhint_proc.stdout, function(err, jsxhintOut){
    t.ifError(err);
    t.equal(jsxhintOut, 'fixtures/test_malformed.jsx: line 7, col 16, Unexpected token ;\n\n1 error\n',
      'JSXHint output should display the transplier error through the JSHint reporter.');
  });

  jsxhint_proc = child_process.fork('../cli', ['--babel', 'fixtures/test_malformed.jsx'], {silent: true});
  drain_stream(jsxhint_proc.stdout, function(err, jsxhintOut){
    t.ifError(err);
    t.equal(jsxhintOut, 'fixtures/test_malformed.jsx: line 7, col 15, Unexpected token\n\n1 error\n',
      'JSXHint output should display the transplier error through the JSHint reporter. (Using --babel)');
  });
});
