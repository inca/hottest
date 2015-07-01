'use strict';

var sprintf = require('sprintf');

module.exports = exports = function () {
  return new Error(sprintf.apply(sprintf, arguments));
};
