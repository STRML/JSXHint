'use strict';

var chai = require('chai').expect;
var jsxlint = require('./jsxlint');

describe("ignore loading tests", function(){
  it('should load and provide an array of regexps from .gitignore', function(done){
    var cb(err, ignores){
      if(err){
        done(err);
      }
      expect(ignores).to.be.an('array');
      ignores.forEach(function(re){
        expect(re).to.be.an.instanceOf(RegExp);
      });
      done();
    }
  });
});