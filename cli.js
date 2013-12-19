#!/usr/bin/env node
/**
 * JSXHint CLI tool
 *
 * Copyright 2013 (c) Condé Nast
 *
 * Please see LICENSE for details
 *
 */

'use strict';

var jsxhint = require('./jsxhint');
var pkgInfo = require('./package');
var runnel = require('runnel');
var ArgParse = require('argparse').ArgumentParser;

var globs = [];
var args = {};

var parser = new ArgParse({
  version: pkgInfo.version,
  addHelp: true,
  description: pkgInfo.description,
  debug: true
});

parser.addArgument(
  ['-f', '--ignore-file'],
  {
    help: 'Use ignore file. Default: .gitignore',
    defaultValue: '.gitignore',
    dest: 'ignoreFile'
  }
);

parser.addArgument(
  ['-i', '--ignore'],
  {
    help: "Ignore pattern. Globs MUST be wrapped in quotes!",
    defaultValue: '',
    nargs: '+',
    dest: 'ignoreList'
  }
);

parser.addArgument(
  ['-r', '--jshintrc'],
  {
    help: 'Use jshintrc. Default: .jshintrc',
    defaultValue: '.jshintrc',
    dest: 'jshintrc'
  }
);

parser.addArgument(
  ['-g', '--glob'],
  {
    help: 'Specify file pattern to hint. Globs MUST be wrapped in quotes!',
    defaultValue: [],
    action: 'append',
    type: 'string',
    dest: 'globs'
  }
);

parser.addArgument(
  ['--stdin'],
  {
    help: 'Indicate that input will come from stdin instead of from a file.',
    dest: 'useStdin',
    action: 'storeTrue'
  }
);

parser.addArgument(
  ['-c', '--colored'],
  {
    help: 'Screen output will be colored.',
    dest: 'colored',
    action: 'storeTrue'
  }
);

parser.addArgument(
  ['--verbose'],
  {
    help: 'Verbose output - includes error/warning codes, similar to `jshint --verbose`.',
    dest: 'verbose',
    action: 'storeTrue'
  }
);

parser.addArgument(
  ['--show-lines'],
  {
    help: 'Show line references next to errors.',
    dest: 'showLineRefs',
    action: 'storeTrue'
  }
);


// this oddly wraps the arguments in an extra array...
parser.addArgument(
  ['files'],
  {
    help: 'List of files to hint',
    nargs: '?',
    action: 'append'
  }
);

try {
  args = parser.parseArgs();
  if (args.files.length === 1 && args.files[0] === null && !args.useStdin){
    throw new Error("Either --stdin or a file must be specified!");
  }
} catch (e){
  console.log(e.message.replace(/cli\.js/, 'jsxhint'));
  process.exit(1);
}

globs = args.globs.concat(args.files[0]);
var prjRoot = process.cwd();
var tasks = jsxhint.generateTasks(globs, args, prjRoot);
runnel(tasks);