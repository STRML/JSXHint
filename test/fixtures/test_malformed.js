'use strict';

var React = require('react-tools/build/modules/React');

// This fixture is intended to test the --transform-errors option introduced in #62.
// It intentionally does not have a JSX extension.
module.exports = React.createClass({
  render: function(){
    return <div;
  }
});
