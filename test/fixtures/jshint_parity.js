'use strict'

var React = require('react-tools/build/modules/React');

var statusForm = React.createClass({displayName: 'statusForm',
  render: function(){
    if (var foo = true){
      // linter will hate this
    }
    return  React.DOM.form( {class:"form-horizontal", role:"form"}, 
              React.DOM.div( {class:"form-group"}, 
                React.DOM.label( {for:"brand-lead", class:"col-sm-4 control-label"}, "Brand lead:"),
                React.DOM.div( {class:"col-sm-8"}, 
                  React.DOM.input( {class:"form-control",
                         placeholder:"brand lead",
                         type:"text",
                         id:"brand-lead",
                         ref:"brandLead",
                         'data-state':"brandLead"} )
                )
              ),
              React.DOM.div( {class:"form-group"}, 
                React.DOM.label( {for:"status-text", class:"col-sm-4 control-label"}, "Status:"),
                React.DOM.div( {class:"col-sm-8"}, 
                  React.DOM.textarea(
                    {id:"status-text",
                    class:"form-control",
                    rows:"40",
                    ref:"statusText",
                    'data-state':"statusText"})
                )
              ),

              React.DOM.input( {class:"btn btn-success", type:"submit", value:"Save status"})
            )
  }
});

module.exports = statusForm;
