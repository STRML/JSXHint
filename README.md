[![build status](https://secure.travis-ci.org/CondeNast/JSXHint.png)](http://travis-ci.org/CondeNast/JSXHint)

#JSXHint
A wrapper around JSHint to allow linting of files containg JSX syntax

Accepts glob patterns. Respects your local .jshintrc file and .gitignore to filter your glob patterns.

##Installation
`npm install -g jsxhint`

##Usage
```
usage: jsxhint [-h] [-v] [-f IGNOREFILE] [-i IGNORELIST [IGNORELIST ...]]
               [-r JSHINTRC] [-g GLOBS]
               files [files ...]

Wrapper for JSHint to allow hinting of JSX files

Positional arguments:
  files                 List of files to hint

Optional arguments:
  -h, --help            Show this help message and exit.
  -v, --version         Show program's version number and exit.
  -f IGNOREFILE, --ignore-file IGNOREFILE
                        Use ignore file. Default: .gitignore
  -i IGNORELIST [IGNORELIST ...], --ignore IGNORELIST [IGNORELIST ...]
                        Ignore pattern. Globs MUST be wrapped in quotes!
  -r JSHINTRC, --jshintrc JSHINTRC
                        Use jshintrc. Default: .jshintrc
  -g GLOBS, --glob GLOBS
                        Specify file pattern to hint. Globs MUST be wrapped
                        in quotes!
```