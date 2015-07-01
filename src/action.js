'use strict';

var debug = require('debug')('hottest')
  , error = require('./util/error');

var Action = module.exports = exports = function (browser) {
  this.browser = browser;
};

Action.prototype.eval = function (clientFn /*, [params...[, cb]] */) {
  var browser = this.browser;
  return browser.enqueue(function (done) {
    var args = []
      , cb = null;
    for (var i = 1; i < arguments.length; i++) {
      var arg = arguments[i];
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

Action.prototype.wait = function (param) {
  var browser = this.browser;
  if (typeof param == 'number')
    return browser.delay(param);
  if (typeof param == 'string')
    return browser.waitFor(param);
  if (typeof param == 'function')
    return browser.waitFn(param);
  throw error('wait accepts milliseconds, selector or a function');
};

Action.prototype.delay = function (delay) {
  var browser = this.browser;
  return browser.enqueue(function (done) {
    debug('delay %s ms', delay);
    setTimeout(done, delay);
  });
};

Action.prototype.waitFn = function (fn) {
  var browser = this.browser
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
  return browser.enqueue(function (done) {
    debug('waitFn(<fn>)');
    check(done);
  });
};

Action.prototype.waitFor = function (sel) {
  var browser = this.browser
    , start = Date.now()
    , selector = browser.getSelector(sel);
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
  return browser.enqueue(function (done) {
    debug('waitFor(%s)', selector);
    check(done);
  });
};

Action.prototype.val = function (value) {
  var browser = this.browser
    , selector = browser.getSelector();
  return browser.enqueue(function (done) {
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

Action.prototype.click = function () {
  var browser = this.browser
    , selector = browser.getSelector();
  return browser.enqueue(function (done) {
    debug('click(%s)', selector);
    browser._page.evaluate(function (selector) {
      var element = document.querySelector(selector);
      if (!element)
        return false;
      var box = element.getBoundingClientRect();
      return {
        left: Math.ceil(box.left),
        top: Math.ceil(box.top)
      };
    }, function (err, coords) {
      if (err) return done(err);
      if (!coords)
        return done(error('val: %s not found', selector));
      browser._page.sendEvent('click', coords.left, coords.top);
      done();
    }, selector);
  });
};

