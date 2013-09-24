#!/usr/bin/env node
'use strict';

var jsxhint = require('./jsxhint');
var version = require('./package').version;
var name = require('./package').name;
var description = require('./package').description;
var log = require('npmlog');
var runnel = require('runnel');
var ArgParse = require('argparse').ArgumentParser;

var globs = [];
var args = {};

var parser = new ArgParse({
  version: version,
  addHelp: true,
  description: description,
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

// this oddly wraps the arguments in an extra array...
parser.addArgument(
  ['files'],
  {
    help: 'List of files to hint',
    nargs: '+',
    action: 'append'
  }
);

try {
  args = parser.parseArgs();
} catch (e){
  console.log(e.message.replace(/cli\.js/, 'jsxhint'));
  process.exit(1);
}

globs = args.globs.concat(args.files[0]);
var prjRoot = process.cwd();
var tasks = jsxhint.generateTasks(globs, args.ignoreList, args.ignoreFile, args.jshintrc, prjRoot);
runnel(tasks);