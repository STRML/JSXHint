'use strict'

var React = require('react-tools/build/modules/React');

var statusForm = React.createClass({
  render: function(){
    return  <form class="form-horizontal" role="form">
              <div class="form-group">
                <label for="brand-lead" class="col-sm-4 control-label">Brand lead:</label>
                <div class="col-sm-8">
                  <input class="form-control"
                         placeholder="brand lead"
                         type="text"
                         id="brand-lead"
                         ref="brandLead"
                         data-state="brandLead" />
                </div>
              </div>
              <div class="form-group">
                <label for="status-text" class="col-sm-4 control-label">Status:</label>
                <div class="col-sm-8">
                  <textarea
                    id="status-text"
                    class="form-control"
                    rows="40"
                    ref="statusText"
                    data-state="statusText"/>
                </div>
              </div>

              <input class="btn btn-success" type="submit" value="Save status"/>
            </form>
  }
});

module.exports = statusForm;