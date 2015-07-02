'use strict';

var debug = require('debug')('hottest')
  , async = require('async')
  , assign = require('lodash.assign')
  , phantom = require('node-phantom-simple')
  , Scope = require('./scope');

var PARAMS_MAP = {
  loadImages: 'load-images',
  ignoreSslErrors: 'ignore-ssl-errors',
  sslProtocol: 'ssl-protocol',
  webSecurity: 'web-security',
  proxy: 'proxy',
  proxyType: 'proxy-type',
  proxyAuth: 'proxy-auth',
  cookiesFile: 'cookies-file'
};

var Browser = module.exports = exports = function (options) {
  this.options = assign({}, {
    baseUrl: '',
    timeout: 5000,
    pollInterval: 50,
    width: 1920,
    height: 1080,
    // PhantomJS args
    loadImages: true,
    ignoreSslErrors: true,
    sslProtocols: 'any',
    webSecurity: true
  }, options);
  this._phantom = null;
  this._page = null;
  this._queue = [];
  this._queueAfterOpen = [];

  // Inherit from Scope
  Scope.call(this, this);
};

// Inherit from Scope
Browser.prototype = Object.create(Scope.prototype);

Browser.prototype.enqueue = function (fn) {
  this._queue.push(fn);
  return this;
};

Browser.prototype.run = function (done) {
  var browser = this;
  async.series([
    browser._initPhantom.bind(browser),
    browser._initPage.bind(browser),
    browser._execQueue.bind(browser)
  ], done);
  return browser;
};

Browser.prototype._initPhantom = function (done) {
  var browser = this;
  if (browser._phantom)
    return done();
  var params = Object.keys(browser.options).reduce(function (params, key) {
    var paramKey = PARAMS_MAP[key];
    if (paramKey)
      params[paramKey] = browser.options[key];
    return params;
  }, {});
  phantom.create(function (err, ph) {
    if (err) return done(err);
    browser._phantom = ph;
    return done();
  }, {
    parameters: params,
    phantomPath: require('phantomjs').path
  });
  return browser;
};

Browser.prototype._initPage = function (done) {
  var browser = this;
  if (browser._page)
    return done();
  browser._phantom.createPage(function (err, page) {
    if (err) return done(err);
    browser._page = page;
    done();
  });
  return browser;
};

Browser.prototype._execQueue = function (done) {
  var browser = this;
  var queue = browser._queue;
  browser._queue = [];
  async.eachSeries(queue, function (action, cb) {
    action.call(browser, cb);
  }, done);
  return browser;
};

Browser.prototype.exit = function () {
  var browser = this;
  browser._phantom.exit();
  browser._page = null;
  browser._queue = null;
  return browser;
};

Browser.prototype.open = function (location) {
  var browser = this;
  return browser
    .viewport(this.options.width, this.options.height)
    .enqueue(function (done) {
    var url = browser.options.baseUrl + location;
    debug('open %s', url);
    browser._page.open(url, function (err) {
      if (err) return done(err);
      async.eachSeries(browser._queueAfterOpen, function (action, cb) {
        action.call(browser, cb);
      }, done);
    });
  });
};

Browser.prototype.afterOpen = function (fn) {
  var browser = this;
  browser._queueAfterOpen.push(fn);
  return browser;
};

Browser.prototype.viewport = function (width, height) {
  var browser = this;
  return browser.enqueue(function (done) {
    browser._page.set('viewportSize', {
      width: width,
      height: height
    }, done);
  });
};

Browser.prototype.screenshot = function (file) {
  var browser = this;
  return browser.enqueue(function (done) {
    debug('screenshot: %s', file);
    browser._page.render(file, done);
  });
};
