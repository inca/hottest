'use strict';

var debug = require('debug')('websurance')
  , Test = require('./test')
  , error = require('./util/error');

var Scope = module.exports = exports = function (browser, selector) {
  this.browser = browser;
  this._prefix = selector ? selector + ' ' : '';
  this._selector = '';
};

// Add test namespace

Object.defineProperty(Scope.prototype, 'test', {
  get: function () {
    return new Test(this);
  }
});

Scope.prototype.scope = function (selector) {
  var scope = this;
  debug('scope: %s', selector);
  return new Scope(scope.browser, scope._prefix + selector);
};

Scope.prototype.select = function (selector) {
  var scope = this;
  scope._selector = selector;
  return scope;
};

Scope.prototype.getSelector = function (sel) {
  var scope = this;
  var current = sel || scope._selector;
  if (!current)
    throw error('Nothing is selected.');
  return scope._prefix + current;
};

Scope.prototype.enqueue = function (fn) {
  var scope = this;
  scope.browser.enqueue(fn);
  return scope;
};

Scope.prototype.eval = function (clientFn /*, [params...[, cb]] */) {
  var scope = this
    , browser = scope.browser;
  var _arguments = arguments;
  return scope.enqueue(function (done) {
    var args = []
      , cb = null;
    for (var i = 1; i < _arguments.length; i++) {
      var arg = _arguments[i];
      if (typeof arg == 'function') {
        cb = arg;
        break;
      } else {
        args.push(arg);
      }
    }
    debug('eval(<fn>, %s)', args);
    browser._page.evaluate.apply(browser._page, [
      clientFn, function (err, result) {
        if (err) return done(err);
        if (cb) cb(result);
        done();
      }
    ].concat(args));
  });
};

Scope.prototype.wait = function (param) {
  var scope = this;
  if (typeof param == 'number')
    return scope.delay(param);
  if (typeof param == 'string')
    return scope.waitFor(param);
  if (typeof param == 'function')
    return scope.waitFn(param);
  throw error('wait accepts milliseconds, selector or a function');
};

Scope.prototype.delay = function (delay) {
  var scope = this;
  return scope.enqueue(function (done) {
    debug('delay %s ms', delay);
    setTimeout(done, delay);
  });
};

Scope.prototype.waitFn = function (fn) {
  var scope = this
    , browser = scope.browser
    , start = Date.now();
  function check(done) {
    browser._page.evaluate(fn, function (err, result) {
      if (err) return done(err);
      if (result) return done();
      if (Date.now() > (start + browser.options.timeout))
        return done(error('waitFn timed out'));
      setTimeout(function () {
        check(done);
      }, browser.options.pollInterval);
    });
  }
  return scope.enqueue(function (done) {
    debug('waitFn(<fn>)');
    check(done);
  });
};

Scope.prototype.waitFor = function (sel) {
  var scope = this
    , browser = scope.browser
    , start = Date.now()
    , selector = scope.getSelector(sel);
  function check(done) {
    browser._page.evaluate(function (selector) {
      return document.querySelectorAll(selector).length;
    }, function (err, result) {
      if (err) return done(err);
      if (result) return done();
      if (Date.now() > (start + browser.options.timeout))
        return done(error('waitFor(%s) timed out', selector));
      setTimeout(function () {
        check(done);
      }, browser.options.pollInterval);
    }, selector);
  }
  return scope.enqueue(function (done) {
    debug('waitFor(%s)', selector);
    check(done);
  });
};

Scope.prototype.val = function (value) {
  var scope = this
    , browser = scope.browser
    , selector = scope.getSelector();
  return scope.enqueue(function (done) {
    debug('val(%s, %s)', selector, value);
    browser._page.evaluate(function (selector, value) {
      var element = document.querySelector(selector);
      if (!element)
        return false;
      if (typeof element.value == 'undefined')
        return false;
      element.value = value;
      var ev = document.createEvent('HTMLEvents');
      ev.initEvent('change', false, true);
      element.dispatchEvent(ev);
      return true;
    }, function (err, found) {
      if (err) return done(err);
      if (!found)
        return done(error('val: %s not found / not an input', selector));
      return done();
    }, selector, value);
  });
};

Scope.prototype.click = function () {
  var scope = this
    , browser = scope.browser
    , selector = scope.getSelector();
  return scope.enqueue(function (done) {
    debug('click(%s)', selector);
    browser._page.evaluate(function (selector) {
      var element = document.querySelector(selector);
      if (!element)
        return false;
      var ev = document.createEvent('MouseEvents');
      ev.initEvent('click', true, true);
      element.dispatchEvent(ev);
      return true;
    }, function (err, found) {
      if (err) return done(err);
      if (!found)
        return done(error('val: %s not found', selector));
      done();
    }, selector);
  });
};
