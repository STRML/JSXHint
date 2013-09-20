#JSXHint
A wrapper around JSHint to allow linting of files containg JSX syntax

Accepts glob patterns. Respects your local .jshintrc file and .gitignore to filter your glob patterns.

##Usage
./jsxhint "**/*js"

##Roadmap
Move command line tool out of main script, add options for allowing user-defined ignore patterns and JSHint options.