'use strict';

var fs = require('fs');
var test = require('tap').test;
var jsxhint = require('../jsxhint');
var child_process = require('child_process');


test('Convert JSX to JS', function(t){
  t.plan(4);
  jsxhint.transformJSX('./fixtures/test_article.js', function(err, data){
    t.ifError(err);
    t.equal(data.match(/<form/), null, 'JS was not properly converted');
  });

  jsxhint.transformJSX('./fixtures/test_article.jsx', function(err, data){
    t.ifError(err);
    t.equal(data.match(/<form/), null, 'JS was not properly converted');
  });
});

test('Test stream input into transformJSX', function(t){
  t.plan(4);
  var readStream = fs.createReadStream('./fixtures/test_article.js');
  // Test with provided filename
  jsxhint.transformJSX(readStream, 'fixtures/test_article.js', function(err, data){
    t.ifError(err);
    t.equal(data.match(/<form/), null, 'JS was not properly converted');
  });
  // Test without provided filename (assumes 'stdin')
  jsxhint.transformJSX(readStream, function(err, data){
    t.ifError(err);
    t.equal(data.match(/<form/), null, 'JS was not properly converted');
  });
});

test('Error output should match jshint', function(t){
  t.plan(3);
  var jshint_proc = child_process.fork('../node_modules/jshint/bin/jshint', ['fixtures/jshint_parity.js'], {silent: true});
  var jsxhint_proc = child_process.fork('../cli', ['fixtures/jshint_parity.js'], {silent: true});

  drain_stream(jshint_proc.stdout, function(err, jshintOut){
    t.ifError(err);
    drain_stream(jsxhint_proc.stdout, function(err, jsxhintOut){
      t.ifError(err);
      console.error(jshintOut + 'fuhh');
      console.error(jsxhintOut);
      t.equal(jshintOut, jsxhintOut, "JSHint output formatting should match JSXHint output.");
    });
  });

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
});
