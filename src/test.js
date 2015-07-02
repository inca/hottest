'use strict';

var debug = require('debug')('websurance')
  , error = require('./util/error');

var Test = module.exports = exports = function (scope) {
  this.scope = scope;
  this.browser = scope.browser;
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
    , scope = self.scope
    , browser = self.browser;
  return scope.enqueue(function (done) {
    var args = [].slice.call(arguments, 1);
    debug('test.eval(<fn>, %s)', args);
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
    , scope = self.scope
    , browser = self.browser
    , selector = scope.getSelector();
  return scope.enqueue(function (done) {
    debug('test.hasClass(%s, %s)', selector, cl);
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

Test.prototype.count = function (count) {
  var self = this
    , scope = self.scope
    , browser = self.browser
    , selector = scope.getSelector();
  return scope.enqueue(function (done) {
    debug('test.count(%s, %s)', selector, count);
    browser._page.evaluate(function (selector) {
      return document.querySelectorAll(selector).length;
    }, function (err, actual) {
      if (err) return done(err);
      if ((actual == count) == self._expect)
        return done();
      if (self._expect)
        return done(error('test.count: %s x %s is expected (%s found)',
          selector, count, +actual));
      return done(error('test.count: %s x %s is not expected', selector, count));
    }, selector);
  });
};

Test.prototype.visible = function () {
  var self = this
    , scope = self.scope
    , browser = self.browser
    , selector = scope.getSelector();
  return scope.enqueue(function (done) {
    debug('test.visible(%s)', selector);
    browser._page.evaluate(function (selector) {
      var element = document.querySelector(selector);
      if (!element)
        return false;
      var box = element.getBoundingClientRect();
      return box.width && box.height;
    }, function (err, visible) {
      if (err) return done(err);
      if (visible == self._expect)
        return done();
      if (self._expect)
        return done(error('test.count: %s should be visible',
          selector));
      return done(error('test.count: %s x %s should not be visible', selector));
    }, selector);
  });
};

Test.prototype.val = function (value) {
  var self = this
    , scope = self.scope
    , browser = self.browser
    , selector = scope.getSelector();
  return scope.enqueue(function (done) {
    debug('test.val(%s, %s)', selector, value);
    browser._page.evaluate(function (selector) {
      var element = document.querySelector(selector);
      if (!element)
        return false;
      return {
        value: element.value
      };
    }, function (err, actual) {
      if (err) return done(err);
      if (!actual)
        return done(error('test:val: %s not found'));
      if ((actual.value == value) == self._expect)
        return done();
      if (self._expect)
        return done(error('test.val: %s has value %s (expected %s)',
          selector, actual.value, value));
      return done(error('test.val: %s should not have value %s',
        selector, value));
    }, selector);
  });
};

Test.prototype.text = function (value) {
  var self = this
    , scope = self.scope
    , browser = self.browser
    , selector = scope.getSelector();
  return scope.enqueue(function (done) {
    debug('test.text(%s, %s)', selector, value);
    browser._page.evaluate(function (selector) {
      var elements = document.querySelectorAll(selector);
      if (!elements.length)
        return false;
      return {
        value: [].map.call(elements, function (el) {
          return el.innerText.trim();
        }).join('')
      };
    }, function (err, actual) {
      if (err) return done(err);
      if (!actual)
        return done(error('test.text: %s not found'));
      if ((actual.value == value) == self._expect)
        return done();
      if (self._expect)
        return done(error('test.text: %s has text %s (expected %s)',
          selector, actual.value, value));
      return done(error('test.text: %s should not have text %s',
        selector, value));
    }, selector);
  });
};

