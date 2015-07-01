'use strict';

var debug = require('debug')('hottest')
  , async = require('async')
  , assign = require('lodash.assign')
  , phantom = require('node-phantom-simple')
  , error = require('./util/error')
  , Test = require('./test')
  , Action = require('./action');

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

    loadImages: true,
    ignoreSslErrors: true,
    sslProtocols: 'any',
    webSecurity: true
  }, options);
  this._phantom = null;
  this._page = null;
  this._queue = [];
  this._queueAfterOpen = [];
  this._scope = null;
  this._selector = null;

  // Inherit from Action
  Action.call(this, this);
};

// Make actions available directly on browser
Browser.prototype = Object.create(Action.prototype);

Object.defineProperty(Browser.prototype, 'test', {
  get: function () {
    return new Test(this);
  }
});

Browser.prototype.enqueue = function (fn) {
  this._queue.push(fn);
  return this;
};

Browser.prototype.run = function (done) {
  var self = this;
  async.series([
    self._initPhantom.bind(self),
    self._initPage.bind(self),
    self._execQueue.bind(self)
  ], done);
  return self;
};

Browser.prototype._initPhantom = function (done) {
  var self = this;
  if (self._phantom)
    return done();
  var params = Object.keys(self.options).reduce(function (params, key) {
    var paramKey = PARAMS_MAP[key];
    if (paramKey)
      params[paramKey] = self.options[key];
    return params;
  }, {});
  phantom.create(function (err, ph) {
    if (err) return done(err);
    self._phantom = ph;
    return done();
  }, {
    parameters: params,
    phantomPath: require('phantomjs').path
  });
  return self;
};

Browser.prototype._initPage = function (done) {
  var self = this;
  if (self._page)
    return done();
  self._phantom.createPage(function (err, page) {
    if (err) return done(err);
    self._page = page;
    done();
  });
  return self;
};

Browser.prototype._execQueue = function (done) {
  var self = this;
  var queue = self._queue;
  self._queue = [];
  async.eachSeries(queue, function (action, cb) {
    action.call(self, cb);
  }, done);
  return self;
};

Browser.prototype.exit = function () {
  var self = this;
  self._phantom.exit();
  self._page = null;
  self._queue = null;
  return self;
};

Browser.prototype.open = function (location) {
  var self = this;
  return self.enqueue(function (done) {
    var url = self.options.baseUrl + location;
    debug('open %s', url);
    self._page.open(url, function (err) {
      if (err) return done(err);
      async.eachSeries(self._queueAfterOpen, function (action, cb) {
        action.call(self, cb);
      }, done);
    });
  });
};

Browser.prototype.afterOpen = function (fn) {
  var self = this;
  self._queueAfterOpen.push(fn);
  return self;
};

Browser.prototype.scope = function (selector) {
  var self = this;
  self._scope = selector;
  self._selector = null;
  return self;
};

Browser.prototype.select = function (selector) {
  var self = this;
  self._selector = selector;
  return self;
};

Browser.prototype.getSelector = function (sel) {
  var self = this;
  var prefix = self._scope ? self._scope + ' ' : '';
  var current = sel || self._selector;
  if (!current)
    throw error('Nothing is selected.');
  return prefix + current;
};
