'use strict';

var debug = require('debug')('hottest')
  , error = require('./util/error');

var Test = module.exports = exports = function (browser) {
  this.browser = browser;
  this._expect = true;
};

Object.defineProperty(Test.prototype, 'not', {
  get: function () {
    this._expect = false;
    return this;
  }
});

Test.prototype.eval = function (clientFn /*, [params...] */) {
  var self = this
    , browser = self.browser;
  return browser.enqueue(function (done) {
    var args = [].slice.call(arguments, 1);
    debug('test(<fn>, %s)', args);
    browser._page.evaluate.apply(browser._page, [
      clientFn, function (err, result) {
        if (err) return done(err);
        if (result == self._expect)
          return done();
        return done(error('test.eval: <fn> returned %s, expected %s',
          result, self._expect));
      }
    ].concat(args));
  });
};

Test.prototype.hasClass = function (cl) {
  var self = this
    , browser = self.browser
    , selector = browser.getSelector();
  return browser.enqueue(function (done) {
    debug('hasClass(%s, %s)', selector, cl);
    browser._page.evaluate(function (selector, cl) {
      var element = document.querySelector(selector);
      if (!element)
        return false;
      return element.classList.contains(cl);
    }, function (err, contains) {
      if (err) return done(err);
      if (contains == self._expect)
        return done();
      if (self._expect)
        return done(error('test.hasClass: %s has no class %s', selector, cl));
      return done(error('test.hasClass: %s should not have class %s', selector, cl));
    }, selector, cl);
  });
};

