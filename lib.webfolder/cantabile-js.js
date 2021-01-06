(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.Cantabile = f()}})(function(){var define,module,exports;return (function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

var objectCreate = Object.create || objectCreatePolyfill
var objectKeys = Object.keys || objectKeysPolyfill
var bind = Function.prototype.bind || functionBindPolyfill

function EventEmitter() {
  if (!this._events || !Object.prototype.hasOwnProperty.call(this, '_events')) {
    this._events = objectCreate(null);
    this._eventsCount = 0;
  }

  this._maxListeners = this._maxListeners || undefined;
}
module.exports = EventEmitter;

// Backwards-compat with node 0.10.x
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.prototype._events = undefined;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
var defaultMaxListeners = 10;

var hasDefineProperty;
try {
  var o = {};
  if (Object.defineProperty) Object.defineProperty(o, 'x', { value: 0 });
  hasDefineProperty = o.x === 0;
} catch (err) { hasDefineProperty = false }
if (hasDefineProperty) {
  Object.defineProperty(EventEmitter, 'defaultMaxListeners', {
    enumerable: true,
    get: function() {
      return defaultMaxListeners;
    },
    set: function(arg) {
      // check whether the input is a positive number (whose value is zero or
      // greater and not a NaN).
      if (typeof arg !== 'number' || arg < 0 || arg !== arg)
        throw new TypeError('"defaultMaxListeners" must be a positive number');
      defaultMaxListeners = arg;
    }
  });
} else {
  EventEmitter.defaultMaxListeners = defaultMaxListeners;
}

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function setMaxListeners(n) {
  if (typeof n !== 'number' || n < 0 || isNaN(n))
    throw new TypeError('"n" argument must be a positive number');
  this._maxListeners = n;
  return this;
};

function $getMaxListeners(that) {
  if (that._maxListeners === undefined)
    return EventEmitter.defaultMaxListeners;
  return that._maxListeners;
}

EventEmitter.prototype.getMaxListeners = function getMaxListeners() {
  return $getMaxListeners(this);
};

// These standalone emit* functions are used to optimize calling of event
// handlers for fast cases because emit() itself often has a variable number of
// arguments and can be deoptimized because of that. These functions always have
// the same number of arguments and thus do not get deoptimized, so the code
// inside them can execute faster.
function emitNone(handler, isFn, self) {
  if (isFn)
    handler.call(self);
  else {
    var len = handler.length;
    var listeners = arrayClone(handler, len);
    for (var i = 0; i < len; ++i)
      listeners[i].call(self);
  }
}
function emitOne(handler, isFn, self, arg1) {
  if (isFn)
    handler.call(self, arg1);
  else {
    var len = handler.length;
    var listeners = arrayClone(handler, len);
    for (var i = 0; i < len; ++i)
      listeners[i].call(self, arg1);
  }
}
function emitTwo(handler, isFn, self, arg1, arg2) {
  if (isFn)
    handler.call(self, arg1, arg2);
  else {
    var len = handler.length;
    var listeners = arrayClone(handler, len);
    for (var i = 0; i < len; ++i)
      listeners[i].call(self, arg1, arg2);
  }
}
function emitThree(handler, isFn, self, arg1, arg2, arg3) {
  if (isFn)
    handler.call(self, arg1, arg2, arg3);
  else {
    var len = handler.length;
    var listeners = arrayClone(handler, len);
    for (var i = 0; i < len; ++i)
      listeners[i].call(self, arg1, arg2, arg3);
  }
}

function emitMany(handler, isFn, self, args) {
  if (isFn)
    handler.apply(self, args);
  else {
    var len = handler.length;
    var listeners = arrayClone(handler, len);
    for (var i = 0; i < len; ++i)
      listeners[i].apply(self, args);
  }
}

EventEmitter.prototype.emit = function emit(type) {
  var er, handler, len, args, i, events;
  var doError = (type === 'error');

  events = this._events;
  if (events)
    doError = (doError && events.error == null);
  else if (!doError)
    return false;

  // If there is no 'error' event listener then throw.
  if (doError) {
    if (arguments.length > 1)
      er = arguments[1];
    if (er instanceof Error) {
      throw er; // Unhandled 'error' event
    } else {
      // At least give some kind of context to the user
      var err = new Error('Unhandled "error" event. (' + er + ')');
      err.context = er;
      throw err;
    }
    return false;
  }

  handler = events[type];

  if (!handler)
    return false;

  var isFn = typeof handler === 'function';
  len = arguments.length;
  switch (len) {
      // fast cases
    case 1:
      emitNone(handler, isFn, this);
      break;
    case 2:
      emitOne(handler, isFn, this, arguments[1]);
      break;
    case 3:
      emitTwo(handler, isFn, this, arguments[1], arguments[2]);
      break;
    case 4:
      emitThree(handler, isFn, this, arguments[1], arguments[2], arguments[3]);
      break;
      // slower
    default:
      args = new Array(len - 1);
      for (i = 1; i < len; i++)
        args[i - 1] = arguments[i];
      emitMany(handler, isFn, this, args);
  }

  return true;
};

function _addListener(target, type, listener, prepend) {
  var m;
  var events;
  var existing;

  if (typeof listener !== 'function')
    throw new TypeError('"listener" argument must be a function');

  events = target._events;
  if (!events) {
    events = target._events = objectCreate(null);
    target._eventsCount = 0;
  } else {
    // To avoid recursion in the case that type === "newListener"! Before
    // adding it to the listeners, first emit "newListener".
    if (events.newListener) {
      target.emit('newListener', type,
          listener.listener ? listener.listener : listener);

      // Re-assign `events` because a newListener handler could have caused the
      // this._events to be assigned to a new object
      events = target._events;
    }
    existing = events[type];
  }

  if (!existing) {
    // Optimize the case of one listener. Don't need the extra array object.
    existing = events[type] = listener;
    ++target._eventsCount;
  } else {
    if (typeof existing === 'function') {
      // Adding the second element, need to change to array.
      existing = events[type] =
          prepend ? [listener, existing] : [existing, listener];
    } else {
      // If we've already got an array, just append.
      if (prepend) {
        existing.unshift(listener);
      } else {
        existing.push(listener);
      }
    }

    // Check for listener leak
    if (!existing.warned) {
      m = $getMaxListeners(target);
      if (m && m > 0 && existing.length > m) {
        existing.warned = true;
        var w = new Error('Possible EventEmitter memory leak detected. ' +
            existing.length + ' "' + String(type) + '" listeners ' +
            'added. Use emitter.setMaxListeners() to ' +
            'increase limit.');
        w.name = 'MaxListenersExceededWarning';
        w.emitter = target;
        w.type = type;
        w.count = existing.length;
        if (typeof console === 'object' && console.warn) {
          console.warn('%s: %s', w.name, w.message);
        }
      }
    }
  }

  return target;
}

EventEmitter.prototype.addListener = function addListener(type, listener) {
  return _addListener(this, type, listener, false);
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.prependListener =
    function prependListener(type, listener) {
      return _addListener(this, type, listener, true);
    };

function onceWrapper() {
  if (!this.fired) {
    this.target.removeListener(this.type, this.wrapFn);
    this.fired = true;
    switch (arguments.length) {
      case 0:
        return this.listener.call(this.target);
      case 1:
        return this.listener.call(this.target, arguments[0]);
      case 2:
        return this.listener.call(this.target, arguments[0], arguments[1]);
      case 3:
        return this.listener.call(this.target, arguments[0], arguments[1],
            arguments[2]);
      default:
        var args = new Array(arguments.length);
        for (var i = 0; i < args.length; ++i)
          args[i] = arguments[i];
        this.listener.apply(this.target, args);
    }
  }
}

function _onceWrap(target, type, listener) {
  var state = { fired: false, wrapFn: undefined, target: target, type: type, listener: listener };
  var wrapped = bind.call(onceWrapper, state);
  wrapped.listener = listener;
  state.wrapFn = wrapped;
  return wrapped;
}

EventEmitter.prototype.once = function once(type, listener) {
  if (typeof listener !== 'function')
    throw new TypeError('"listener" argument must be a function');
  this.on(type, _onceWrap(this, type, listener));
  return this;
};

EventEmitter.prototype.prependOnceListener =
    function prependOnceListener(type, listener) {
      if (typeof listener !== 'function')
        throw new TypeError('"listener" argument must be a function');
      this.prependListener(type, _onceWrap(this, type, listener));
      return this;
    };

// Emits a 'removeListener' event if and only if the listener was removed.
EventEmitter.prototype.removeListener =
    function removeListener(type, listener) {
      var list, events, position, i, originalListener;

      if (typeof listener !== 'function')
        throw new TypeError('"listener" argument must be a function');

      events = this._events;
      if (!events)
        return this;

      list = events[type];
      if (!list)
        return this;

      if (list === listener || list.listener === listener) {
        if (--this._eventsCount === 0)
          this._events = objectCreate(null);
        else {
          delete events[type];
          if (events.removeListener)
            this.emit('removeListener', type, list.listener || listener);
        }
      } else if (typeof list !== 'function') {
        position = -1;

        for (i = list.length - 1; i >= 0; i--) {
          if (list[i] === listener || list[i].listener === listener) {
            originalListener = list[i].listener;
            position = i;
            break;
          }
        }

        if (position < 0)
          return this;

        if (position === 0)
          list.shift();
        else
          spliceOne(list, position);

        if (list.length === 1)
          events[type] = list[0];

        if (events.removeListener)
          this.emit('removeListener', type, originalListener || listener);
      }

      return this;
    };

EventEmitter.prototype.removeAllListeners =
    function removeAllListeners(type) {
      var listeners, events, i;

      events = this._events;
      if (!events)
        return this;

      // not listening for removeListener, no need to emit
      if (!events.removeListener) {
        if (arguments.length === 0) {
          this._events = objectCreate(null);
          this._eventsCount = 0;
        } else if (events[type]) {
          if (--this._eventsCount === 0)
            this._events = objectCreate(null);
          else
            delete events[type];
        }
        return this;
      }

      // emit removeListener for all listeners on all events
      if (arguments.length === 0) {
        var keys = objectKeys(events);
        var key;
        for (i = 0; i < keys.length; ++i) {
          key = keys[i];
          if (key === 'removeListener') continue;
          this.removeAllListeners(key);
        }
        this.removeAllListeners('removeListener');
        this._events = objectCreate(null);
        this._eventsCount = 0;
        return this;
      }

      listeners = events[type];

      if (typeof listeners === 'function') {
        this.removeListener(type, listeners);
      } else if (listeners) {
        // LIFO order
        for (i = listeners.length - 1; i >= 0; i--) {
          this.removeListener(type, listeners[i]);
        }
      }

      return this;
    };

function _listeners(target, type, unwrap) {
  var events = target._events;

  if (!events)
    return [];

  var evlistener = events[type];
  if (!evlistener)
    return [];

  if (typeof evlistener === 'function')
    return unwrap ? [evlistener.listener || evlistener] : [evlistener];

  return unwrap ? unwrapListeners(evlistener) : arrayClone(evlistener, evlistener.length);
}

EventEmitter.prototype.listeners = function listeners(type) {
  return _listeners(this, type, true);
};

EventEmitter.prototype.rawListeners = function rawListeners(type) {
  return _listeners(this, type, false);
};

EventEmitter.listenerCount = function(emitter, type) {
  if (typeof emitter.listenerCount === 'function') {
    return emitter.listenerCount(type);
  } else {
    return listenerCount.call(emitter, type);
  }
};

EventEmitter.prototype.listenerCount = listenerCount;
function listenerCount(type) {
  var events = this._events;

  if (events) {
    var evlistener = events[type];

    if (typeof evlistener === 'function') {
      return 1;
    } else if (evlistener) {
      return evlistener.length;
    }
  }

  return 0;
}

EventEmitter.prototype.eventNames = function eventNames() {
  return this._eventsCount > 0 ? Reflect.ownKeys(this._events) : [];
};

// About 1.5x faster than the two-arg version of Array#splice().
function spliceOne(list, index) {
  for (var i = index, k = i + 1, n = list.length; k < n; i += 1, k += 1)
    list[i] = list[k];
  list.pop();
}

function arrayClone(arr, n) {
  var copy = new Array(n);
  for (var i = 0; i < n; ++i)
    copy[i] = arr[i];
  return copy;
}

function unwrapListeners(arr) {
  var ret = new Array(arr.length);
  for (var i = 0; i < ret.length; ++i) {
    ret[i] = arr[i].listener || arr[i];
  }
  return ret;
}

function objectCreatePolyfill(proto) {
  var F = function() {};
  F.prototype = proto;
  return new F;
}
function objectKeysPolyfill(obj) {
  var keys = [];
  for (var k in obj) if (Object.prototype.hasOwnProperty.call(obj, k)) {
    keys.push(k);
  }
  return k;
}
function functionBindPolyfill(context) {
  var fn = this;
  return function () {
    return fn.apply(context, arguments);
  };
}

},{}],2:[function(require,module,exports){
// shim for using process in browser
var process = module.exports = {};

// cached from whatever global is present so that test runners that stub it
// don't break things.  But we need to wrap it in a try catch in case it is
// wrapped in strict mode code which doesn't define any globals.  It's inside a
// function because try/catches deoptimize in certain engines.

var cachedSetTimeout;
var cachedClearTimeout;

function defaultSetTimout() {
    throw new Error('setTimeout has not been defined');
}
function defaultClearTimeout () {
    throw new Error('clearTimeout has not been defined');
}
(function () {
    try {
        if (typeof setTimeout === 'function') {
            cachedSetTimeout = setTimeout;
        } else {
            cachedSetTimeout = defaultSetTimout;
        }
    } catch (e) {
        cachedSetTimeout = defaultSetTimout;
    }
    try {
        if (typeof clearTimeout === 'function') {
            cachedClearTimeout = clearTimeout;
        } else {
            cachedClearTimeout = defaultClearTimeout;
        }
    } catch (e) {
        cachedClearTimeout = defaultClearTimeout;
    }
} ())
function runTimeout(fun) {
    if (cachedSetTimeout === setTimeout) {
        //normal enviroments in sane situations
        return setTimeout(fun, 0);
    }
    // if setTimeout wasn't available but was latter defined
    if ((cachedSetTimeout === defaultSetTimout || !cachedSetTimeout) && setTimeout) {
        cachedSetTimeout = setTimeout;
        return setTimeout(fun, 0);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedSetTimeout(fun, 0);
    } catch(e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't trust the global object when called normally
            return cachedSetTimeout.call(null, fun, 0);
        } catch(e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error
            return cachedSetTimeout.call(this, fun, 0);
        }
    }


}
function runClearTimeout(marker) {
    if (cachedClearTimeout === clearTimeout) {
        //normal enviroments in sane situations
        return clearTimeout(marker);
    }
    // if clearTimeout wasn't available but was latter defined
    if ((cachedClearTimeout === defaultClearTimeout || !cachedClearTimeout) && clearTimeout) {
        cachedClearTimeout = clearTimeout;
        return clearTimeout(marker);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedClearTimeout(marker);
    } catch (e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't  trust the global object when called normally
            return cachedClearTimeout.call(null, marker);
        } catch (e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error.
            // Some versions of I.E. have different rules for clearTimeout vs setTimeout
            return cachedClearTimeout.call(this, marker);
        }
    }



}
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    if (!draining || !currentQueue) {
        return;
    }
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = runTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    runClearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        runTimeout(drainQueue);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;
process.prependListener = noop;
process.prependOnceListener = noop;

process.listeners = function (name) { return [] }

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}],3:[function(require,module,exports){
'use strict';

var _classCallCheck2 = require('babel-runtime/helpers/classCallCheck');

var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

var _createClass2 = require('babel-runtime/helpers/createClass');

var _createClass3 = _interopRequireDefault(_createClass2);

var _possibleConstructorReturn2 = require('babel-runtime/helpers/possibleConstructorReturn');

var _possibleConstructorReturn3 = _interopRequireDefault(_possibleConstructorReturn2);

var _inherits2 = require('babel-runtime/helpers/inherits');

var _inherits3 = _interopRequireDefault(_inherits2);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var EndPoint = require('./EndPoint');

/**
 * Interface to the application object
 * 
 * Access this object via the {{#crossLink "Cantabile/application:property"}}{{/crossLink}} property.
 *
 * @class Application
 * @extends EndPoint
 */

var Application = function (_EndPoint) {
	(0, _inherits3.default)(Application, _EndPoint);

	function Application(owner) {
		(0, _classCallCheck3.default)(this, Application);
		return (0, _possibleConstructorReturn3.default)(this, (Application.__proto__ || Object.getPrototypeOf(Application)).call(this, owner, "/api/application"));
	}

	(0, _createClass3.default)(Application, [{
		key: '_onOpen',
		value: function _onOpen() {
			this.emit('busyChanged', this.busy);
			this.emit('changed');
		}
	}, {
		key: '_onClose',
		value: function _onClose() {
			this.emit('busyChanged', this.busy);
			this.emit('changed');
		}

		/**
   * The application's company name
   * @property companyName
   * @type {String}
   */

	}, {
		key: '_onEvent_busyChanged',
		value: function _onEvent_busyChanged(data) {
			this._data.busy = data.busy;
			this.emit('busyChanged', this.busy);
		}
	}, {
		key: 'companyName',
		get: function get() {
			return this._data ? this._data.companyName : null;
		}

		/**
   * The application name
   * @property name
   * @type {String}
   */

	}, {
		key: 'name',
		get: function get() {
			return this._data ? this._data.name : null;
		}

		/**
   * The application version string
   * @property version
   * @type {String}
   */

	}, {
		key: 'version',
		get: function get() {
			return this._data ? this._data.version : null;
		}

		/**
   * The application edition string
   * @property edition
   * @type {String}
   */

	}, {
		key: 'edition',
		get: function get() {
			return this._data ? this._data.edition : null;
		}

		/**
   * The application's copyright message
   * @property copyright
   * @type {String}
   */

	}, {
		key: 'copyright',
		get: function get() {
			return this._data ? this._data.copyright : null;
		}

		/**
   * The application's build number
   * @property build
   * @type {Number}
   */

	}, {
		key: 'build',
		get: function get() {
			return this._data ? this._data.build : null;
		}

		/**
   * The application's busy status
   * @property busy
   * @type {Boolean}
   */

	}, {
		key: 'busy',
		get: function get() {
			return this._data ? this._data.busy : false;
		}
	}]);
	return Application;
}(EndPoint);

module.exports = Application;

},{"./EndPoint":6,"babel-runtime/helpers/classCallCheck":22,"babel-runtime/helpers/createClass":23,"babel-runtime/helpers/inherits":24,"babel-runtime/helpers/possibleConstructorReturn":25}],4:[function(require,module,exports){
'use strict';

var _regenerator = require('babel-runtime/regenerator');

var _regenerator2 = _interopRequireDefault(_regenerator);

var _asyncToGenerator2 = require('babel-runtime/helpers/asyncToGenerator');

var _asyncToGenerator3 = _interopRequireDefault(_asyncToGenerator2);

var _classCallCheck2 = require('babel-runtime/helpers/classCallCheck');

var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

var _createClass2 = require('babel-runtime/helpers/createClass');

var _createClass3 = _interopRequireDefault(_createClass2);

var _possibleConstructorReturn2 = require('babel-runtime/helpers/possibleConstructorReturn');

var _possibleConstructorReturn3 = _interopRequireDefault(_possibleConstructorReturn2);

var _inherits2 = require('babel-runtime/helpers/inherits');

var _inherits3 = _interopRequireDefault(_inherits2);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var debug = require('debug')('Cantabile');
var EndPoint = require('./EndPoint');
var EventEmitter = require('events');

/**
 * Represents an active connection watching a source binding point for changes/invocations

 * Returned from the {{#crossLink "Bindings/watch:method"}}{{/crossLink}} method.
 * 
 * @class BindingWatcher
 * @extends EventEmitter
 */

var BindingWatcher = function (_EventEmitter) {
	(0, _inherits3.default)(BindingWatcher, _EventEmitter);

	function BindingWatcher(owner, name, indicies, condition, listener) {
		(0, _classCallCheck3.default)(this, BindingWatcher);

		var _this = (0, _possibleConstructorReturn3.default)(this, (BindingWatcher.__proto__ || Object.getPrototypeOf(BindingWatcher)).call(this));

		_this.owner = owner;
		_this._name = name;
		_this._indicies = indicies;
		_this._condition = condition;
		_this._listener = listener;
		_this._value = null;
		return _this;
	}

	/**
  * Returns the name of the binding point being listened to
  *
  * @property name
  * @type {String} 
  */


	(0, _createClass3.default)(BindingWatcher, [{
		key: '_start',
		value: function _start() {
			var _this2 = this;

			this.owner.post("/watch", {
				name: this._name,
				indicies: this._indicies,
				condition: this._condition
			}).then(function (r) {
				_this2.owner._registerWatchId(r.data.watchId, _this2);
				_this2._watchId = r.data.watchId;
				if (r.data.value !== null && r.data.value !== undefined) {
					_this2._value = r.data.value;
					_this2._fireInvoked();
				}
			});
		}
	}, {
		key: '_stop',
		value: function _stop() {
			if (this.owner._epid && this._watchId) {
				this.owner.send("/unwatch", { watchId: this._watchId });
				this.owner._revokeWatchId(this._watchId);
				this._watchId = 0;
				if (this._value !== null && this._value !== undefined) {
					this._value = null;
					this._fireInvoked();
				}
			}
		}

		/**
   * Stops monitoring this binding source
   *
   * @method unwatch
   */

	}, {
		key: 'unwatch',
		value: function unwatch() {
			this._stop();
			this.owner._revokeWatcher(this);
		}
	}, {
		key: '_update',
		value: function _update(data) {
			this._value = data.value;
			this._fireInvoked();
		}
	}, {
		key: '_fireInvoked',
		value: function _fireInvoked() {
			// Function listener?
			if (this._listener) this._listener(this._value, this);

			/**
    * Fired when the source binding point is triggered
    *
    * @event invoked
    * @param {Object} value The value supplied from the source binding
    * @param {BindingWatcher} source This object
    */
			this.emit('invoked', this.value, this);
		}
	}, {
		key: 'name',
		get: function get() {
			return this._name;
		}

		/**
   * Returns the indicies of the binding point being listened to
   *
   * @property indicies
   * @type {Number[]} 
   */

	}, {
		key: 'indicies',
		get: function get() {
			return this._indicies;
		}

		/**
   * Returns the condition of the binding point being listened to
   *
   * @property condition
   * @type {Object} 
   */

	}, {
		key: 'condition',
		get: function get() {
			return this._condition;
		}

		/**
   * Returns the last received value for the source binding point
   *
   * @property value
   * @type {Object} 
   */

	}, {
		key: 'value',
		get: function get() {
			return this._value;
		}
	}]);
	return BindingWatcher;
}(EventEmitter);

/**
 * Provides access to Cantabile's binding points.
 * 
 * Access this object via the {{#crossLink "Cantabile/bindings:property"}}{{/crossLink}} property.
 *
 * @class Bindings
 * @extends EndPoint
 */


var Bindings = function (_EndPoint) {
	(0, _inherits3.default)(Bindings, _EndPoint);

	function Bindings(owner) {
		(0, _classCallCheck3.default)(this, Bindings);

		var _this3 = (0, _possibleConstructorReturn3.default)(this, (Bindings.__proto__ || Object.getPrototypeOf(Bindings)).call(this, owner, "/api/bindings"));

		_this3._watchers = [];
		_this3._watchIds = {};
		return _this3;
	}

	(0, _createClass3.default)(Bindings, [{
		key: '_onOpen',
		value: function _onOpen() {
			for (var i = 0; i < this._watchers.length; i++) {
				this._watchers[i]._start();
			}
		}
	}, {
		key: '_onClose',
		value: function _onClose() {
			for (var i = 0; i < this._watchers.length; i++) {
				this._watchers[i]._stop();
			}
		}

		/**
   * Retrieves a list of available binding points
  * 
  * If Cantabile is running on your local machine you can view this list
  * directly at <http://localhost:35007/api/bindings/availableBindingPoints>
   * 
   * @example
   * 
   *     let C = new CantabileApi();
   *     C.connect();
   *     console.log(await C.bindings.availableBindingPoints());
   * 
   * @method availableBindingPoints
   * @returns {Promise|BindingPointInfo[]} A promise to return an array of BindingPointInfo
   */

	}, {
		key: 'availableBindingPoints',
		value: function () {
			var _ref = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee() {
				return _regenerator2.default.wrap(function _callee$(_context) {
					while (1) {
						switch (_context.prev = _context.next) {
							case 0:
								_context.next = 2;
								return this.owner.untilConnected();

							case 2:
								_context.next = 4;
								return this.request("GET", "/availableBindingPoints");

							case 4:
								return _context.abrupt('return', _context.sent.data);

							case 5:
							case 'end':
								return _context.stop();
						}
					}
				}, _callee, this);
			}));

			function availableBindingPoints() {
				return _ref.apply(this, arguments);
			}

			return availableBindingPoints;
		}()

		/**
   * Invokes a target binding point
   * 
   * If Cantabile is running on your local machine a full list of available binding
   * points is [available here](http://localhost:35007/api/bindings/availableBindingPoints)
   * 
   * @example
   * 
   * Set the master output level gain
  * 
   *     C.bindings.invoke("global.masterLevels.outputGain", 0.5);
   * 
   * @example
   * 
   * Suspend the 2nd plugin in the song
  * 
   *     C.bindings.invoke("global.indexedPlugin.suspend", true, [
   * 	        0,     // Rack index (zero = song)
   *          1      // Plugin index (zero based, 1 = the second plugin)
   * 		]);
   * 
  * 
  * @example
  * 
  * Sending a MIDI Controller Event
  * 
  *     C.bindings.invoke("midiInputPort.Main Keyboard", new {
  *         kind: "FineController",
  *         controller: 10,
  *         value: 1000,
  * 	   });
  *
  * @example
  * 
  * Sending MIDI Data directly
  * 
  *     C.bindings.invoke("midiInputPort.Main Keyboard", [ 0xb0, 23, 99 ]);
  * 
  * @example
  * 
  * Sending MIDI Sysex Data directly
  * 
  *     C.bindings.invoke("midiInputPort.Main Keyboard", [ 0xF7, 0x00, 0x00, 0x00, 0xF0 ]);
  * 
   * @example
   * 
   * Some binding points expect a "parameter" value.  Parameter values are similar to the `value` parameter
   * in that they specify a value to invoke on the target of the binding.  The difference is related to the
   * way they're managed internally for user created bindings.  The `value` comes from the source of the binding 
   * whereas a `parameter` value is stored with the binding itself.
   * 
   * eg: Load the song with program number 12
  * 
   *     C.bindings.invoke("global.setList.loadSpecificSongByProgramInstant", null, null, 12);
   * 
   * @param {String} name The name of the binding point to invoke
   * @param {Object} [value] The value to pass to the binding point
   * @param {Number[]} [indicies] The integer indicies of the target binding point
   * @param {Object} [parameter] The parameter value to invoke the target with
   * @method invoke
   * @returns {Promise} A promise that resolves once the target binding point has been invoked
   */

	}, {
		key: 'invoke',
		value: function () {
			var _ref2 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee2(name, value, indicies, parameter) {
				return _regenerator2.default.wrap(function _callee2$(_context2) {
					while (1) {
						switch (_context2.prev = _context2.next) {
							case 0:
								_context2.next = 2;
								return this.request("POST", "/invoke", {
									name: name,
									value: value,
									indicies: indicies,
									parameter: parameter
								});

							case 2:
								return _context2.abrupt('return', _context2.sent);

							case 3:
							case 'end':
								return _context2.stop();
						}
					}
				}, _callee2, this);
			}));

			function invoke(_x, _x2, _x3, _x4) {
				return _ref2.apply(this, arguments);
			}

			return invoke;
		}()

		/**
   * Queries a source binding point for it's current value.
   *
   * If Cantabile is running on your local machine a full list of available binding
   * points is [available here](http://localhost:35007/api/bindings/availableBindingPoints)
   * 
   * @example
   * 
   *     console.log("Current Output Gain:", await C.bindings.query("global.masterLevels.outputGain"));
   * 
  * @method query
   * @param {String} name The name of the binding point to query
   * @param {Number[]} [indicies] The integer indicies of the binding point
  * @returns {Object} The current value of the binding source
   */

	}, {
		key: 'query',
		value: function () {
			var _ref3 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee3(name, indicies) {
				return _regenerator2.default.wrap(function _callee3$(_context3) {
					while (1) {
						switch (_context3.prev = _context3.next) {
							case 0:
								_context3.next = 2;
								return this.request("POST", "/query", {
									name: name,
									indicies: indicies
								});

							case 2:
								return _context3.abrupt('return', _context3.sent.data.value);

							case 3:
							case 'end':
								return _context3.stop();
						}
					}
				}, _callee3, this);
			}));

			function query(_x5, _x6) {
				return _ref3.apply(this, arguments);
			}

			return query;
		}()

		/**
   * Starts watching a source binding point for changes (or invocations)
   * 
      * If Cantabile is running on your local machine a full list of available binding
      * points is [available here](http://localhost:35007/api/bindings/availableBindingPoints)
      *
   * @example
   * 
   * Using a callback function:
   * 
   *     let C = new CantabileApi();
   *     
   *     // Watch a source binding point using a callback function
   *     C.bindings.watch("global.masterLevels.outputGain", null, null, function(value) {
   *         console.log("Master output gain changed to:", value);
   *     })
   *     
   * 	   // The "bindings" end point must be opened before callbacks will happen
   *     C.bindings.open();
   * 
   * @example
   * 
   * Using the BindingWatcher class and events:
   * 
   *     let C = new CantabileApi();
   *     let watcher = C.bindings.watch("global.masterLevels.outputGain");
   *     watcher.on('invoked', function(value) {
   *         console.log("Master output gain changed to:", value);
   *     });
   *     
   * 	   // The "variables" end point must be opened before callbacks will happen
   *     C.variables.open();
   *     
   *     /// later, stop listening
   *     watcher.unwatch();
   * 
   * @example
   * 
   * Watching for a MIDI event:
   * 
      *     C.bindings.watch("midiInputPort.Onscreen Keyboard", null, {
      *         channel: 0,
      *         kind: "ProgramChange",
      *         controller: -1,
      *     }, function(value) {
      *         console.log("Program Change: ", value);
      *     })
   * 
   * @example
  	 * Watching for a keystroke:
   * 
   *     C.bindings.watch("global.pckeyboard.keyPress", null, "Ctrl+Alt+M", function() {
      *         console.log("Key press!");
      *     })
   * 
   * 
   * 
   *
   * @method watch
      * @param {String} name The name of the binding point to query
      * @param {Number[]} [indicies] The integer indicies of the binding point
      * @param {Object} [condition] The condition for triggering the binding
   * @param {Function} [callback] Optional callback function to be called when the source binding triggers
   * 
   * The callback function has the form function(resolved, source) where resolved is the resolved display string and source
   * is the BindingWatcher instance.
   * 
   * @returns {BindingWatcher}
   */

	}, {
		key: 'watch',
		value: function watch(name, indicies, condition, listener) {
			var w = new BindingWatcher(this, name, indicies, condition, listener);
			this._watchers.push(w);

			if (this.isOpen) w._start();

			return w;
		}
	}, {
		key: '_registerWatchId',
		value: function _registerWatchId(watchId, watcher) {
			this._watchIds[watchId] = watcher;
		}
	}, {
		key: '_revokeWatchId',
		value: function _revokeWatchId(watchId) {
			delete this._watchIds[watchId];
		}
	}, {
		key: '_revokeWatcher',
		value: function _revokeWatcher(w) {
			this._watchers = this._watchers.filter(function (x) {
				return x != w;
			});
		}
	}, {
		key: '_onEvent_invoked',
		value: function _onEvent_invoked(data) {
			// Get the watcher
			var w = this._watchIds[data.watchId];
			if (w) {
				w._update(data);
			}
		}
	}]);
	return Bindings;
}(EndPoint);

module.exports = Bindings;

},{"./EndPoint":6,"babel-runtime/helpers/asyncToGenerator":21,"babel-runtime/helpers/classCallCheck":22,"babel-runtime/helpers/createClass":23,"babel-runtime/helpers/inherits":24,"babel-runtime/helpers/possibleConstructorReturn":25,"babel-runtime/regenerator":27,"debug":120,"events":1}],5:[function(require,module,exports){
(function (process){
'use strict';

var _classCallCheck2 = require('babel-runtime/helpers/classCallCheck');

var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

var _createClass2 = require('babel-runtime/helpers/createClass');

var _createClass3 = _interopRequireDefault(_createClass2);

var _possibleConstructorReturn2 = require('babel-runtime/helpers/possibleConstructorReturn');

var _possibleConstructorReturn3 = _interopRequireDefault(_possibleConstructorReturn2);

var _inherits2 = require('babel-runtime/helpers/inherits');

var _inherits3 = _interopRequireDefault(_inherits2);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var WebSocket = require('isomorphic-ws');
var debug = require('debug')('Cantabile');
var EventEmitter = require('events');

/**
* Represents a connection to Cantabile.
* 
* @class Cantabile
* @extends EventEmitter
* @constructor
* @param {String} [socketUrl] The websocket URL of the Cantabile instance to connect to.
* When running in a browser, the defaults to `ws://${window.location.host}/api/socket`.  In other
* environments it defaults to `ws://localhost:35007/api/socket`.
*/

var Cantabile = function (_EventEmitter) {
	(0, _inherits3.default)(Cantabile, _EventEmitter);

	function Cantabile(socketUrl) {
		(0, _classCallCheck3.default)(this, Cantabile);

		var _this = (0, _possibleConstructorReturn3.default)(this, (Cantabile.__proto__ || Object.getPrototypeOf(Cantabile)).call(this));

		var defaultHost = process.browser ? window.location.host : "localhost:35007";
		_this.socketUrl = socketUrl || `ws://${defaultHost}/api/socket/`;
		_this.shouldConnect = false;
		_this._nextRid = 1;
		_this._pendingResponseHandlers = {};
		_this._endPointEventHandlers = {};
		_this._setState("disconnected");

		/**
   * Gets the setList object
   *
   * @property setList
   * @type {SetList} 
   */
		_this.setList = new (require('./SetList'))(_this);

		/**
   * Gets the states of the current song
   *
   * @property songStates
   * @type {SongStates} 
   */
		_this.songStates = new (require('./SongStates'))(_this);

		/**
   * Gets the currently active key ranges
   *
   * @property keyRanges
   * @type {KeyRanges} 
   */
		_this.keyRanges = new (require('./KeyRanges'))(_this);

		/**
   * Gets the current set of show notes
   *
   * @property showNotes
   * @type {ShowNotes} 
   */
		_this.showNotes = new (require('./ShowNotes'))(_this);

		/**
   * Provides access to variable expansion facilities
   *
   * @property variables
   * @type {Variables} 
   */
		_this.variables = new (require('./Variables'))(_this);

		/**
   * Provides access to global binding points
   *
   * @property bindings
   * @type {Bindings} 
   */
		_this.bindings = new (require('./Bindings'))(_this);

		/**
   * Provides access to information about the current song
   *
   * @property song
   * @type {Song} 
   */
		_this.song = new (require('./Song'))(_this);

		/**
   * Provides access to master transport controls
   *
   * @property song
   * @type {Song} 
   */
		_this.transport = new (require('./Transport'))(_this);

		/**
   * Provides access to the application object
   *
   * @property application
   * @type {Application} 
   */
		_this.application = new (require('./Application'))(_this);
		return _this;
	}

	/**
  * The current connection state, either "connecting", "connected" or "disconnected"
  *
  * @property state
  * @type {String} 
  */


	(0, _createClass3.default)(Cantabile, [{
		key: 'connect',


		/**
   * Initiate connection and retry if fails
   * @method connect
   */
		value: function connect() {
			this.shouldConnect = true;
			this._internalConnect();
		}

		/**
   * Disconnect and stop retries
   * @method disconnect
   */

	}, {
		key: 'disconnect',
		value: function disconnect() {
			this.shouldConnect = false;
			this._internalDisconnect();
		}

		/**
   * Stringify an object as a JSON message and send it to the server
   *
   * @method send
   * @param {object} obj The object to send
   */

	}, {
		key: 'send',
		value: function send(obj) {
			debug('SEND: %j', obj);
			this._ws.send(JSON.stringify(obj));
		}

		/**
   * Stringify an object as a JSON message, send it to the server and returns 
   * a promise which will resolve to the result.
   *
   * @method request
   * @param {object} obj The object to send
   * @returns {Promise|object}
   */

	}, {
		key: 'request',
		value: function request(message) {
			return new Promise(function (resolve, reject) {

				// Tag the message with the request id
				message.rid = this._nextRid++;

				// Store in the response handler map
				this._pendingResponseHandlers[message.rid] = {
					message: message,
					resolve: resolve,
					reject: reject
				};

				// Send the request
				this.send(message);
			}.bind(this));
		}

		/**
   * Returns a promise that will be resolved when connected
   * 
   * @example
   * 
   *     let C = new CantabileApi();
   *     await C.untilConnected();
   *
   * @method untilConnected
   * @returns {Promise}
   */

	}, {
		key: 'untilConnected',
		value: function untilConnected() {
			var _this2 = this;

			if (this._state == "connected") {
				return Promise.resolve();
			} else {
				return new Promise(function (resolve, reject) {
					if (!_this2.pendingConnectPromises) _this2.pendingConnectPromises = [resolve];else _this2.pendingConnectPromises.push(resolve);
				});
			}
		}

		// PRIVATE:

		// Internal helper to change state, log it and fire event

	}, {
		key: '_setState',
		value: function _setState(value) {
			if (this._state != value) {
				this._state = value;
				this.emit('stateChanged', value);
				this.emit(value);
				debug(value);

				if (this._state == "connected") {
					if (this.pendingConnectPromises) {
						for (var i = 0; i < this.pendingConnectPromises.length; i++) {
							this.pendingConnectPromises[i]();
						}
						this.pendingConnectPromises = null;
					}
				}
			}
		}

		// Internal helper to actually perform the connection

	}, {
		key: '_internalConnect',
		value: function _internalConnect() {
			if (!this.shouldConnect) return;

			// Already connected?
			if (this._ws) return;

			this._setState("connecting");

			// Create the socket and hook up handlers
			debug("Opening web socket '%s'", this.socketUrl);
			this._ws = new WebSocket(this.socketUrl);
			this._ws.onerror = this._onSocketError.bind(this);
			this._ws.onopen = this._onSocketOpen.bind(this);
			this._ws.onclose = this._onSocketClose.bind(this);
			this._ws.onmessage = this._onSocketMessage.bind(this);
		}

		// Internal helper to disconnect

	}, {
		key: '_internalDisconnect',
		value: function _internalDisconnect() {
			if (this.state == "connected") this._setState("disconnected");

			// Already disconnected?
			if (!this._ws) return;

			this._ws.close();
			delete this._ws;
		}

		// Internal helper to retry connection every 1 second

	}, {
		key: '_internalReconnect',
		value: function _internalReconnect() {
			if (this.shouldConnect && !this.timeoutPending) {
				this.timeoutPending = true;
				this._setState("connecting");
				setTimeout(function () {
					this.timeoutPending = false;
					this._internalConnect();
				}.bind(this), 1000);
			}
		}

		// Socket onerror handler

	}, {
		key: '_onSocketError',
		value: function _onSocketError(evt) {
			// Disconnect
			this._internalDisconnect();

			// Try to reconnect...
			this._internalReconnect();
		}

		// Socket onopen handler

	}, {
		key: '_onSocketOpen',
		value: function _onSocketOpen() {
			this._setState("connected");
		}

		// Socket onclose handler

	}, {
		key: '_onSocketClose',
		value: function _onSocketClose() {
			if (this._ws) {
				this._setState("disconnected");
				delete this._ws;

				// Reject any pending requests
				/*
    var pending = this._pendingResponseHandlers;
    console.log(pending);
    this._pendingResponseHandlers = {};
    for (let key in pending) 
    {
    	debugger;
    	console.log("===> disconnecting", key);
      	pending[key].reject(new Error("Disconnected"));
    }
    */
			}

			// Try to reconnect...
			this._internalReconnect();
		}

		// Socket onmessage handler

	}, {
		key: '_onSocketMessage',
		value: function _onSocketMessage(msg) {
			msg = JSON.parse(msg.data);

			debug('RECV: %j', msg);

			// Request response?
			if (msg.rid) {
				// Find the handler
				var handlerInfo = this._pendingResponseHandlers[msg.rid];
				if (!handlerInfo) {
					debug('ERROR: received response for unknown rid:', msg.rid);
					return;
				}

				// Remove from pending map
				delete this._pendingResponseHandlers[msg.rid];

				// Resolve reject
				if (msg.status >= 200 && msg.status < 300) handlerInfo.resolve(msg);else handlerInfo.reject(new Error(`${msg.status} - ${msg.statusDescription}`));
			}

			// Event message?
			if (msg.epid && msg.eventName) {
				var ep = this._endPointEventHandlers[msg.epid];
				if (ep) {
					ep._dispatchEventMessage(msg.eventName, msg.data);
				} else {
					debug(`ERROR: No event handler found for end point ${msg.epid}`);
				}
			}
		}
	}, {
		key: '_registerEndPointEventHandler',
		value: function _registerEndPointEventHandler(epid, endPoint) {
			this._endPointEventHandlers[epid] = endPoint;
		}
	}, {
		key: '_revokeEndPointEventHandler',
		value: function _revokeEndPointEventHandler(epid) {
			delete this._endPointEventHandlers[epid];
		}
	}, {
		key: 'state',
		get: function get() {
			return this._state;
		}
	}]);
	return Cantabile;
}(EventEmitter);

/**
 * Fired when the {{#crossLink "Cantabile/state:property"}}{{/crossLink}} property value changes
 *
 * @event stateChanged
 * @param {String} state The new connection state ("connecting", "connected" or "disconnected")
 */


var eventStateChanged = "stateChanged";

/**
 * Fired when entering the connected state
 *
 * @event connected
 */
var eventConnected = "connected";

/**
 * Fired when entering the connecting state
 *
 * @event connecting
 */
var eventConnecting = "connecting";

/**
 * Fired when entering the disconnected state
 *
 * @event disconnected
 */
var eventDiconnected = "disconnected";

module.exports = Cantabile;

}).call(this,require('_process'))
},{"./Application":3,"./Bindings":4,"./KeyRanges":7,"./SetList":8,"./ShowNotes":9,"./Song":10,"./SongStates":11,"./Transport":13,"./Variables":14,"_process":2,"babel-runtime/helpers/classCallCheck":22,"babel-runtime/helpers/createClass":23,"babel-runtime/helpers/inherits":24,"babel-runtime/helpers/possibleConstructorReturn":25,"debug":120,"events":1,"isomorphic-ws":122}],6:[function(require,module,exports){
'use strict';

var _regenerator = require('babel-runtime/regenerator');

var _regenerator2 = _interopRequireDefault(_regenerator);

var _asyncToGenerator2 = require('babel-runtime/helpers/asyncToGenerator');

var _asyncToGenerator3 = _interopRequireDefault(_asyncToGenerator2);

var _classCallCheck2 = require('babel-runtime/helpers/classCallCheck');

var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

var _createClass2 = require('babel-runtime/helpers/createClass');

var _createClass3 = _interopRequireDefault(_createClass2);

var _possibleConstructorReturn2 = require('babel-runtime/helpers/possibleConstructorReturn');

var _possibleConstructorReturn3 = _interopRequireDefault(_possibleConstructorReturn2);

var _inherits2 = require('babel-runtime/helpers/inherits');

var _inherits3 = _interopRequireDefault(_inherits2);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var debug = require('debug')('Cantabile');
var EventEmitter = require('events');

// Helper to correctly join two paths ensuring only a single slash between them
function joinPath(a, b) {
	while (a.endsWith('/')) {
		a = a.substr(0, a.length - 1);
	}while (b.startsWith('/')) {
		b = b.substr(1);
	}return `${a}/${b}`;
}

/**
 * Common functionality for all end point handlers
 *
 * @class EndPoint
 * @extends EventEmitter
 */

var EndPoint = function (_EventEmitter) {
	(0, _inherits3.default)(EndPoint, _EventEmitter);

	// Private constructor
	function EndPoint(owner, endPoint) {
		(0, _classCallCheck3.default)(this, EndPoint);

		var _this = (0, _possibleConstructorReturn3.default)(this, (EndPoint.__proto__ || Object.getPrototypeOf(EndPoint)).call(this));

		_this.owner = owner;
		_this.endPoint = endPoint;
		_this.openCount = 0;
		_this.owner.on('connected', _this._onConnected.bind(_this));
		_this.owner.on('disconnected', _this._onDisconnected.bind(_this));
		return _this;
	}

	/**
  * Opens this end point and starts listening for events
  * @method open
  */


	(0, _createClass3.default)(EndPoint, [{
		key: 'open',
		value: function open() {
			this.openCount++;

			if (this.openCount == 1 && this.owner.state == "connected") {
				this._onConnected();
			}
		}

		/**
   * Closes the end point and stops listening for events
   * @method close
   */

	}, {
		key: 'close',
		value: function close() {
			// Reduce the open reference count
			this.openCount--;
			if (this.openCount > 0) return;

			// Send the close message
			this.owner.send({
				method: "close",
				epid: this._epid
			});

			// Remove end point event handler
			this.owner._revokeEndPointEventHandler(this._epid);

			this._onClose();

			delete this._epid;
			delete this._data;
		}
	}, {
		key: 'send',
		value: function send(method, endPoint, data) {
			if (this._epid) {
				// If connection is open, pass the epid and just the sub-url path
				return this.owner.send({
					ep: endPoint,
					epid: this._epid,
					method: method,
					data: data
				});
			} else {
				// If connection isn't open, need to specify the full end point url
				return this.owner.send({
					ep: joinPath(this.endPoint, endPoint),
					method: method,
					data: data
				});
			}
		}
	}, {
		key: 'request',
		value: function request(method, endPoint, data) {
			if (this._epid) {
				// If connection is open, pass the epid and just the sub-url path
				return this.owner.request({
					ep: endPoint,
					epid: this._epid,
					method: method,
					data: data
				});
			} else {
				// If connection isn't open, need to specify the full end point url
				return this.owner.request({
					ep: joinPath(this.endPoint, endPoint),
					method: method,
					data: data
				});
			}
		}
	}, {
		key: 'post',
		value: function post(endPoint, data) {
			return this.request('post', endPoint, data);
		}
	}, {
		key: 'untilOpen',


		/**
   * Returns a promise that will be resolved when this end point is opened
   * 
   * @example
   * 
   *     let C = new CantabileApi();
   * 	   C.application.open();
   *     await C.application.untilOpen();
   *
   * @method untilOpen
   * @returns {Promise}
   */
		value: function untilOpen() {
			var _this2 = this;

			if (this.isOpen) {
				return Promise.resolve();
			} else {
				return new Promise(function (resolve, reject) {
					if (!_this2._pendingOpenPromises) _this2._pendingOpenPromises = [resolve];else _this2._pendingOpenPromises.push(resolve);
				});
			}
		}
	}, {
		key: '_onConnected',
		value: function () {
			var _ref = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee() {
				var msg, i;
				return _regenerator2.default.wrap(function _callee$(_context) {
					while (1) {
						switch (_context.prev = _context.next) {
							case 0:
								_context.prev = 0;

								if (!(this.openCount == 0)) {
									_context.next = 3;
									break;
								}

								return _context.abrupt('return');

							case 3:
								_context.next = 5;
								return this.owner.request({
									method: "open",
									ep: this.endPoint
								});

							case 5:
								msg = _context.sent;


								this._epid = msg.epid;
								this._data = msg.data;
								this.owner._registerEndPointEventHandler(this._epid, this);

								this._onOpen();

								// Resolve open promises
								if (this._pendingOpenPromises) {
									for (i = 0; i < this._pendingOpenPromises.length; i++) {
										this._pendingOpenPromises[i]();
									}
									this._pendingOpenPromises = null;
								}
								_context.next = 17;
								break;

							case 13:
								_context.prev = 13;
								_context.t0 = _context['catch'](0);

								debug(_context.t0);
								throw _context.t0;

							case 17:
							case 'end':
								return _context.stop();
						}
					}
				}, _callee, this, [[0, 13]]);
			}));

			function _onConnected() {
				return _ref.apply(this, arguments);
			}

			return _onConnected;
		}()
	}, {
		key: '_onDisconnected',
		value: function _onDisconnected() {
			if (this._epid) this.owner._revokeEndPointEventHandler(this._epid);
			delete this._epid;
			delete this._data;
			this._onClose();
		}
	}, {
		key: '_onOpen',
		value: function _onOpen() {}
	}, {
		key: '_onClose',
		value: function _onClose() {}
	}, {
		key: '_dispatchEventMessage',
		value: function _dispatchEventMessage(eventName, data) {
			if (this["_onEvent_" + eventName]) {
				this["_onEvent_" + eventName](data);
			}
		}
	}, {
		key: 'isOpen',
		get: function get() {
			return !!this._epid;
		}
	}]);
	return EndPoint;
}(EventEmitter);

module.exports = EndPoint;

},{"babel-runtime/helpers/asyncToGenerator":21,"babel-runtime/helpers/classCallCheck":22,"babel-runtime/helpers/createClass":23,"babel-runtime/helpers/inherits":24,"babel-runtime/helpers/possibleConstructorReturn":25,"babel-runtime/regenerator":27,"debug":120,"events":1}],7:[function(require,module,exports){
'use strict';

var _classCallCheck2 = require('babel-runtime/helpers/classCallCheck');

var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

var _createClass2 = require('babel-runtime/helpers/createClass');

var _createClass3 = _interopRequireDefault(_createClass2);

var _possibleConstructorReturn2 = require('babel-runtime/helpers/possibleConstructorReturn');

var _possibleConstructorReturn3 = _interopRequireDefault(_possibleConstructorReturn2);

var _inherits2 = require('babel-runtime/helpers/inherits');

var _inherits3 = _interopRequireDefault(_inherits2);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var debug = require('debug')('Cantabile');
var EndPoint = require('./EndPoint');

/**
 * Provides access to information about the currently active set of key ranges
 * 
 * Access this object via the {{#crossLink "Cantabile/keyRanges:property"}}{{/crossLink}} property.
 *
 * @class KeyRanges
 * @extends EndPoint
 */

var KeyRanges = function (_EndPoint) {
	(0, _inherits3.default)(KeyRanges, _EndPoint);

	function KeyRanges(owner) {
		(0, _classCallCheck3.default)(this, KeyRanges);
		return (0, _possibleConstructorReturn3.default)(this, (KeyRanges.__proto__ || Object.getPrototypeOf(KeyRanges)).call(this, owner, "/api/keyranges"));
	}

	(0, _createClass3.default)(KeyRanges, [{
		key: '_onOpen',
		value: function _onOpen() {
			/**
    * Fired when the active set of key ranges has changed
    *
    * @event changed
    */
			this.emit('changed');
		}
	}, {
		key: '_onClose',
		value: function _onClose() {
			this.emit('changed');
		}

		/**
   * An array of key ranges
   * @property items
   * @type {KeyRange[]}
   */

	}, {
		key: '_onEvent_keyRangesChanged',
		value: function _onEvent_keyRangesChanged(data) {
			this._data = data;
			this.emit('changed');
		}
	}, {
		key: 'items',
		get: function get() {
			return this._data ? this._data.items : null;
		}
	}]);
	return KeyRanges;
}(EndPoint);

module.exports = KeyRanges;

},{"./EndPoint":6,"babel-runtime/helpers/classCallCheck":22,"babel-runtime/helpers/createClass":23,"babel-runtime/helpers/inherits":24,"babel-runtime/helpers/possibleConstructorReturn":25,"debug":120}],8:[function(require,module,exports){
'use strict';

var _classCallCheck2 = require('babel-runtime/helpers/classCallCheck');

var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

var _createClass2 = require('babel-runtime/helpers/createClass');

var _createClass3 = _interopRequireDefault(_createClass2);

var _possibleConstructorReturn2 = require('babel-runtime/helpers/possibleConstructorReturn');

var _possibleConstructorReturn3 = _interopRequireDefault(_possibleConstructorReturn2);

var _inherits2 = require('babel-runtime/helpers/inherits');

var _inherits3 = _interopRequireDefault(_inherits2);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var debug = require('debug')('Cantabile');
var EndPoint = require('./EndPoint');

/**
 * Used to access and control Cantabile's set list functionality.
 * 
 * Access this object via the {{#crossLink "Cantabile/setList:property"}}{{/crossLink}} property.
 *
 * @class SetList
 * @extends EndPoint
 */

var SetList = function (_EndPoint) {
	(0, _inherits3.default)(SetList, _EndPoint);

	function SetList(owner) {
		(0, _classCallCheck3.default)(this, SetList);

		var _this = (0, _possibleConstructorReturn3.default)(this, (SetList.__proto__ || Object.getPrototypeOf(SetList)).call(this, owner, "/api/setlist"));

		_this._currentSong = null;
		return _this;
	}

	(0, _createClass3.default)(SetList, [{
		key: '_onOpen',
		value: function _onOpen() {
			this._resolveCurrentSong();
			this.emit('reload');
			this.emit('changed');
			this.emit('preLoadedChanged');
		}
	}, {
		key: '_onClose',
		value: function _onClose() {
			this._resolveCurrentSong();
			this.emit('reload');
			this.emit('changed');
			this.emit('preLoadedChanged');
		}

		/**
   * An array of items in the set list
   * @property items
   * @type {SetListItem[]}
   */

	}, {
		key: 'loadSongByIndex',


		/**
   * Load the song at a given index position
   * @method loadSongByIndex
   * @param {Number} index The zero based index of the song to load
   * @param {Boolean} [delayed=false] Whether to perform a delayed or immediate load
   */
		value: function loadSongByIndex(index, delayed) {
			this.post("/loadSongByIndex", {
				index: index,
				delayed: delayed
			});
		}

		/**
   * Load the song with a given program number
   * @method loadSongByProgram
   * @param {Number} index The zero based program number of the song to load
   * @param {Boolean} [delayed=false] Whether to perform a delayed or immediate load
   */

	}, {
		key: 'loadSongByProgram',
		value: function loadSongByProgram(pr, delayed) {
			this.post("/loadSongByProgram", {
				pr: pr,
				delayed: delayed
			});
		}

		/**
   * Load the first song in the set list
   * @method loadFirstSong
   * @param {Boolean} [delayed=false] Whether to perform a delayed or immediate load
   */

	}, {
		key: 'loadFirstSong',
		value: function loadFirstSong(delayed) {
			this.post("/loadFirstSong", {
				delayed: delayed
			});
		}

		/**
   * Load the last song in the set list
   * @method loadLastSong
   * @param {Boolean} [delayed=false] Whether to perform a delayed or immediate load
   */

	}, {
		key: 'loadLastSong',
		value: function loadLastSong(delayed) {
			this.post("/loadLastSong", {
				delayed: delayed
			});
		}

		/**
   * Load the next or previous song in the set list
   * @method loadNextSong
   * @param {Number} direction Direction to move (1 = next, -1 = previous)
   * @param {Boolean} [delayed=false] Whether to perform a delayed or immediate load
   * @param {Boolean} [wrap=false] Whether to wrap around at the start/end of the list
   */

	}, {
		key: 'loadNextSong',
		value: function loadNextSong(direction, delayed, wrap) {
			this.post("/loadNextSong", {
				direction: direction,
				delayed: delayed,
				wrap: wrap
			});
		}
	}, {
		key: '_resolveCurrentSong',
		value: function _resolveCurrentSong() {
			// Check have data and current index is in range and record the current song
			if (this._data && this._data.current >= 0 && this._data.current < this._data.items.length) {
				this._currentSong = this._data.items[this._data.current];
			} else {
				this._currentSong = null;
			}
		}
	}, {
		key: '_onEvent_setListChanged',
		value: function _onEvent_setListChanged(data) {
			this._data = data;
			this._resolveCurrentSong();
			this.emit('reload');
			this.emit('changed');
			this.emit('preLoadedChanged');
		}
	}, {
		key: '_onEvent_itemAdded',
		value: function _onEvent_itemAdded(data) {
			this._data.items.splice(data.index, 0, data.item);
			this.emit('itemAdded', data.index);
			this.emit('changed');

			/**
    * Fired after a new item has been added to the set list
    *
    * @event itemAdded
    * @param {Number} index The zero based index of the newly added item 
    */

			/**
    * Fired when anything about the contents of the set list changes
    *
    * @event changed
    */
		}
	}, {
		key: '_onEvent_itemRemoved',
		value: function _onEvent_itemRemoved(data) {
			this._data.items.splice(data.index, 1);
			this.emit('itemRemoved', data.index);
			this.emit('changed');

			/**
    * Fired after an item has been removed from the set list
    *
    * @event itemRemoved
    * @param {Number} index The zero based index of the removed item 
    */
		}
	}, {
		key: '_onEvent_itemMoved',
		value: function _onEvent_itemMoved(data) {
			var item = this._data.items[data.from];
			this._data.items.splice(data.from, 1);
			this._data.items.splice(data.to, 0, item);
			this.emit('itemMoved', data.from, data.to);
			this.emit('changed');

			/**
    * Fired when an item in the set list has been moved
    *
    * @event itemMoved
    * @param {Number} from The zero based index of the item before being moved
    * @param {Number} to The zero based index of the item's new position
    */
		}
	}, {
		key: '_onEvent_itemChanged',
		value: function _onEvent_itemChanged(data) {
			if (this.currentSongIndex == data.index) this._currentSong = data.item;

			this._data.items.splice(data.index, 1, data.item); // Don't use [] so Vue can handle it

			this.emit('itemChanged', data.index);
			this.emit('changed');

			/**
    * Fired when something about an item has changed
    *
    * @event itemChanged
    * @param {Number} index The zero based index of the item that changed
    */
		}
	}, {
		key: '_onEvent_itemsReload',
		value: function _onEvent_itemsReload(data) {
			this._data.items = data.items;
			this._data.current = data.current;
			this._resolveCurrentSong();
			this.emit('reload');
			this.emit('changed');

			/**
    * Fired when the entire set list has changed (eg: after a sort operation, or loading a new set list)
    * 
    * @event reload
    */
		}
	}, {
		key: '_onEvent_preLoadedChanged',
		value: function _onEvent_preLoadedChanged(data) {
			this._data.preLoaded = data.preLoaded;
			this.emit('preLoadedChanged');

			/**
    * Fired when the pre-loaded state of the list has changed
    * 
    * @event preLoadedChanged
    */
		}
	}, {
		key: '_onEvent_currentSongChanged',
		value: function _onEvent_currentSongChanged(data) {
			this._data.current = data.current;
			this._resolveCurrentSong();
			this.emit('currentSongChanged');

			/**
    * Fired when the currently loaded song changes
    * 
    * @event currentSongChanged
    */
		}
	}, {
		key: '_onEvent_nameChanged',
		value: function _onEvent_nameChanged(data) {
			if (this._data) this._data.name = data ? data.name : null;
			this.emit('nameChanged');
			this.emit('changed');

			/**
    * Fired when the name of the currently loaded set list changes
    * 
    * @event nameChanged
    */
		}
	}, {
		key: 'items',
		get: function get() {
			return this._data ? this._data.items : null;
		}

		/**
   * The display name of the current set list (ie: its file name with path and extension removed)
   * @property name
   * @type {String} 
   */

	}, {
		key: 'name',
		get: function get() {
			return this._data ? this._data.name : null;
		}

		/**
   * Indicates if the set list is currently pre-loaded
   * @property preLoaded
   * @type {Boolean}
   */

	}, {
		key: 'preLoaded',
		get: function get() {
			return this._data ? this._data.preLoaded : false;
		}

		/**
   * The index of the currently loaded song (or -1 if the current song isn't in the set list)
   * @property currentSongIndex
   * @type {Number}
   */

	}, {
		key: 'currentSongIndex',
		get: function get() {
			return this._data.items.indexOf(this._currentSong);
		}

		/**
   * The currently loaded item (or null if the current song isn't in the set list)
   * @property currentSong
   * @type {SetListItem}
   */

	}, {
		key: 'currentSong',
		get: function get() {
			return this._currentSong;
		}
	}]);
	return SetList;
}(EndPoint);

module.exports = SetList;

},{"./EndPoint":6,"babel-runtime/helpers/classCallCheck":22,"babel-runtime/helpers/createClass":23,"babel-runtime/helpers/inherits":24,"babel-runtime/helpers/possibleConstructorReturn":25,"debug":120}],9:[function(require,module,exports){
'use strict';

var _classCallCheck2 = require('babel-runtime/helpers/classCallCheck');

var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

var _createClass2 = require('babel-runtime/helpers/createClass');

var _createClass3 = _interopRequireDefault(_createClass2);

var _possibleConstructorReturn2 = require('babel-runtime/helpers/possibleConstructorReturn');

var _possibleConstructorReturn3 = _interopRequireDefault(_possibleConstructorReturn2);

var _inherits2 = require('babel-runtime/helpers/inherits');

var _inherits3 = _interopRequireDefault(_inherits2);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var debug = require('debug')('Cantabile');
var EndPoint = require('./EndPoint');

/**
 * Used to access the current set of show notes
 * 
 * Access this object via the {{#crossLink "Cantabile/showNotes:property"}}{{/crossLink}} property.
 *
 * @class ShowNotes
 * @extends EndPoint
 */

var ShowNotes = function (_EndPoint) {
	(0, _inherits3.default)(ShowNotes, _EndPoint);

	function ShowNotes(owner) {
		(0, _classCallCheck3.default)(this, ShowNotes);
		return (0, _possibleConstructorReturn3.default)(this, (ShowNotes.__proto__ || Object.getPrototypeOf(ShowNotes)).call(this, owner, "/api/shownotes"));
	}

	(0, _createClass3.default)(ShowNotes, [{
		key: '_onOpen',
		value: function _onOpen() {
			this.emit('reload');
			this.emit('changed');
		}
	}, {
		key: '_onClose',
		value: function _onClose() {
			this.emit('reload');
			this.emit('changed');
		}

		/**
   * An array of show note items
   * @property items
   * @type {ShowNote[]}
   */

	}, {
		key: '_onEvent_itemAdded',
		value: function _onEvent_itemAdded(data) {
			this._data.items.splice(data.index, 0, data.item);
			this.emit('itemAdded', data.index);
			this.emit('changed');

			/**
    * Fired after a new show note has been added
    *
    * @event itemAdded
    * @param {Number} index The zero based index of the newly added item 
    */

			/**
    * Fired when anything about the current set of show notes changes
    *
    * @event changed
    */
		}
	}, {
		key: '_onEvent_itemRemoved',
		value: function _onEvent_itemRemoved(data) {
			this._data.items.splice(data.index, 1);
			this.emit('itemRemoved', data.index);
			this.emit('changed');

			/**
    * Fired after a show note has been removed
    *
    * @event itemRemoved
    * @param {Number} index The zero based index of the removed item 
    */
		}
	}, {
		key: '_onEvent_itemMoved',
		value: function _onEvent_itemMoved(data) {
			var item = this._data.items[data.from];
			this._data.items.splice(data.from, 1);
			this._data.items.splice(data.to, 0, item);
			this.emit('itemMoved', data.from, data.to);
			this.emit('changed');

			/**
    * Fired when an show note has been moved
    *
    * @event itemMoved
    * @param {Number} from The zero based index of the item before being moved
    * @param {Number} to The zero based index of the item's new position
    */
		}
	}, {
		key: '_onEvent_itemChanged',
		value: function _onEvent_itemChanged(data) {
			this._data.items.splice(data.index, 1, data.item); // Don't use [] so Vue can handle it

			this.emit('itemChanged', data.index);
			this.emit('changed');

			/**
    * Fired when something about an show note has changed
    *
    * @event itemChanged
    * @param {Number} index The zero based index of the item that changed
    */
		}
	}, {
		key: '_onEvent_itemsReload',
		value: function _onEvent_itemsReload(data) {
			this._data.items = data.items;
			this.emit('reload');
			this.emit('changed');

			/**
    * Fired when the entire set of show notes has changed (eg: after  loading a new song)
    * 
    * @event reload
    */
		}
	}, {
		key: 'items',
		get: function get() {
			return this._data ? this._data.items : null;
		}
	}]);
	return ShowNotes;
}(EndPoint);

module.exports = ShowNotes;

},{"./EndPoint":6,"babel-runtime/helpers/classCallCheck":22,"babel-runtime/helpers/createClass":23,"babel-runtime/helpers/inherits":24,"babel-runtime/helpers/possibleConstructorReturn":25,"debug":120}],10:[function(require,module,exports){
'use strict';

var _classCallCheck2 = require('babel-runtime/helpers/classCallCheck');

var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

var _createClass2 = require('babel-runtime/helpers/createClass');

var _createClass3 = _interopRequireDefault(_createClass2);

var _possibleConstructorReturn2 = require('babel-runtime/helpers/possibleConstructorReturn');

var _possibleConstructorReturn3 = _interopRequireDefault(_possibleConstructorReturn2);

var _inherits2 = require('babel-runtime/helpers/inherits');

var _inherits3 = _interopRequireDefault(_inherits2);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var EndPoint = require('./EndPoint');

/**
 * Interface to the current song
 * 
 * Access this object via the {{#crossLink "Cantabile/song:property"}}{{/crossLink}} property.
 *
 * @class Song
 * @extends EndPoint
 */

var SongStates = function (_EndPoint) {
	(0, _inherits3.default)(SongStates, _EndPoint);

	function SongStates(owner) {
		(0, _classCallCheck3.default)(this, SongStates);
		return (0, _possibleConstructorReturn3.default)(this, (SongStates.__proto__ || Object.getPrototypeOf(SongStates)).call(this, owner, "/api/song"));
	}

	(0, _createClass3.default)(SongStates, [{
		key: '_onOpen',
		value: function _onOpen() {
			/**
    * Fired when anything about the current song changes
    *
    * @event changed
    */
			this.emit('changed');

			/**
    * Fired when the name of the current song changes
    *
    * @event changed
    */
			this.emit('nameChanged');

			/**
    * Fired when the name of the current state changes
    *
    * @event changed
    */
			this.emit('currentStateChanged');
		}
	}, {
		key: '_onClose',
		value: function _onClose() {
			this.emit('changed');
			this.emit('nameChanged');
			this.emit('currentStateChanged');
		}

		/**
   * The name of the current song
   * @property name
   * @type {String}
   */

	}, {
		key: '_onEvent_songChanged',
		value: function _onEvent_songChanged(data) {
			this._data = data;
			this.emit('changed');
			this.emit('nameChanged');
			this.emit('currentStateChanged');
		}
	}, {
		key: '_onEvent_nameChanged',
		value: function _onEvent_nameChanged(data) {
			this._data.name = data.name;
			this.emit('changed');
			this.emit('nameChanged');
		}
	}, {
		key: '_onEvent_currentStateChanged',
		value: function _onEvent_currentStateChanged(data) {
			this._data.currentState = data.currentState;
			this.emit('changed');
			this.emit('currentStateChanged');
		}
	}, {
		key: 'name',
		get: function get() {
			return this._data ? this._data.name : null;
		}

		/**
   * The name of the current song state
   * @property currentState
   * @type {String}
   */

	}, {
		key: 'currentState',
		get: function get() {
			return this._data ? this._data.currentState : null;
		}
	}]);
	return SongStates;
}(EndPoint);

module.exports = SongStates;

},{"./EndPoint":6,"babel-runtime/helpers/classCallCheck":22,"babel-runtime/helpers/createClass":23,"babel-runtime/helpers/inherits":24,"babel-runtime/helpers/possibleConstructorReturn":25}],11:[function(require,module,exports){
'use strict';

var _classCallCheck2 = require('babel-runtime/helpers/classCallCheck');

var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

var _possibleConstructorReturn2 = require('babel-runtime/helpers/possibleConstructorReturn');

var _possibleConstructorReturn3 = _interopRequireDefault(_possibleConstructorReturn2);

var _inherits2 = require('babel-runtime/helpers/inherits');

var _inherits3 = _interopRequireDefault(_inherits2);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var States = require('./States');

/**
 * Interface to the states of the current song
 * 
 * Access this object via the {{#crossLink "Cantabile/songStates:property"}}{{/crossLink}} property.
 *
 * @class SongStates
 * @extends States
 */

var SongStates = function (_States) {
  (0, _inherits3.default)(SongStates, _States);

  function SongStates(owner) {
    (0, _classCallCheck3.default)(this, SongStates);
    return (0, _possibleConstructorReturn3.default)(this, (SongStates.__proto__ || Object.getPrototypeOf(SongStates)).call(this, owner, "/api/songStates"));
  }

  return SongStates;
}(States);

module.exports = SongStates;

},{"./States":12,"babel-runtime/helpers/classCallCheck":22,"babel-runtime/helpers/inherits":24,"babel-runtime/helpers/possibleConstructorReturn":25}],12:[function(require,module,exports){
'use strict';

var _classCallCheck2 = require('babel-runtime/helpers/classCallCheck');

var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

var _createClass2 = require('babel-runtime/helpers/createClass');

var _createClass3 = _interopRequireDefault(_createClass2);

var _possibleConstructorReturn2 = require('babel-runtime/helpers/possibleConstructorReturn');

var _possibleConstructorReturn3 = _interopRequireDefault(_possibleConstructorReturn2);

var _inherits2 = require('babel-runtime/helpers/inherits');

var _inherits3 = _interopRequireDefault(_inherits2);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var debug = require('debug')('Cantabile');
var EndPoint = require('./EndPoint');

/**
 * Base states functionality for State and racks
 * 
 * @class States
 * @extends EndPoint
 */

var States = function (_EndPoint) {
	(0, _inherits3.default)(States, _EndPoint);

	function States(owner, endPoint) {
		(0, _classCallCheck3.default)(this, States);

		var _this = (0, _possibleConstructorReturn3.default)(this, (States.__proto__ || Object.getPrototypeOf(States)).call(this, owner, endPoint));

		_this._currentState = null;
		return _this;
	}

	(0, _createClass3.default)(States, [{
		key: '_onOpen',
		value: function _onOpen() {
			this._resolveCurrentState();
			this.emit('reload');
			this.emit('changed');
		}
	}, {
		key: '_onClose',
		value: function _onClose() {
			this._resolveCurrentState();
			this.emit('reload');
			this.emit('changed');
		}

		/**
   * An array of states
   * @property items
   * @type {State[]}
   */

	}, {
		key: 'loadStateByIndex',


		/**
   * Load the State at a given index position
   * @method loadStateByIndex
   * @param {Number} index The zero based index of the State to load
   * @param {Boolean} [delayed=false] Whether to perform a delayed or immediate load
   */
		value: function loadStateByIndex(index, delayed) {
			this.post("/loadStateByIndex", {
				index: index,
				delayed: delayed
			});
		}

		/**
   * Load the State with a given program number
   * @method loadStateByProgram
   * @param {Number} index The zero based program number of the State to load
   * @param {Boolean} [delayed=false] Whether to perform a delayed or immediate load
   */

	}, {
		key: 'loadStateByProgram',
		value: function loadStateByProgram(pr, delayed) {
			this.post("/loadStateByProgram", {
				pr: pr,
				delayed: delayed
			});
		}

		/**
   * Load the first state
   * @method loadFirstState
   * @param {Boolean} [delayed=false] Whether to perform a delayed or immediate load
   */

	}, {
		key: 'loadFirstState',
		value: function loadFirstState(delayed) {
			this.post("/loadFirstState", {
				delayed: delayed
			});
		}

		/**
   * Load the last state
   * @method loadLastState
   * @param {Boolean} [delayed=false] Whether to perform a delayed or immediate load
   */

	}, {
		key: 'loadLastState',
		value: function loadLastState(delayed) {
			this.post("/loadLastState", {
				delayed: delayed
			});
		}

		/**
   * Load the next or previous state
   * @method loadNextState
   * @param {Number} direction Direction to move (1 = next, -1 = previous)
   * @param {Boolean} [delayed=false] Whether to perform a delayed or immediate load
   * @param {Boolean} [wrap=false] Whether to wrap around at the start/end
   */

	}, {
		key: 'loadNextState',
		value: function loadNextState(direction, delayed, wrap) {
			this.post("/loadNextState", {
				direction: direction,
				delayed: delayed,
				wrap: wrap
			});
		}
	}, {
		key: '_resolveCurrentState',
		value: function _resolveCurrentState() {
			// Check have data and current index is in range and record the current State
			if (this._data && this._data.current >= 0 && this._data.current < this._data.items.length) {
				this._currentState = this._data.items[this._data.current];
			} else {
				this._currentState = null;
			}
		}
	}, {
		key: '_onEvent_songChanged',
		value: function _onEvent_songChanged(data) {
			this._data = data;
			this._resolveCurrentState();
			this.emit('reload');
			this.emit('changed');
		}
	}, {
		key: '_onEvent_itemAdded',
		value: function _onEvent_itemAdded(data) {
			this._data.items.splice(data.index, 0, data.item);
			this.emit('itemAdded', data.index);
			this.emit('changed');

			/**
    * Fired after a new state has been added
    *
    * @event itemAdded
    * @param {Number} index The zero based index of the newly added item 
    */

			/**
    * Fired when anything about the contents of state list changes
    *
    * @event changed
    */
		}
	}, {
		key: '_onEvent_itemRemoved',
		value: function _onEvent_itemRemoved(data) {
			this._data.items.splice(data.index, 1);
			this.emit('itemRemoved', data.index);
			this.emit('changed');

			/**
    * Fired after a state has been removed
    *
    * @event itemRemoved
    * @param {Number} index The zero based index of the removed item 
    */
		}
	}, {
		key: '_onEvent_itemMoved',
		value: function _onEvent_itemMoved(data) {
			var item = this._data.items[data.from];
			this._data.items.splice(data.from, 1);
			this._data.items.splice(data.to, 0, item);
			this.emit('itemMoved', data.from, data.to);
			this.emit('changed');

			/**
    * Fired when an item has been moved
    *
    * @event itemMoved
    * @param {Number} from The zero based index of the item before being moved
    * @param {Number} to The zero based index of the item's new position
    */
		}
	}, {
		key: '_onEvent_itemChanged',
		value: function _onEvent_itemChanged(data) {
			if (this.currentStateIndex == data.index) this._currentState = data.item;

			this._data.items.splice(data.index, 1, data.item); // Don't use [] so Vue can handle it

			this.emit('itemChanged', data.index);
			this.emit('changed');

			/**
    * Fired when something about an state has changed
    *
    * @event itemChanged
    * @param {Number} index The zero based index of the item that changed
    */
		}
	}, {
		key: '_onEvent_itemsReload',
		value: function _onEvent_itemsReload(data) {
			this._data.items = data.items;
			this._data.current = data.current;
			this._resolveCurrentState();
			this.emit('reload');
			this.emit('changed');

			/**
    * Fired when the entire set of states has changed (eg: after a sort operation, or loading a new song/rack)
    * 
    * @event reload
    */
		}
	}, {
		key: '_onEvent_currentStateChanged',
		value: function _onEvent_currentStateChanged(data) {
			this._data.current = data.current;
			this._resolveCurrentState();
			this.emit('currentStateChanged');

			/**
    * Fired when the current state changes
    * 
    * @event currentStateChanged
    */
		}
	}, {
		key: '_onEvent_nameChanged',
		value: function _onEvent_nameChanged(data) {
			if (this._data) this._data.name = data ? data.name : null;
			this.emit('nameChanged');
			this.emit('changed');

			/**
    * Fired when the name of the containing song or rack changes
    * 
    * @event nameChanged
    */
		}
	}, {
		key: 'items',
		get: function get() {
			return this._data ? this._data.items : null;
		}

		/**
   * The display name of the containing song or rack
   * @property name
   * @type {String} 
   */

	}, {
		key: 'name',
		get: function get() {
			return this._data ? this._data.name : null;
		}

		/**
   * The index of the currently loaded State (or -1 if no active state)
   * @property currentStateIndex
   * @type {Number}
   */

	}, {
		key: 'currentStateIndex',
		get: function get() {
			return this._data.items.indexOf(this._currentState);
		}

		/**
   * The currently loaded item (or null if no active state)
   * @property currentState
   * @type {State}
   */

	}, {
		key: 'currentState',
		get: function get() {
			return this._currentState;
		}
	}]);
	return States;
}(EndPoint);

module.exports = States;

},{"./EndPoint":6,"babel-runtime/helpers/classCallCheck":22,"babel-runtime/helpers/createClass":23,"babel-runtime/helpers/inherits":24,"babel-runtime/helpers/possibleConstructorReturn":25,"debug":120}],13:[function(require,module,exports){
'use strict';

var _classCallCheck2 = require('babel-runtime/helpers/classCallCheck');

var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

var _createClass2 = require('babel-runtime/helpers/createClass');

var _createClass3 = _interopRequireDefault(_createClass2);

var _possibleConstructorReturn2 = require('babel-runtime/helpers/possibleConstructorReturn');

var _possibleConstructorReturn3 = _interopRequireDefault(_possibleConstructorReturn2);

var _inherits2 = require('babel-runtime/helpers/inherits');

var _inherits3 = _interopRequireDefault(_inherits2);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var EndPoint = require('./EndPoint');

/**
 * Interface to the master transport
 * 
 * Access this object via the {{#crossLink "Cantabile/transport:property"}}{{/crossLink}} property.
 *
 * @class Transport
 * @extends EndPoint
 */

var Transport = function (_EndPoint) {
    (0, _inherits3.default)(Transport, _EndPoint);

    function Transport(owner) {
        (0, _classCallCheck3.default)(this, Transport);
        return (0, _possibleConstructorReturn3.default)(this, (Transport.__proto__ || Object.getPrototypeOf(Transport)).call(this, owner, "/api/transport"));
    }

    (0, _createClass3.default)(Transport, [{
        key: '_onOpen',
        value: function _onOpen() {
            this.emit('stateChanged');
            this.emit('timeSignatureChanged');
            this.emit('tempoChanged');
        }
    }, {
        key: '_onClose',
        value: function _onClose() {
            this.emit('stateChanged');
            this.emit('timeSignatureChanged');
            this.emit('tempoChanged');
        }

        /**
         * Gets or sets the current transport state.  Supported values include "playing", "paused" or "stopped"
         * @property state
         * @type {String}
         */

    }, {
        key: '_onEvent_stateChanged',
        value: function _onEvent_stateChanged(data) {
            /**
             * Fired when the current transport state has changed
             *
             * @event stateChanged
             */

            this._data.state = data.state;
            this.emit('stateChanged');
        }
    }, {
        key: '_onEvent_timeSigChanged',
        value: function _onEvent_timeSigChanged(data) {
            /**
             * Fired when the current time signature has changed
             *
             * @event timeSignatureChanged
             */

            this._data.timeSigNum = data.timeSigNum;
            this._data.timeSigDen = data.timeSigDen;
            this.emit('timeSignatureChanged');
        }
    }, {
        key: '_onEvent_tempoChanged',
        value: function _onEvent_tempoChanged(data) {
            /**
            * Fired when the current tempo has changed
            *
            * @event tempoChanged
            */

            this._data.tempo = data.tempo;
            this.emit('tempoChanged');
        }

        /**
         * Starts transport playback
         * @method play
         */

    }, {
        key: 'play',
        value: function play() {
            if (this.state != "playing") this.post("/play", {});
        }

        /**
         * Toggles between play and pause states
         * @method togglePlayPause
         */

    }, {
        key: 'togglePlayPause',
        value: function togglePlayPause() {
            if (this.state == "playing") this.pause();else this.play();
        }

        /**
         * Toggles pause and play states (unless stopped)
         * @method togglePlayPause
         */

    }, {
        key: 'togglePause',
        value: function togglePause() {
            if (this.state == "paused") this.play();else if (this.state == "playing") this.pause();
        }

        /**
        * Toggles play and stopped states
        * @method togglePlay
        */

    }, {
        key: 'togglePlay',
        value: function togglePlay() {
            if (this.state == "stopped") this.play();else this.stop();
        }

        /**
         * Toggles between play and stop states
         * @method togglePlayStop
         */

    }, {
        key: 'togglePlayStop',
        value: function togglePlayStop() {
            if (this.state != "playing") this.play();else this.stop();
        }

        /**
         * Pauses the master transport
         * @method pause
         */

    }, {
        key: 'pause',
        value: function pause() {
            if (this.state != "paused") this.post("/pause", {});
        }

        /**
         * Stops the master transport
         * @method stop
         */

    }, {
        key: 'stop',
        value: function stop() {
            if (this.state != "stopped") this.post("/stop", {});
        }
    }, {
        key: 'state',
        get: function get() {
            return this._data ? this._data.state : "stopped";
        },
        set: function set(value) {
            if (this.state == value) return;
            switch (value) {
                case "playing":
                    this.play();break;
                case "paused":
                    this.pause();break;
                case "stopped":
                    this.stop();break;
            }
        }

        /**
         * Gets the current time signture numerator
         * @property timeSignatureNum
         * @type {Number}
         */

    }, {
        key: 'timeSignatureNum',
        get: function get() {
            return this._data ? this._data.timeSigNum : 0;
        }

        /**
         * Gets the current time signture denominator
         * @property timeSignatureDen
         * @type {Number}
         */

    }, {
        key: 'timeSignatureDen',
        get: function get() {
            return this._data ? this._data.timeSigDen : 0;
        }

        /**
         * Gets the current time signture as a string (eg: "3/4")
         * @property timeSignature
         * @type {String}
         */

    }, {
        key: 'timeSignature',
        get: function get() {
            return this._data ? this._data.timeSigNum + "/" + this._data.timeSigDen : "-";
        }

        /**
         * Gets the current tempo
         * @property tempo
         * @type {Number}
         */

    }, {
        key: 'tempo',
        get: function get() {
            return this._data ? this._data.tempo : 0;
        }
    }]);
    return Transport;
}(EndPoint);

module.exports = Transport;

},{"./EndPoint":6,"babel-runtime/helpers/classCallCheck":22,"babel-runtime/helpers/createClass":23,"babel-runtime/helpers/inherits":24,"babel-runtime/helpers/possibleConstructorReturn":25}],14:[function(require,module,exports){
'use strict';

var _regenerator = require('babel-runtime/regenerator');

var _regenerator2 = _interopRequireDefault(_regenerator);

var _asyncToGenerator2 = require('babel-runtime/helpers/asyncToGenerator');

var _asyncToGenerator3 = _interopRequireDefault(_asyncToGenerator2);

var _classCallCheck2 = require('babel-runtime/helpers/classCallCheck');

var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

var _createClass2 = require('babel-runtime/helpers/createClass');

var _createClass3 = _interopRequireDefault(_createClass2);

var _possibleConstructorReturn2 = require('babel-runtime/helpers/possibleConstructorReturn');

var _possibleConstructorReturn3 = _interopRequireDefault(_possibleConstructorReturn2);

var _inherits2 = require('babel-runtime/helpers/inherits');

var _inherits3 = _interopRequireDefault(_inherits2);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var debug = require('debug')('Cantabile');
var EndPoint = require('./EndPoint');
var EventEmitter = require('events');

/**
 * Represents a monitored pattern string.

 * Returned from the {{#crossLink "Variables/watch:method"}}{{/crossLink}} method.
 *
 * @class PatternWatcher
 * @extends EventEmitter
 */

var PatternWatcher = function (_EventEmitter) {
	(0, _inherits3.default)(PatternWatcher, _EventEmitter);

	function PatternWatcher(owner, pattern, listener) {
		(0, _classCallCheck3.default)(this, PatternWatcher);

		var _this = (0, _possibleConstructorReturn3.default)(this, (PatternWatcher.__proto__ || Object.getPrototypeOf(PatternWatcher)).call(this));

		_this.owner = owner;
		_this._pattern = pattern;
		_this._patternId = 0;
		_this._resolved = "";
		_this._listener = listener;
		return _this;
	}

	/**
  * Returns the pattern string being watched
  *
  * @property pattern
  * @type {String} 
  */


	(0, _createClass3.default)(PatternWatcher, [{
		key: '_start',
		value: function _start() {
			var _this2 = this;

			this.owner.post("/watch", {
				pattern: this._pattern
			}).then(function (r) {
				if (r.data.patternId) {
					_this2.owner._registerPatternId(r.data.patternId, _this2);
					_this2._patternId = r.data.patternId;
				}
				_this2._resolved = r.data.resolved;
				_this2._fireChanged();
			});
		}
	}, {
		key: '_stop',
		value: function _stop() {
			if (this.owner._epid && this._patternId) {
				this.owner.send("/unwatch", { patternId: this._patternId });
				this.owner._revokePatternId(this._patternId);
				this._patternId = 0;
				this.resolved = "";
				this._fireChanged();
			}
		}

		/**
   * Stops monitoring this pattern string for changes
   *
   * @method unwatch
   */

	}, {
		key: 'unwatch',
		value: function unwatch() {
			this._stop();
			this.owner._revokeWatcher(this);
		}
	}, {
		key: '_update',
		value: function _update(data) {
			this._resolved = data.resolved;
			this._fireChanged();
		}
	}, {
		key: '_fireChanged',
		value: function _fireChanged() {
			// Function listener?
			if (this._listener) this._listener(this.resolved, this);

			/**
    * Fired after a new show note has been added
    *
    * @event changed
    * @param {String} resolved The new display string
    * @param {PatternWatcher} source This object
    */
			this.emit('changed', this.resolved, this);
		}
	}, {
		key: 'pattern',
		get: function get() {
			return this._pattern;
		}

		/**
   * Returns the current resolved display string
   *
   * @property resolved
   * @type {String} 
   */

	}, {
		key: 'resolved',
		get: function get() {
			return this._resolved;
		}
	}]);
	return PatternWatcher;
}(EventEmitter);

/**
 * Provides access to Cantabile's internal variables by allowing a pattern string to be
 * expanded into a final display string.
 * 
 * Access this object via the {{#crossLink "Cantabile/variables:property"}}{{/crossLink}} property.
 *
 * @class Variables
 * @extends EndPoint
 */


var Variables = function (_EndPoint) {
	(0, _inherits3.default)(Variables, _EndPoint);

	function Variables(owner) {
		(0, _classCallCheck3.default)(this, Variables);

		var _this3 = (0, _possibleConstructorReturn3.default)(this, (Variables.__proto__ || Object.getPrototypeOf(Variables)).call(this, owner, "/api/variables"));

		_this3.watchers = [];
		_this3.patternIds = {};
		return _this3;
	}

	/**
  * Resolves a variable pattern string into a final display string
  * 
  * @example
  * 
  *     let C = new CantabileApi();
  *     console.log(await C.variables.resolve("Song: $(SongTitle)"));
  * 
  * @example
  * 
  *     let C = new CantabileApi();
  *     C.variables.resolve("Song: $(SongTitle)").then(r => console.log(r)));
  *
  * @method resolve
  * @returns {Promise|String} A promise to provide the resolved string
  */


	(0, _createClass3.default)(Variables, [{
		key: 'resolve',
		value: function () {
			var _ref = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee(pattern) {
				return _regenerator2.default.wrap(function _callee$(_context) {
					while (1) {
						switch (_context.prev = _context.next) {
							case 0:
								_context.next = 2;
								return this.owner.untilConnected();

							case 2:
								_context.next = 4;
								return this.post("/resolve", {
									pattern: pattern
								});

							case 4:
								return _context.abrupt('return', _context.sent.data.resolved);

							case 5:
							case 'end':
								return _context.stop();
						}
					}
				}, _callee, this);
			}));

			function resolve(_x) {
				return _ref.apply(this, arguments);
			}

			return resolve;
		}()
	}, {
		key: '_onOpen',
		value: function _onOpen() {
			for (var i = 0; i < this.watchers.length; i++) {
				this.watchers[i]._start();
			}
		}
	}, {
		key: '_onClose',
		value: function _onClose() {
			for (var i = 0; i < this.watchers.length; i++) {
				this.watchers[i]._stop();
			}
		}

		/**
   * Starts watching a pattern string for changes
   * 
   * @example
   * 
   * Using a callback function:
   * 
   *     let C = new CantabileApi();
   *     
   *     // Watch a string pattern using a callback function
   *     C.variables.watch("Song: $(SongTitle)", function(resolved) {
   *         console.log(resolved);
   *     })
   *     
   * 	   // The "variables" end point must be opened before callbacks will happen
   *     C.variables.open();
   * 
   * @example
   * 
   * Using the PatternWatcher class and events:
   * 
   *     let C = new CantabileApi();
   *     let watcher = C.variables.watch("Song: $(SongTitle)");
   *     watcher.on('changed', function(resolved) {
   *         console.log(resolved);
   *     });
   *     
   * 	   // The "variables" end point must be opened before callbacks will happen
   *     C.variables.open();
   *     
   *     /// later, stop listening
   *     watcher.unwatch();
   *
   * @method watch
   * @param {String} pattern The string pattern to watch
   * @param {Function} [callback] Optional callback function to be called when the resolved display string changes.
   * 
   * The callback function has the form function(resolved, source) where resolved is the resolved display string and source
   * is the PatternWatcher instance.
   * 
   * @returns {PatternWatcher}
   */

	}, {
		key: 'watch',
		value: function watch(pattern, listener) {
			var w = new PatternWatcher(this, pattern, listener);
			this.watchers.push(w);

			if (this.isOpen) w._start();
		}
	}, {
		key: '_registerPatternId',
		value: function _registerPatternId(patternId, watcher) {
			this.patternIds[patternId] = watcher;
		}
	}, {
		key: '_revokePatternId',
		value: function _revokePatternId(patternId) {
			delete this.patternIds[patternId];
		}
	}, {
		key: '_revokeWatcher',
		value: function _revokeWatcher(w) {
			this.watchers = this.watchers.filter(function (x) {
				return x != w;
			});
		}
	}, {
		key: '_onEvent_patternChanged',
		value: function _onEvent_patternChanged(data) {
			// Get the watcher
			var w = this.patternIds[data.patternId];
			if (w) {
				w._update(data);
			}
		}
	}]);
	return Variables;
}(EndPoint);

module.exports = Variables;

},{"./EndPoint":6,"babel-runtime/helpers/asyncToGenerator":21,"babel-runtime/helpers/classCallCheck":22,"babel-runtime/helpers/createClass":23,"babel-runtime/helpers/inherits":24,"babel-runtime/helpers/possibleConstructorReturn":25,"babel-runtime/regenerator":27,"debug":120,"events":1}],15:[function(require,module,exports){
module.exports = { "default": require("core-js/library/fn/object/create"), __esModule: true };
},{"core-js/library/fn/object/create":28}],16:[function(require,module,exports){
module.exports = { "default": require("core-js/library/fn/object/define-property"), __esModule: true };
},{"core-js/library/fn/object/define-property":29}],17:[function(require,module,exports){
module.exports = { "default": require("core-js/library/fn/object/set-prototype-of"), __esModule: true };
},{"core-js/library/fn/object/set-prototype-of":30}],18:[function(require,module,exports){
module.exports = { "default": require("core-js/library/fn/promise"), __esModule: true };
},{"core-js/library/fn/promise":31}],19:[function(require,module,exports){
module.exports = { "default": require("core-js/library/fn/symbol"), __esModule: true };
},{"core-js/library/fn/symbol":32}],20:[function(require,module,exports){
module.exports = { "default": require("core-js/library/fn/symbol/iterator"), __esModule: true };
},{"core-js/library/fn/symbol/iterator":33}],21:[function(require,module,exports){
"use strict";

exports.__esModule = true;

var _promise = require("../core-js/promise");

var _promise2 = _interopRequireDefault(_promise);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

exports.default = function (fn) {
  return function () {
    var gen = fn.apply(this, arguments);
    return new _promise2.default(function (resolve, reject) {
      function step(key, arg) {
        try {
          var info = gen[key](arg);
          var value = info.value;
        } catch (error) {
          reject(error);
          return;
        }

        if (info.done) {
          resolve(value);
        } else {
          return _promise2.default.resolve(value).then(function (value) {
            step("next", value);
          }, function (err) {
            step("throw", err);
          });
        }
      }

      return step("next");
    });
  };
};
},{"../core-js/promise":18}],22:[function(require,module,exports){
"use strict";

exports.__esModule = true;

exports.default = function (instance, Constructor) {
  if (!(instance instanceof Constructor)) {
    throw new TypeError("Cannot call a class as a function");
  }
};
},{}],23:[function(require,module,exports){
"use strict";

exports.__esModule = true;

var _defineProperty = require("../core-js/object/define-property");

var _defineProperty2 = _interopRequireDefault(_defineProperty);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

exports.default = function () {
  function defineProperties(target, props) {
    for (var i = 0; i < props.length; i++) {
      var descriptor = props[i];
      descriptor.enumerable = descriptor.enumerable || false;
      descriptor.configurable = true;
      if ("value" in descriptor) descriptor.writable = true;
      (0, _defineProperty2.default)(target, descriptor.key, descriptor);
    }
  }

  return function (Constructor, protoProps, staticProps) {
    if (protoProps) defineProperties(Constructor.prototype, protoProps);
    if (staticProps) defineProperties(Constructor, staticProps);
    return Constructor;
  };
}();
},{"../core-js/object/define-property":16}],24:[function(require,module,exports){
"use strict";

exports.__esModule = true;

var _setPrototypeOf = require("../core-js/object/set-prototype-of");

var _setPrototypeOf2 = _interopRequireDefault(_setPrototypeOf);

var _create = require("../core-js/object/create");

var _create2 = _interopRequireDefault(_create);

var _typeof2 = require("../helpers/typeof");

var _typeof3 = _interopRequireDefault(_typeof2);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

exports.default = function (subClass, superClass) {
  if (typeof superClass !== "function" && superClass !== null) {
    throw new TypeError("Super expression must either be null or a function, not " + (typeof superClass === "undefined" ? "undefined" : (0, _typeof3.default)(superClass)));
  }

  subClass.prototype = (0, _create2.default)(superClass && superClass.prototype, {
    constructor: {
      value: subClass,
      enumerable: false,
      writable: true,
      configurable: true
    }
  });
  if (superClass) _setPrototypeOf2.default ? (0, _setPrototypeOf2.default)(subClass, superClass) : subClass.__proto__ = superClass;
};
},{"../core-js/object/create":15,"../core-js/object/set-prototype-of":17,"../helpers/typeof":26}],25:[function(require,module,exports){
"use strict";

exports.__esModule = true;

var _typeof2 = require("../helpers/typeof");

var _typeof3 = _interopRequireDefault(_typeof2);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

exports.default = function (self, call) {
  if (!self) {
    throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
  }

  return call && ((typeof call === "undefined" ? "undefined" : (0, _typeof3.default)(call)) === "object" || typeof call === "function") ? call : self;
};
},{"../helpers/typeof":26}],26:[function(require,module,exports){
"use strict";

exports.__esModule = true;

var _iterator = require("../core-js/symbol/iterator");

var _iterator2 = _interopRequireDefault(_iterator);

var _symbol = require("../core-js/symbol");

var _symbol2 = _interopRequireDefault(_symbol);

var _typeof = typeof _symbol2.default === "function" && typeof _iterator2.default === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof _symbol2.default === "function" && obj.constructor === _symbol2.default && obj !== _symbol2.default.prototype ? "symbol" : typeof obj; };

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

exports.default = typeof _symbol2.default === "function" && _typeof(_iterator2.default) === "symbol" ? function (obj) {
  return typeof obj === "undefined" ? "undefined" : _typeof(obj);
} : function (obj) {
  return obj && typeof _symbol2.default === "function" && obj.constructor === _symbol2.default && obj !== _symbol2.default.prototype ? "symbol" : typeof obj === "undefined" ? "undefined" : _typeof(obj);
};
},{"../core-js/symbol":19,"../core-js/symbol/iterator":20}],27:[function(require,module,exports){
module.exports = require("regenerator-runtime");

},{"regenerator-runtime":124}],28:[function(require,module,exports){
require('../../modules/es6.object.create');
var $Object = require('../../modules/_core').Object;
module.exports = function create(P, D) {
  return $Object.create(P, D);
};

},{"../../modules/_core":41,"../../modules/es6.object.create":108}],29:[function(require,module,exports){
require('../../modules/es6.object.define-property');
var $Object = require('../../modules/_core').Object;
module.exports = function defineProperty(it, key, desc) {
  return $Object.defineProperty(it, key, desc);
};

},{"../../modules/_core":41,"../../modules/es6.object.define-property":109}],30:[function(require,module,exports){
require('../../modules/es6.object.set-prototype-of');
module.exports = require('../../modules/_core').Object.setPrototypeOf;

},{"../../modules/_core":41,"../../modules/es6.object.set-prototype-of":110}],31:[function(require,module,exports){
require('../modules/es6.object.to-string');
require('../modules/es6.string.iterator');
require('../modules/web.dom.iterable');
require('../modules/es6.promise');
require('../modules/es7.promise.finally');
require('../modules/es7.promise.try');
module.exports = require('../modules/_core').Promise;

},{"../modules/_core":41,"../modules/es6.object.to-string":111,"../modules/es6.promise":112,"../modules/es6.string.iterator":113,"../modules/es7.promise.finally":115,"../modules/es7.promise.try":116,"../modules/web.dom.iterable":119}],32:[function(require,module,exports){
require('../../modules/es6.symbol');
require('../../modules/es6.object.to-string');
require('../../modules/es7.symbol.async-iterator');
require('../../modules/es7.symbol.observable');
module.exports = require('../../modules/_core').Symbol;

},{"../../modules/_core":41,"../../modules/es6.object.to-string":111,"../../modules/es6.symbol":114,"../../modules/es7.symbol.async-iterator":117,"../../modules/es7.symbol.observable":118}],33:[function(require,module,exports){
require('../../modules/es6.string.iterator');
require('../../modules/web.dom.iterable');
module.exports = require('../../modules/_wks-ext').f('iterator');

},{"../../modules/_wks-ext":104,"../../modules/es6.string.iterator":113,"../../modules/web.dom.iterable":119}],34:[function(require,module,exports){
module.exports = function (it) {
  if (typeof it != 'function') throw TypeError(it + ' is not a function!');
  return it;
};

},{}],35:[function(require,module,exports){
module.exports = function () { /* empty */ };

},{}],36:[function(require,module,exports){
module.exports = function (it, Constructor, name, forbiddenField) {
  if (!(it instanceof Constructor) || (forbiddenField !== undefined && forbiddenField in it)) {
    throw TypeError(name + ': incorrect invocation!');
  } return it;
};

},{}],37:[function(require,module,exports){
var isObject = require('./_is-object');
module.exports = function (it) {
  if (!isObject(it)) throw TypeError(it + ' is not an object!');
  return it;
};

},{"./_is-object":60}],38:[function(require,module,exports){
// false -> Array#indexOf
// true  -> Array#includes
var toIObject = require('./_to-iobject');
var toLength = require('./_to-length');
var toAbsoluteIndex = require('./_to-absolute-index');
module.exports = function (IS_INCLUDES) {
  return function ($this, el, fromIndex) {
    var O = toIObject($this);
    var length = toLength(O.length);
    var index = toAbsoluteIndex(fromIndex, length);
    var value;
    // Array#includes uses SameValueZero equality algorithm
    // eslint-disable-next-line no-self-compare
    if (IS_INCLUDES && el != el) while (length > index) {
      value = O[index++];
      // eslint-disable-next-line no-self-compare
      if (value != value) return true;
    // Array#indexOf ignores holes, Array#includes - not
    } else for (;length > index; index++) if (IS_INCLUDES || index in O) {
      if (O[index] === el) return IS_INCLUDES || index || 0;
    } return !IS_INCLUDES && -1;
  };
};

},{"./_to-absolute-index":95,"./_to-iobject":97,"./_to-length":98}],39:[function(require,module,exports){
// getting tag from 19.1.3.6 Object.prototype.toString()
var cof = require('./_cof');
var TAG = require('./_wks')('toStringTag');
// ES3 wrong here
var ARG = cof(function () { return arguments; }()) == 'Arguments';

// fallback for IE11 Script Access Denied error
var tryGet = function (it, key) {
  try {
    return it[key];
  } catch (e) { /* empty */ }
};

module.exports = function (it) {
  var O, T, B;
  return it === undefined ? 'Undefined' : it === null ? 'Null'
    // @@toStringTag case
    : typeof (T = tryGet(O = Object(it), TAG)) == 'string' ? T
    // builtinTag case
    : ARG ? cof(O)
    // ES3 arguments fallback
    : (B = cof(O)) == 'Object' && typeof O.callee == 'function' ? 'Arguments' : B;
};

},{"./_cof":40,"./_wks":105}],40:[function(require,module,exports){
var toString = {}.toString;

module.exports = function (it) {
  return toString.call(it).slice(8, -1);
};

},{}],41:[function(require,module,exports){
var core = module.exports = { version: '2.5.7' };
if (typeof __e == 'number') __e = core; // eslint-disable-line no-undef

},{}],42:[function(require,module,exports){
// optional / simple context binding
var aFunction = require('./_a-function');
module.exports = function (fn, that, length) {
  aFunction(fn);
  if (that === undefined) return fn;
  switch (length) {
    case 1: return function (a) {
      return fn.call(that, a);
    };
    case 2: return function (a, b) {
      return fn.call(that, a, b);
    };
    case 3: return function (a, b, c) {
      return fn.call(that, a, b, c);
    };
  }
  return function (/* ...args */) {
    return fn.apply(that, arguments);
  };
};

},{"./_a-function":34}],43:[function(require,module,exports){
// 7.2.1 RequireObjectCoercible(argument)
module.exports = function (it) {
  if (it == undefined) throw TypeError("Can't call method on  " + it);
  return it;
};

},{}],44:[function(require,module,exports){
// Thank's IE8 for his funny defineProperty
module.exports = !require('./_fails')(function () {
  return Object.defineProperty({}, 'a', { get: function () { return 7; } }).a != 7;
});

},{"./_fails":49}],45:[function(require,module,exports){
var isObject = require('./_is-object');
var document = require('./_global').document;
// typeof document.createElement is 'object' in old IE
var is = isObject(document) && isObject(document.createElement);
module.exports = function (it) {
  return is ? document.createElement(it) : {};
};

},{"./_global":51,"./_is-object":60}],46:[function(require,module,exports){
// IE 8- don't enum bug keys
module.exports = (
  'constructor,hasOwnProperty,isPrototypeOf,propertyIsEnumerable,toLocaleString,toString,valueOf'
).split(',');

},{}],47:[function(require,module,exports){
// all enumerable object keys, includes symbols
var getKeys = require('./_object-keys');
var gOPS = require('./_object-gops');
var pIE = require('./_object-pie');
module.exports = function (it) {
  var result = getKeys(it);
  var getSymbols = gOPS.f;
  if (getSymbols) {
    var symbols = getSymbols(it);
    var isEnum = pIE.f;
    var i = 0;
    var key;
    while (symbols.length > i) if (isEnum.call(it, key = symbols[i++])) result.push(key);
  } return result;
};

},{"./_object-gops":77,"./_object-keys":80,"./_object-pie":81}],48:[function(require,module,exports){
var global = require('./_global');
var core = require('./_core');
var ctx = require('./_ctx');
var hide = require('./_hide');
var has = require('./_has');
var PROTOTYPE = 'prototype';

var $export = function (type, name, source) {
  var IS_FORCED = type & $export.F;
  var IS_GLOBAL = type & $export.G;
  var IS_STATIC = type & $export.S;
  var IS_PROTO = type & $export.P;
  var IS_BIND = type & $export.B;
  var IS_WRAP = type & $export.W;
  var exports = IS_GLOBAL ? core : core[name] || (core[name] = {});
  var expProto = exports[PROTOTYPE];
  var target = IS_GLOBAL ? global : IS_STATIC ? global[name] : (global[name] || {})[PROTOTYPE];
  var key, own, out;
  if (IS_GLOBAL) source = name;
  for (key in source) {
    // contains in native
    own = !IS_FORCED && target && target[key] !== undefined;
    if (own && has(exports, key)) continue;
    // export native or passed
    out = own ? target[key] : source[key];
    // prevent global pollution for namespaces
    exports[key] = IS_GLOBAL && typeof target[key] != 'function' ? source[key]
    // bind timers to global for call from export context
    : IS_BIND && own ? ctx(out, global)
    // wrap global constructors for prevent change them in library
    : IS_WRAP && target[key] == out ? (function (C) {
      var F = function (a, b, c) {
        if (this instanceof C) {
          switch (arguments.length) {
            case 0: return new C();
            case 1: return new C(a);
            case 2: return new C(a, b);
          } return new C(a, b, c);
        } return C.apply(this, arguments);
      };
      F[PROTOTYPE] = C[PROTOTYPE];
      return F;
    // make static versions for prototype methods
    })(out) : IS_PROTO && typeof out == 'function' ? ctx(Function.call, out) : out;
    // export proto methods to core.%CONSTRUCTOR%.methods.%NAME%
    if (IS_PROTO) {
      (exports.virtual || (exports.virtual = {}))[key] = out;
      // export proto methods to core.%CONSTRUCTOR%.prototype.%NAME%
      if (type & $export.R && expProto && !expProto[key]) hide(expProto, key, out);
    }
  }
};
// type bitmap
$export.F = 1;   // forced
$export.G = 2;   // global
$export.S = 4;   // static
$export.P = 8;   // proto
$export.B = 16;  // bind
$export.W = 32;  // wrap
$export.U = 64;  // safe
$export.R = 128; // real proto method for `library`
module.exports = $export;

},{"./_core":41,"./_ctx":42,"./_global":51,"./_has":52,"./_hide":53}],49:[function(require,module,exports){
module.exports = function (exec) {
  try {
    return !!exec();
  } catch (e) {
    return true;
  }
};

},{}],50:[function(require,module,exports){
var ctx = require('./_ctx');
var call = require('./_iter-call');
var isArrayIter = require('./_is-array-iter');
var anObject = require('./_an-object');
var toLength = require('./_to-length');
var getIterFn = require('./core.get-iterator-method');
var BREAK = {};
var RETURN = {};
var exports = module.exports = function (iterable, entries, fn, that, ITERATOR) {
  var iterFn = ITERATOR ? function () { return iterable; } : getIterFn(iterable);
  var f = ctx(fn, that, entries ? 2 : 1);
  var index = 0;
  var length, step, iterator, result;
  if (typeof iterFn != 'function') throw TypeError(iterable + ' is not iterable!');
  // fast case for arrays with default iterator
  if (isArrayIter(iterFn)) for (length = toLength(iterable.length); length > index; index++) {
    result = entries ? f(anObject(step = iterable[index])[0], step[1]) : f(iterable[index]);
    if (result === BREAK || result === RETURN) return result;
  } else for (iterator = iterFn.call(iterable); !(step = iterator.next()).done;) {
    result = call(iterator, f, step.value, entries);
    if (result === BREAK || result === RETURN) return result;
  }
};
exports.BREAK = BREAK;
exports.RETURN = RETURN;

},{"./_an-object":37,"./_ctx":42,"./_is-array-iter":58,"./_iter-call":61,"./_to-length":98,"./core.get-iterator-method":106}],51:[function(require,module,exports){
// https://github.com/zloirock/core-js/issues/86#issuecomment-115759028
var global = module.exports = typeof window != 'undefined' && window.Math == Math
  ? window : typeof self != 'undefined' && self.Math == Math ? self
  // eslint-disable-next-line no-new-func
  : Function('return this')();
if (typeof __g == 'number') __g = global; // eslint-disable-line no-undef

},{}],52:[function(require,module,exports){
var hasOwnProperty = {}.hasOwnProperty;
module.exports = function (it, key) {
  return hasOwnProperty.call(it, key);
};

},{}],53:[function(require,module,exports){
var dP = require('./_object-dp');
var createDesc = require('./_property-desc');
module.exports = require('./_descriptors') ? function (object, key, value) {
  return dP.f(object, key, createDesc(1, value));
} : function (object, key, value) {
  object[key] = value;
  return object;
};

},{"./_descriptors":44,"./_object-dp":72,"./_property-desc":84}],54:[function(require,module,exports){
var document = require('./_global').document;
module.exports = document && document.documentElement;

},{"./_global":51}],55:[function(require,module,exports){
module.exports = !require('./_descriptors') && !require('./_fails')(function () {
  return Object.defineProperty(require('./_dom-create')('div'), 'a', { get: function () { return 7; } }).a != 7;
});

},{"./_descriptors":44,"./_dom-create":45,"./_fails":49}],56:[function(require,module,exports){
// fast apply, http://jsperf.lnkit.com/fast-apply/5
module.exports = function (fn, args, that) {
  var un = that === undefined;
  switch (args.length) {
    case 0: return un ? fn()
                      : fn.call(that);
    case 1: return un ? fn(args[0])
                      : fn.call(that, args[0]);
    case 2: return un ? fn(args[0], args[1])
                      : fn.call(that, args[0], args[1]);
    case 3: return un ? fn(args[0], args[1], args[2])
                      : fn.call(that, args[0], args[1], args[2]);
    case 4: return un ? fn(args[0], args[1], args[2], args[3])
                      : fn.call(that, args[0], args[1], args[2], args[3]);
  } return fn.apply(that, args);
};

},{}],57:[function(require,module,exports){
// fallback for non-array-like ES3 and non-enumerable old V8 strings
var cof = require('./_cof');
// eslint-disable-next-line no-prototype-builtins
module.exports = Object('z').propertyIsEnumerable(0) ? Object : function (it) {
  return cof(it) == 'String' ? it.split('') : Object(it);
};

},{"./_cof":40}],58:[function(require,module,exports){
// check on default Array iterator
var Iterators = require('./_iterators');
var ITERATOR = require('./_wks')('iterator');
var ArrayProto = Array.prototype;

module.exports = function (it) {
  return it !== undefined && (Iterators.Array === it || ArrayProto[ITERATOR] === it);
};

},{"./_iterators":66,"./_wks":105}],59:[function(require,module,exports){
// 7.2.2 IsArray(argument)
var cof = require('./_cof');
module.exports = Array.isArray || function isArray(arg) {
  return cof(arg) == 'Array';
};

},{"./_cof":40}],60:[function(require,module,exports){
module.exports = function (it) {
  return typeof it === 'object' ? it !== null : typeof it === 'function';
};

},{}],61:[function(require,module,exports){
// call something on iterator step with safe closing on error
var anObject = require('./_an-object');
module.exports = function (iterator, fn, value, entries) {
  try {
    return entries ? fn(anObject(value)[0], value[1]) : fn(value);
  // 7.4.6 IteratorClose(iterator, completion)
  } catch (e) {
    var ret = iterator['return'];
    if (ret !== undefined) anObject(ret.call(iterator));
    throw e;
  }
};

},{"./_an-object":37}],62:[function(require,module,exports){
'use strict';
var create = require('./_object-create');
var descriptor = require('./_property-desc');
var setToStringTag = require('./_set-to-string-tag');
var IteratorPrototype = {};

// 25.1.2.1.1 %IteratorPrototype%[@@iterator]()
require('./_hide')(IteratorPrototype, require('./_wks')('iterator'), function () { return this; });

module.exports = function (Constructor, NAME, next) {
  Constructor.prototype = create(IteratorPrototype, { next: descriptor(1, next) });
  setToStringTag(Constructor, NAME + ' Iterator');
};

},{"./_hide":53,"./_object-create":71,"./_property-desc":84,"./_set-to-string-tag":89,"./_wks":105}],63:[function(require,module,exports){
'use strict';
var LIBRARY = require('./_library');
var $export = require('./_export');
var redefine = require('./_redefine');
var hide = require('./_hide');
var Iterators = require('./_iterators');
var $iterCreate = require('./_iter-create');
var setToStringTag = require('./_set-to-string-tag');
var getPrototypeOf = require('./_object-gpo');
var ITERATOR = require('./_wks')('iterator');
var BUGGY = !([].keys && 'next' in [].keys()); // Safari has buggy iterators w/o `next`
var FF_ITERATOR = '@@iterator';
var KEYS = 'keys';
var VALUES = 'values';

var returnThis = function () { return this; };

module.exports = function (Base, NAME, Constructor, next, DEFAULT, IS_SET, FORCED) {
  $iterCreate(Constructor, NAME, next);
  var getMethod = function (kind) {
    if (!BUGGY && kind in proto) return proto[kind];
    switch (kind) {
      case KEYS: return function keys() { return new Constructor(this, kind); };
      case VALUES: return function values() { return new Constructor(this, kind); };
    } return function entries() { return new Constructor(this, kind); };
  };
  var TAG = NAME + ' Iterator';
  var DEF_VALUES = DEFAULT == VALUES;
  var VALUES_BUG = false;
  var proto = Base.prototype;
  var $native = proto[ITERATOR] || proto[FF_ITERATOR] || DEFAULT && proto[DEFAULT];
  var $default = $native || getMethod(DEFAULT);
  var $entries = DEFAULT ? !DEF_VALUES ? $default : getMethod('entries') : undefined;
  var $anyNative = NAME == 'Array' ? proto.entries || $native : $native;
  var methods, key, IteratorPrototype;
  // Fix native
  if ($anyNative) {
    IteratorPrototype = getPrototypeOf($anyNative.call(new Base()));
    if (IteratorPrototype !== Object.prototype && IteratorPrototype.next) {
      // Set @@toStringTag to native iterators
      setToStringTag(IteratorPrototype, TAG, true);
      // fix for some old engines
      if (!LIBRARY && typeof IteratorPrototype[ITERATOR] != 'function') hide(IteratorPrototype, ITERATOR, returnThis);
    }
  }
  // fix Array#{values, @@iterator}.name in V8 / FF
  if (DEF_VALUES && $native && $native.name !== VALUES) {
    VALUES_BUG = true;
    $default = function values() { return $native.call(this); };
  }
  // Define iterator
  if ((!LIBRARY || FORCED) && (BUGGY || VALUES_BUG || !proto[ITERATOR])) {
    hide(proto, ITERATOR, $default);
  }
  // Plug for library
  Iterators[NAME] = $default;
  Iterators[TAG] = returnThis;
  if (DEFAULT) {
    methods = {
      values: DEF_VALUES ? $default : getMethod(VALUES),
      keys: IS_SET ? $default : getMethod(KEYS),
      entries: $entries
    };
    if (FORCED) for (key in methods) {
      if (!(key in proto)) redefine(proto, key, methods[key]);
    } else $export($export.P + $export.F * (BUGGY || VALUES_BUG), NAME, methods);
  }
  return methods;
};

},{"./_export":48,"./_hide":53,"./_iter-create":62,"./_iterators":66,"./_library":67,"./_object-gpo":78,"./_redefine":86,"./_set-to-string-tag":89,"./_wks":105}],64:[function(require,module,exports){
var ITERATOR = require('./_wks')('iterator');
var SAFE_CLOSING = false;

try {
  var riter = [7][ITERATOR]();
  riter['return'] = function () { SAFE_CLOSING = true; };
  // eslint-disable-next-line no-throw-literal
  Array.from(riter, function () { throw 2; });
} catch (e) { /* empty */ }

module.exports = function (exec, skipClosing) {
  if (!skipClosing && !SAFE_CLOSING) return false;
  var safe = false;
  try {
    var arr = [7];
    var iter = arr[ITERATOR]();
    iter.next = function () { return { done: safe = true }; };
    arr[ITERATOR] = function () { return iter; };
    exec(arr);
  } catch (e) { /* empty */ }
  return safe;
};

},{"./_wks":105}],65:[function(require,module,exports){
module.exports = function (done, value) {
  return { value: value, done: !!done };
};

},{}],66:[function(require,module,exports){
module.exports = {};

},{}],67:[function(require,module,exports){
module.exports = true;

},{}],68:[function(require,module,exports){
var META = require('./_uid')('meta');
var isObject = require('./_is-object');
var has = require('./_has');
var setDesc = require('./_object-dp').f;
var id = 0;
var isExtensible = Object.isExtensible || function () {
  return true;
};
var FREEZE = !require('./_fails')(function () {
  return isExtensible(Object.preventExtensions({}));
});
var setMeta = function (it) {
  setDesc(it, META, { value: {
    i: 'O' + ++id, // object ID
    w: {}          // weak collections IDs
  } });
};
var fastKey = function (it, create) {
  // return primitive with prefix
  if (!isObject(it)) return typeof it == 'symbol' ? it : (typeof it == 'string' ? 'S' : 'P') + it;
  if (!has(it, META)) {
    // can't set metadata to uncaught frozen object
    if (!isExtensible(it)) return 'F';
    // not necessary to add metadata
    if (!create) return 'E';
    // add missing metadata
    setMeta(it);
  // return object ID
  } return it[META].i;
};
var getWeak = function (it, create) {
  if (!has(it, META)) {
    // can't set metadata to uncaught frozen object
    if (!isExtensible(it)) return true;
    // not necessary to add metadata
    if (!create) return false;
    // add missing metadata
    setMeta(it);
  // return hash weak collections IDs
  } return it[META].w;
};
// add metadata on freeze-family methods calling
var onFreeze = function (it) {
  if (FREEZE && meta.NEED && isExtensible(it) && !has(it, META)) setMeta(it);
  return it;
};
var meta = module.exports = {
  KEY: META,
  NEED: false,
  fastKey: fastKey,
  getWeak: getWeak,
  onFreeze: onFreeze
};

},{"./_fails":49,"./_has":52,"./_is-object":60,"./_object-dp":72,"./_uid":101}],69:[function(require,module,exports){
var global = require('./_global');
var macrotask = require('./_task').set;
var Observer = global.MutationObserver || global.WebKitMutationObserver;
var process = global.process;
var Promise = global.Promise;
var isNode = require('./_cof')(process) == 'process';

module.exports = function () {
  var head, last, notify;

  var flush = function () {
    var parent, fn;
    if (isNode && (parent = process.domain)) parent.exit();
    while (head) {
      fn = head.fn;
      head = head.next;
      try {
        fn();
      } catch (e) {
        if (head) notify();
        else last = undefined;
        throw e;
      }
    } last = undefined;
    if (parent) parent.enter();
  };

  // Node.js
  if (isNode) {
    notify = function () {
      process.nextTick(flush);
    };
  // browsers with MutationObserver, except iOS Safari - https://github.com/zloirock/core-js/issues/339
  } else if (Observer && !(global.navigator && global.navigator.standalone)) {
    var toggle = true;
    var node = document.createTextNode('');
    new Observer(flush).observe(node, { characterData: true }); // eslint-disable-line no-new
    notify = function () {
      node.data = toggle = !toggle;
    };
  // environments with maybe non-completely correct, but existent Promise
  } else if (Promise && Promise.resolve) {
    // Promise.resolve without an argument throws an error in LG WebOS 2
    var promise = Promise.resolve(undefined);
    notify = function () {
      promise.then(flush);
    };
  // for other environments - macrotask based on:
  // - setImmediate
  // - MessageChannel
  // - window.postMessag
  // - onreadystatechange
  // - setTimeout
  } else {
    notify = function () {
      // strange IE + webpack dev server bug - use .call(global)
      macrotask.call(global, flush);
    };
  }

  return function (fn) {
    var task = { fn: fn, next: undefined };
    if (last) last.next = task;
    if (!head) {
      head = task;
      notify();
    } last = task;
  };
};

},{"./_cof":40,"./_global":51,"./_task":94}],70:[function(require,module,exports){
'use strict';
// 25.4.1.5 NewPromiseCapability(C)
var aFunction = require('./_a-function');

function PromiseCapability(C) {
  var resolve, reject;
  this.promise = new C(function ($$resolve, $$reject) {
    if (resolve !== undefined || reject !== undefined) throw TypeError('Bad Promise constructor');
    resolve = $$resolve;
    reject = $$reject;
  });
  this.resolve = aFunction(resolve);
  this.reject = aFunction(reject);
}

module.exports.f = function (C) {
  return new PromiseCapability(C);
};

},{"./_a-function":34}],71:[function(require,module,exports){
// 19.1.2.2 / 15.2.3.5 Object.create(O [, Properties])
var anObject = require('./_an-object');
var dPs = require('./_object-dps');
var enumBugKeys = require('./_enum-bug-keys');
var IE_PROTO = require('./_shared-key')('IE_PROTO');
var Empty = function () { /* empty */ };
var PROTOTYPE = 'prototype';

// Create object with fake `null` prototype: use iframe Object with cleared prototype
var createDict = function () {
  // Thrash, waste and sodomy: IE GC bug
  var iframe = require('./_dom-create')('iframe');
  var i = enumBugKeys.length;
  var lt = '<';
  var gt = '>';
  var iframeDocument;
  iframe.style.display = 'none';
  require('./_html').appendChild(iframe);
  iframe.src = 'javascript:'; // eslint-disable-line no-script-url
  // createDict = iframe.contentWindow.Object;
  // html.removeChild(iframe);
  iframeDocument = iframe.contentWindow.document;
  iframeDocument.open();
  iframeDocument.write(lt + 'script' + gt + 'document.F=Object' + lt + '/script' + gt);
  iframeDocument.close();
  createDict = iframeDocument.F;
  while (i--) delete createDict[PROTOTYPE][enumBugKeys[i]];
  return createDict();
};

module.exports = Object.create || function create(O, Properties) {
  var result;
  if (O !== null) {
    Empty[PROTOTYPE] = anObject(O);
    result = new Empty();
    Empty[PROTOTYPE] = null;
    // add "__proto__" for Object.getPrototypeOf polyfill
    result[IE_PROTO] = O;
  } else result = createDict();
  return Properties === undefined ? result : dPs(result, Properties);
};

},{"./_an-object":37,"./_dom-create":45,"./_enum-bug-keys":46,"./_html":54,"./_object-dps":73,"./_shared-key":90}],72:[function(require,module,exports){
var anObject = require('./_an-object');
var IE8_DOM_DEFINE = require('./_ie8-dom-define');
var toPrimitive = require('./_to-primitive');
var dP = Object.defineProperty;

exports.f = require('./_descriptors') ? Object.defineProperty : function defineProperty(O, P, Attributes) {
  anObject(O);
  P = toPrimitive(P, true);
  anObject(Attributes);
  if (IE8_DOM_DEFINE) try {
    return dP(O, P, Attributes);
  } catch (e) { /* empty */ }
  if ('get' in Attributes || 'set' in Attributes) throw TypeError('Accessors not supported!');
  if ('value' in Attributes) O[P] = Attributes.value;
  return O;
};

},{"./_an-object":37,"./_descriptors":44,"./_ie8-dom-define":55,"./_to-primitive":100}],73:[function(require,module,exports){
var dP = require('./_object-dp');
var anObject = require('./_an-object');
var getKeys = require('./_object-keys');

module.exports = require('./_descriptors') ? Object.defineProperties : function defineProperties(O, Properties) {
  anObject(O);
  var keys = getKeys(Properties);
  var length = keys.length;
  var i = 0;
  var P;
  while (length > i) dP.f(O, P = keys[i++], Properties[P]);
  return O;
};

},{"./_an-object":37,"./_descriptors":44,"./_object-dp":72,"./_object-keys":80}],74:[function(require,module,exports){
var pIE = require('./_object-pie');
var createDesc = require('./_property-desc');
var toIObject = require('./_to-iobject');
var toPrimitive = require('./_to-primitive');
var has = require('./_has');
var IE8_DOM_DEFINE = require('./_ie8-dom-define');
var gOPD = Object.getOwnPropertyDescriptor;

exports.f = require('./_descriptors') ? gOPD : function getOwnPropertyDescriptor(O, P) {
  O = toIObject(O);
  P = toPrimitive(P, true);
  if (IE8_DOM_DEFINE) try {
    return gOPD(O, P);
  } catch (e) { /* empty */ }
  if (has(O, P)) return createDesc(!pIE.f.call(O, P), O[P]);
};

},{"./_descriptors":44,"./_has":52,"./_ie8-dom-define":55,"./_object-pie":81,"./_property-desc":84,"./_to-iobject":97,"./_to-primitive":100}],75:[function(require,module,exports){
// fallback for IE11 buggy Object.getOwnPropertyNames with iframe and window
var toIObject = require('./_to-iobject');
var gOPN = require('./_object-gopn').f;
var toString = {}.toString;

var windowNames = typeof window == 'object' && window && Object.getOwnPropertyNames
  ? Object.getOwnPropertyNames(window) : [];

var getWindowNames = function (it) {
  try {
    return gOPN(it);
  } catch (e) {
    return windowNames.slice();
  }
};

module.exports.f = function getOwnPropertyNames(it) {
  return windowNames && toString.call(it) == '[object Window]' ? getWindowNames(it) : gOPN(toIObject(it));
};

},{"./_object-gopn":76,"./_to-iobject":97}],76:[function(require,module,exports){
// 19.1.2.7 / 15.2.3.4 Object.getOwnPropertyNames(O)
var $keys = require('./_object-keys-internal');
var hiddenKeys = require('./_enum-bug-keys').concat('length', 'prototype');

exports.f = Object.getOwnPropertyNames || function getOwnPropertyNames(O) {
  return $keys(O, hiddenKeys);
};

},{"./_enum-bug-keys":46,"./_object-keys-internal":79}],77:[function(require,module,exports){
exports.f = Object.getOwnPropertySymbols;

},{}],78:[function(require,module,exports){
// 19.1.2.9 / 15.2.3.2 Object.getPrototypeOf(O)
var has = require('./_has');
var toObject = require('./_to-object');
var IE_PROTO = require('./_shared-key')('IE_PROTO');
var ObjectProto = Object.prototype;

module.exports = Object.getPrototypeOf || function (O) {
  O = toObject(O);
  if (has(O, IE_PROTO)) return O[IE_PROTO];
  if (typeof O.constructor == 'function' && O instanceof O.constructor) {
    return O.constructor.prototype;
  } return O instanceof Object ? ObjectProto : null;
};

},{"./_has":52,"./_shared-key":90,"./_to-object":99}],79:[function(require,module,exports){
var has = require('./_has');
var toIObject = require('./_to-iobject');
var arrayIndexOf = require('./_array-includes')(false);
var IE_PROTO = require('./_shared-key')('IE_PROTO');

module.exports = function (object, names) {
  var O = toIObject(object);
  var i = 0;
  var result = [];
  var key;
  for (key in O) if (key != IE_PROTO) has(O, key) && result.push(key);
  // Don't enum bug & hidden keys
  while (names.length > i) if (has(O, key = names[i++])) {
    ~arrayIndexOf(result, key) || result.push(key);
  }
  return result;
};

},{"./_array-includes":38,"./_has":52,"./_shared-key":90,"./_to-iobject":97}],80:[function(require,module,exports){
// 19.1.2.14 / 15.2.3.14 Object.keys(O)
var $keys = require('./_object-keys-internal');
var enumBugKeys = require('./_enum-bug-keys');

module.exports = Object.keys || function keys(O) {
  return $keys(O, enumBugKeys);
};

},{"./_enum-bug-keys":46,"./_object-keys-internal":79}],81:[function(require,module,exports){
exports.f = {}.propertyIsEnumerable;

},{}],82:[function(require,module,exports){
module.exports = function (exec) {
  try {
    return { e: false, v: exec() };
  } catch (e) {
    return { e: true, v: e };
  }
};

},{}],83:[function(require,module,exports){
var anObject = require('./_an-object');
var isObject = require('./_is-object');
var newPromiseCapability = require('./_new-promise-capability');

module.exports = function (C, x) {
  anObject(C);
  if (isObject(x) && x.constructor === C) return x;
  var promiseCapability = newPromiseCapability.f(C);
  var resolve = promiseCapability.resolve;
  resolve(x);
  return promiseCapability.promise;
};

},{"./_an-object":37,"./_is-object":60,"./_new-promise-capability":70}],84:[function(require,module,exports){
module.exports = function (bitmap, value) {
  return {
    enumerable: !(bitmap & 1),
    configurable: !(bitmap & 2),
    writable: !(bitmap & 4),
    value: value
  };
};

},{}],85:[function(require,module,exports){
var hide = require('./_hide');
module.exports = function (target, src, safe) {
  for (var key in src) {
    if (safe && target[key]) target[key] = src[key];
    else hide(target, key, src[key]);
  } return target;
};

},{"./_hide":53}],86:[function(require,module,exports){
module.exports = require('./_hide');

},{"./_hide":53}],87:[function(require,module,exports){
// Works with __proto__ only. Old v8 can't work with null proto objects.
/* eslint-disable no-proto */
var isObject = require('./_is-object');
var anObject = require('./_an-object');
var check = function (O, proto) {
  anObject(O);
  if (!isObject(proto) && proto !== null) throw TypeError(proto + ": can't set as prototype!");
};
module.exports = {
  set: Object.setPrototypeOf || ('__proto__' in {} ? // eslint-disable-line
    function (test, buggy, set) {
      try {
        set = require('./_ctx')(Function.call, require('./_object-gopd').f(Object.prototype, '__proto__').set, 2);
        set(test, []);
        buggy = !(test instanceof Array);
      } catch (e) { buggy = true; }
      return function setPrototypeOf(O, proto) {
        check(O, proto);
        if (buggy) O.__proto__ = proto;
        else set(O, proto);
        return O;
      };
    }({}, false) : undefined),
  check: check
};

},{"./_an-object":37,"./_ctx":42,"./_is-object":60,"./_object-gopd":74}],88:[function(require,module,exports){
'use strict';
var global = require('./_global');
var core = require('./_core');
var dP = require('./_object-dp');
var DESCRIPTORS = require('./_descriptors');
var SPECIES = require('./_wks')('species');

module.exports = function (KEY) {
  var C = typeof core[KEY] == 'function' ? core[KEY] : global[KEY];
  if (DESCRIPTORS && C && !C[SPECIES]) dP.f(C, SPECIES, {
    configurable: true,
    get: function () { return this; }
  });
};

},{"./_core":41,"./_descriptors":44,"./_global":51,"./_object-dp":72,"./_wks":105}],89:[function(require,module,exports){
var def = require('./_object-dp').f;
var has = require('./_has');
var TAG = require('./_wks')('toStringTag');

module.exports = function (it, tag, stat) {
  if (it && !has(it = stat ? it : it.prototype, TAG)) def(it, TAG, { configurable: true, value: tag });
};

},{"./_has":52,"./_object-dp":72,"./_wks":105}],90:[function(require,module,exports){
var shared = require('./_shared')('keys');
var uid = require('./_uid');
module.exports = function (key) {
  return shared[key] || (shared[key] = uid(key));
};

},{"./_shared":91,"./_uid":101}],91:[function(require,module,exports){
var core = require('./_core');
var global = require('./_global');
var SHARED = '__core-js_shared__';
var store = global[SHARED] || (global[SHARED] = {});

(module.exports = function (key, value) {
  return store[key] || (store[key] = value !== undefined ? value : {});
})('versions', []).push({
  version: core.version,
  mode: require('./_library') ? 'pure' : 'global',
  copyright: '© 2018 Denis Pushkarev (zloirock.ru)'
});

},{"./_core":41,"./_global":51,"./_library":67}],92:[function(require,module,exports){
// 7.3.20 SpeciesConstructor(O, defaultConstructor)
var anObject = require('./_an-object');
var aFunction = require('./_a-function');
var SPECIES = require('./_wks')('species');
module.exports = function (O, D) {
  var C = anObject(O).constructor;
  var S;
  return C === undefined || (S = anObject(C)[SPECIES]) == undefined ? D : aFunction(S);
};

},{"./_a-function":34,"./_an-object":37,"./_wks":105}],93:[function(require,module,exports){
var toInteger = require('./_to-integer');
var defined = require('./_defined');
// true  -> String#at
// false -> String#codePointAt
module.exports = function (TO_STRING) {
  return function (that, pos) {
    var s = String(defined(that));
    var i = toInteger(pos);
    var l = s.length;
    var a, b;
    if (i < 0 || i >= l) return TO_STRING ? '' : undefined;
    a = s.charCodeAt(i);
    return a < 0xd800 || a > 0xdbff || i + 1 === l || (b = s.charCodeAt(i + 1)) < 0xdc00 || b > 0xdfff
      ? TO_STRING ? s.charAt(i) : a
      : TO_STRING ? s.slice(i, i + 2) : (a - 0xd800 << 10) + (b - 0xdc00) + 0x10000;
  };
};

},{"./_defined":43,"./_to-integer":96}],94:[function(require,module,exports){
var ctx = require('./_ctx');
var invoke = require('./_invoke');
var html = require('./_html');
var cel = require('./_dom-create');
var global = require('./_global');
var process = global.process;
var setTask = global.setImmediate;
var clearTask = global.clearImmediate;
var MessageChannel = global.MessageChannel;
var Dispatch = global.Dispatch;
var counter = 0;
var queue = {};
var ONREADYSTATECHANGE = 'onreadystatechange';
var defer, channel, port;
var run = function () {
  var id = +this;
  // eslint-disable-next-line no-prototype-builtins
  if (queue.hasOwnProperty(id)) {
    var fn = queue[id];
    delete queue[id];
    fn();
  }
};
var listener = function (event) {
  run.call(event.data);
};
// Node.js 0.9+ & IE10+ has setImmediate, otherwise:
if (!setTask || !clearTask) {
  setTask = function setImmediate(fn) {
    var args = [];
    var i = 1;
    while (arguments.length > i) args.push(arguments[i++]);
    queue[++counter] = function () {
      // eslint-disable-next-line no-new-func
      invoke(typeof fn == 'function' ? fn : Function(fn), args);
    };
    defer(counter);
    return counter;
  };
  clearTask = function clearImmediate(id) {
    delete queue[id];
  };
  // Node.js 0.8-
  if (require('./_cof')(process) == 'process') {
    defer = function (id) {
      process.nextTick(ctx(run, id, 1));
    };
  // Sphere (JS game engine) Dispatch API
  } else if (Dispatch && Dispatch.now) {
    defer = function (id) {
      Dispatch.now(ctx(run, id, 1));
    };
  // Browsers with MessageChannel, includes WebWorkers
  } else if (MessageChannel) {
    channel = new MessageChannel();
    port = channel.port2;
    channel.port1.onmessage = listener;
    defer = ctx(port.postMessage, port, 1);
  // Browsers with postMessage, skip WebWorkers
  // IE8 has postMessage, but it's sync & typeof its postMessage is 'object'
  } else if (global.addEventListener && typeof postMessage == 'function' && !global.importScripts) {
    defer = function (id) {
      global.postMessage(id + '', '*');
    };
    global.addEventListener('message', listener, false);
  // IE8-
  } else if (ONREADYSTATECHANGE in cel('script')) {
    defer = function (id) {
      html.appendChild(cel('script'))[ONREADYSTATECHANGE] = function () {
        html.removeChild(this);
        run.call(id);
      };
    };
  // Rest old browsers
  } else {
    defer = function (id) {
      setTimeout(ctx(run, id, 1), 0);
    };
  }
}
module.exports = {
  set: setTask,
  clear: clearTask
};

},{"./_cof":40,"./_ctx":42,"./_dom-create":45,"./_global":51,"./_html":54,"./_invoke":56}],95:[function(require,module,exports){
var toInteger = require('./_to-integer');
var max = Math.max;
var min = Math.min;
module.exports = function (index, length) {
  index = toInteger(index);
  return index < 0 ? max(index + length, 0) : min(index, length);
};

},{"./_to-integer":96}],96:[function(require,module,exports){
// 7.1.4 ToInteger
var ceil = Math.ceil;
var floor = Math.floor;
module.exports = function (it) {
  return isNaN(it = +it) ? 0 : (it > 0 ? floor : ceil)(it);
};

},{}],97:[function(require,module,exports){
// to indexed object, toObject with fallback for non-array-like ES3 strings
var IObject = require('./_iobject');
var defined = require('./_defined');
module.exports = function (it) {
  return IObject(defined(it));
};

},{"./_defined":43,"./_iobject":57}],98:[function(require,module,exports){
// 7.1.15 ToLength
var toInteger = require('./_to-integer');
var min = Math.min;
module.exports = function (it) {
  return it > 0 ? min(toInteger(it), 0x1fffffffffffff) : 0; // pow(2, 53) - 1 == 9007199254740991
};

},{"./_to-integer":96}],99:[function(require,module,exports){
// 7.1.13 ToObject(argument)
var defined = require('./_defined');
module.exports = function (it) {
  return Object(defined(it));
};

},{"./_defined":43}],100:[function(require,module,exports){
// 7.1.1 ToPrimitive(input [, PreferredType])
var isObject = require('./_is-object');
// instead of the ES6 spec version, we didn't implement @@toPrimitive case
// and the second argument - flag - preferred type is a string
module.exports = function (it, S) {
  if (!isObject(it)) return it;
  var fn, val;
  if (S && typeof (fn = it.toString) == 'function' && !isObject(val = fn.call(it))) return val;
  if (typeof (fn = it.valueOf) == 'function' && !isObject(val = fn.call(it))) return val;
  if (!S && typeof (fn = it.toString) == 'function' && !isObject(val = fn.call(it))) return val;
  throw TypeError("Can't convert object to primitive value");
};

},{"./_is-object":60}],101:[function(require,module,exports){
var id = 0;
var px = Math.random();
module.exports = function (key) {
  return 'Symbol('.concat(key === undefined ? '' : key, ')_', (++id + px).toString(36));
};

},{}],102:[function(require,module,exports){
var global = require('./_global');
var navigator = global.navigator;

module.exports = navigator && navigator.userAgent || '';

},{"./_global":51}],103:[function(require,module,exports){
var global = require('./_global');
var core = require('./_core');
var LIBRARY = require('./_library');
var wksExt = require('./_wks-ext');
var defineProperty = require('./_object-dp').f;
module.exports = function (name) {
  var $Symbol = core.Symbol || (core.Symbol = LIBRARY ? {} : global.Symbol || {});
  if (name.charAt(0) != '_' && !(name in $Symbol)) defineProperty($Symbol, name, { value: wksExt.f(name) });
};

},{"./_core":41,"./_global":51,"./_library":67,"./_object-dp":72,"./_wks-ext":104}],104:[function(require,module,exports){
exports.f = require('./_wks');

},{"./_wks":105}],105:[function(require,module,exports){
var store = require('./_shared')('wks');
var uid = require('./_uid');
var Symbol = require('./_global').Symbol;
var USE_SYMBOL = typeof Symbol == 'function';

var $exports = module.exports = function (name) {
  return store[name] || (store[name] =
    USE_SYMBOL && Symbol[name] || (USE_SYMBOL ? Symbol : uid)('Symbol.' + name));
};

$exports.store = store;

},{"./_global":51,"./_shared":91,"./_uid":101}],106:[function(require,module,exports){
var classof = require('./_classof');
var ITERATOR = require('./_wks')('iterator');
var Iterators = require('./_iterators');
module.exports = require('./_core').getIteratorMethod = function (it) {
  if (it != undefined) return it[ITERATOR]
    || it['@@iterator']
    || Iterators[classof(it)];
};

},{"./_classof":39,"./_core":41,"./_iterators":66,"./_wks":105}],107:[function(require,module,exports){
'use strict';
var addToUnscopables = require('./_add-to-unscopables');
var step = require('./_iter-step');
var Iterators = require('./_iterators');
var toIObject = require('./_to-iobject');

// 22.1.3.4 Array.prototype.entries()
// 22.1.3.13 Array.prototype.keys()
// 22.1.3.29 Array.prototype.values()
// 22.1.3.30 Array.prototype[@@iterator]()
module.exports = require('./_iter-define')(Array, 'Array', function (iterated, kind) {
  this._t = toIObject(iterated); // target
  this._i = 0;                   // next index
  this._k = kind;                // kind
// 22.1.5.2.1 %ArrayIteratorPrototype%.next()
}, function () {
  var O = this._t;
  var kind = this._k;
  var index = this._i++;
  if (!O || index >= O.length) {
    this._t = undefined;
    return step(1);
  }
  if (kind == 'keys') return step(0, index);
  if (kind == 'values') return step(0, O[index]);
  return step(0, [index, O[index]]);
}, 'values');

// argumentsList[@@iterator] is %ArrayProto_values% (9.4.4.6, 9.4.4.7)
Iterators.Arguments = Iterators.Array;

addToUnscopables('keys');
addToUnscopables('values');
addToUnscopables('entries');

},{"./_add-to-unscopables":35,"./_iter-define":63,"./_iter-step":65,"./_iterators":66,"./_to-iobject":97}],108:[function(require,module,exports){
var $export = require('./_export');
// 19.1.2.2 / 15.2.3.5 Object.create(O [, Properties])
$export($export.S, 'Object', { create: require('./_object-create') });

},{"./_export":48,"./_object-create":71}],109:[function(require,module,exports){
var $export = require('./_export');
// 19.1.2.4 / 15.2.3.6 Object.defineProperty(O, P, Attributes)
$export($export.S + $export.F * !require('./_descriptors'), 'Object', { defineProperty: require('./_object-dp').f });

},{"./_descriptors":44,"./_export":48,"./_object-dp":72}],110:[function(require,module,exports){
// 19.1.3.19 Object.setPrototypeOf(O, proto)
var $export = require('./_export');
$export($export.S, 'Object', { setPrototypeOf: require('./_set-proto').set });

},{"./_export":48,"./_set-proto":87}],111:[function(require,module,exports){

},{}],112:[function(require,module,exports){
'use strict';
var LIBRARY = require('./_library');
var global = require('./_global');
var ctx = require('./_ctx');
var classof = require('./_classof');
var $export = require('./_export');
var isObject = require('./_is-object');
var aFunction = require('./_a-function');
var anInstance = require('./_an-instance');
var forOf = require('./_for-of');
var speciesConstructor = require('./_species-constructor');
var task = require('./_task').set;
var microtask = require('./_microtask')();
var newPromiseCapabilityModule = require('./_new-promise-capability');
var perform = require('./_perform');
var userAgent = require('./_user-agent');
var promiseResolve = require('./_promise-resolve');
var PROMISE = 'Promise';
var TypeError = global.TypeError;
var process = global.process;
var versions = process && process.versions;
var v8 = versions && versions.v8 || '';
var $Promise = global[PROMISE];
var isNode = classof(process) == 'process';
var empty = function () { /* empty */ };
var Internal, newGenericPromiseCapability, OwnPromiseCapability, Wrapper;
var newPromiseCapability = newGenericPromiseCapability = newPromiseCapabilityModule.f;

var USE_NATIVE = !!function () {
  try {
    // correct subclassing with @@species support
    var promise = $Promise.resolve(1);
    var FakePromise = (promise.constructor = {})[require('./_wks')('species')] = function (exec) {
      exec(empty, empty);
    };
    // unhandled rejections tracking support, NodeJS Promise without it fails @@species test
    return (isNode || typeof PromiseRejectionEvent == 'function')
      && promise.then(empty) instanceof FakePromise
      // v8 6.6 (Node 10 and Chrome 66) have a bug with resolving custom thenables
      // https://bugs.chromium.org/p/chromium/issues/detail?id=830565
      // we can't detect it synchronously, so just check versions
      && v8.indexOf('6.6') !== 0
      && userAgent.indexOf('Chrome/66') === -1;
  } catch (e) { /* empty */ }
}();

// helpers
var isThenable = function (it) {
  var then;
  return isObject(it) && typeof (then = it.then) == 'function' ? then : false;
};
var notify = function (promise, isReject) {
  if (promise._n) return;
  promise._n = true;
  var chain = promise._c;
  microtask(function () {
    var value = promise._v;
    var ok = promise._s == 1;
    var i = 0;
    var run = function (reaction) {
      var handler = ok ? reaction.ok : reaction.fail;
      var resolve = reaction.resolve;
      var reject = reaction.reject;
      var domain = reaction.domain;
      var result, then, exited;
      try {
        if (handler) {
          if (!ok) {
            if (promise._h == 2) onHandleUnhandled(promise);
            promise._h = 1;
          }
          if (handler === true) result = value;
          else {
            if (domain) domain.enter();
            result = handler(value); // may throw
            if (domain) {
              domain.exit();
              exited = true;
            }
          }
          if (result === reaction.promise) {
            reject(TypeError('Promise-chain cycle'));
          } else if (then = isThenable(result)) {
            then.call(result, resolve, reject);
          } else resolve(result);
        } else reject(value);
      } catch (e) {
        if (domain && !exited) domain.exit();
        reject(e);
      }
    };
    while (chain.length > i) run(chain[i++]); // variable length - can't use forEach
    promise._c = [];
    promise._n = false;
    if (isReject && !promise._h) onUnhandled(promise);
  });
};
var onUnhandled = function (promise) {
  task.call(global, function () {
    var value = promise._v;
    var unhandled = isUnhandled(promise);
    var result, handler, console;
    if (unhandled) {
      result = perform(function () {
        if (isNode) {
          process.emit('unhandledRejection', value, promise);
        } else if (handler = global.onunhandledrejection) {
          handler({ promise: promise, reason: value });
        } else if ((console = global.console) && console.error) {
          console.error('Unhandled promise rejection', value);
        }
      });
      // Browsers should not trigger `rejectionHandled` event if it was handled here, NodeJS - should
      promise._h = isNode || isUnhandled(promise) ? 2 : 1;
    } promise._a = undefined;
    if (unhandled && result.e) throw result.v;
  });
};
var isUnhandled = function (promise) {
  return promise._h !== 1 && (promise._a || promise._c).length === 0;
};
var onHandleUnhandled = function (promise) {
  task.call(global, function () {
    var handler;
    if (isNode) {
      process.emit('rejectionHandled', promise);
    } else if (handler = global.onrejectionhandled) {
      handler({ promise: promise, reason: promise._v });
    }
  });
};
var $reject = function (value) {
  var promise = this;
  if (promise._d) return;
  promise._d = true;
  promise = promise._w || promise; // unwrap
  promise._v = value;
  promise._s = 2;
  if (!promise._a) promise._a = promise._c.slice();
  notify(promise, true);
};
var $resolve = function (value) {
  var promise = this;
  var then;
  if (promise._d) return;
  promise._d = true;
  promise = promise._w || promise; // unwrap
  try {
    if (promise === value) throw TypeError("Promise can't be resolved itself");
    if (then = isThenable(value)) {
      microtask(function () {
        var wrapper = { _w: promise, _d: false }; // wrap
        try {
          then.call(value, ctx($resolve, wrapper, 1), ctx($reject, wrapper, 1));
        } catch (e) {
          $reject.call(wrapper, e);
        }
      });
    } else {
      promise._v = value;
      promise._s = 1;
      notify(promise, false);
    }
  } catch (e) {
    $reject.call({ _w: promise, _d: false }, e); // wrap
  }
};

// constructor polyfill
if (!USE_NATIVE) {
  // 25.4.3.1 Promise(executor)
  $Promise = function Promise(executor) {
    anInstance(this, $Promise, PROMISE, '_h');
    aFunction(executor);
    Internal.call(this);
    try {
      executor(ctx($resolve, this, 1), ctx($reject, this, 1));
    } catch (err) {
      $reject.call(this, err);
    }
  };
  // eslint-disable-next-line no-unused-vars
  Internal = function Promise(executor) {
    this._c = [];             // <- awaiting reactions
    this._a = undefined;      // <- checked in isUnhandled reactions
    this._s = 0;              // <- state
    this._d = false;          // <- done
    this._v = undefined;      // <- value
    this._h = 0;              // <- rejection state, 0 - default, 1 - handled, 2 - unhandled
    this._n = false;          // <- notify
  };
  Internal.prototype = require('./_redefine-all')($Promise.prototype, {
    // 25.4.5.3 Promise.prototype.then(onFulfilled, onRejected)
    then: function then(onFulfilled, onRejected) {
      var reaction = newPromiseCapability(speciesConstructor(this, $Promise));
      reaction.ok = typeof onFulfilled == 'function' ? onFulfilled : true;
      reaction.fail = typeof onRejected == 'function' && onRejected;
      reaction.domain = isNode ? process.domain : undefined;
      this._c.push(reaction);
      if (this._a) this._a.push(reaction);
      if (this._s) notify(this, false);
      return reaction.promise;
    },
    // 25.4.5.1 Promise.prototype.catch(onRejected)
    'catch': function (onRejected) {
      return this.then(undefined, onRejected);
    }
  });
  OwnPromiseCapability = function () {
    var promise = new Internal();
    this.promise = promise;
    this.resolve = ctx($resolve, promise, 1);
    this.reject = ctx($reject, promise, 1);
  };
  newPromiseCapabilityModule.f = newPromiseCapability = function (C) {
    return C === $Promise || C === Wrapper
      ? new OwnPromiseCapability(C)
      : newGenericPromiseCapability(C);
  };
}

$export($export.G + $export.W + $export.F * !USE_NATIVE, { Promise: $Promise });
require('./_set-to-string-tag')($Promise, PROMISE);
require('./_set-species')(PROMISE);
Wrapper = require('./_core')[PROMISE];

// statics
$export($export.S + $export.F * !USE_NATIVE, PROMISE, {
  // 25.4.4.5 Promise.reject(r)
  reject: function reject(r) {
    var capability = newPromiseCapability(this);
    var $$reject = capability.reject;
    $$reject(r);
    return capability.promise;
  }
});
$export($export.S + $export.F * (LIBRARY || !USE_NATIVE), PROMISE, {
  // 25.4.4.6 Promise.resolve(x)
  resolve: function resolve(x) {
    return promiseResolve(LIBRARY && this === Wrapper ? $Promise : this, x);
  }
});
$export($export.S + $export.F * !(USE_NATIVE && require('./_iter-detect')(function (iter) {
  $Promise.all(iter)['catch'](empty);
})), PROMISE, {
  // 25.4.4.1 Promise.all(iterable)
  all: function all(iterable) {
    var C = this;
    var capability = newPromiseCapability(C);
    var resolve = capability.resolve;
    var reject = capability.reject;
    var result = perform(function () {
      var values = [];
      var index = 0;
      var remaining = 1;
      forOf(iterable, false, function (promise) {
        var $index = index++;
        var alreadyCalled = false;
        values.push(undefined);
        remaining++;
        C.resolve(promise).then(function (value) {
          if (alreadyCalled) return;
          alreadyCalled = true;
          values[$index] = value;
          --remaining || resolve(values);
        }, reject);
      });
      --remaining || resolve(values);
    });
    if (result.e) reject(result.v);
    return capability.promise;
  },
  // 25.4.4.4 Promise.race(iterable)
  race: function race(iterable) {
    var C = this;
    var capability = newPromiseCapability(C);
    var reject = capability.reject;
    var result = perform(function () {
      forOf(iterable, false, function (promise) {
        C.resolve(promise).then(capability.resolve, reject);
      });
    });
    if (result.e) reject(result.v);
    return capability.promise;
  }
});

},{"./_a-function":34,"./_an-instance":36,"./_classof":39,"./_core":41,"./_ctx":42,"./_export":48,"./_for-of":50,"./_global":51,"./_is-object":60,"./_iter-detect":64,"./_library":67,"./_microtask":69,"./_new-promise-capability":70,"./_perform":82,"./_promise-resolve":83,"./_redefine-all":85,"./_set-species":88,"./_set-to-string-tag":89,"./_species-constructor":92,"./_task":94,"./_user-agent":102,"./_wks":105}],113:[function(require,module,exports){
'use strict';
var $at = require('./_string-at')(true);

// 21.1.3.27 String.prototype[@@iterator]()
require('./_iter-define')(String, 'String', function (iterated) {
  this._t = String(iterated); // target
  this._i = 0;                // next index
// 21.1.5.2.1 %StringIteratorPrototype%.next()
}, function () {
  var O = this._t;
  var index = this._i;
  var point;
  if (index >= O.length) return { value: undefined, done: true };
  point = $at(O, index);
  this._i += point.length;
  return { value: point, done: false };
});

},{"./_iter-define":63,"./_string-at":93}],114:[function(require,module,exports){
'use strict';
// ECMAScript 6 symbols shim
var global = require('./_global');
var has = require('./_has');
var DESCRIPTORS = require('./_descriptors');
var $export = require('./_export');
var redefine = require('./_redefine');
var META = require('./_meta').KEY;
var $fails = require('./_fails');
var shared = require('./_shared');
var setToStringTag = require('./_set-to-string-tag');
var uid = require('./_uid');
var wks = require('./_wks');
var wksExt = require('./_wks-ext');
var wksDefine = require('./_wks-define');
var enumKeys = require('./_enum-keys');
var isArray = require('./_is-array');
var anObject = require('./_an-object');
var isObject = require('./_is-object');
var toIObject = require('./_to-iobject');
var toPrimitive = require('./_to-primitive');
var createDesc = require('./_property-desc');
var _create = require('./_object-create');
var gOPNExt = require('./_object-gopn-ext');
var $GOPD = require('./_object-gopd');
var $DP = require('./_object-dp');
var $keys = require('./_object-keys');
var gOPD = $GOPD.f;
var dP = $DP.f;
var gOPN = gOPNExt.f;
var $Symbol = global.Symbol;
var $JSON = global.JSON;
var _stringify = $JSON && $JSON.stringify;
var PROTOTYPE = 'prototype';
var HIDDEN = wks('_hidden');
var TO_PRIMITIVE = wks('toPrimitive');
var isEnum = {}.propertyIsEnumerable;
var SymbolRegistry = shared('symbol-registry');
var AllSymbols = shared('symbols');
var OPSymbols = shared('op-symbols');
var ObjectProto = Object[PROTOTYPE];
var USE_NATIVE = typeof $Symbol == 'function';
var QObject = global.QObject;
// Don't use setters in Qt Script, https://github.com/zloirock/core-js/issues/173
var setter = !QObject || !QObject[PROTOTYPE] || !QObject[PROTOTYPE].findChild;

// fallback for old Android, https://code.google.com/p/v8/issues/detail?id=687
var setSymbolDesc = DESCRIPTORS && $fails(function () {
  return _create(dP({}, 'a', {
    get: function () { return dP(this, 'a', { value: 7 }).a; }
  })).a != 7;
}) ? function (it, key, D) {
  var protoDesc = gOPD(ObjectProto, key);
  if (protoDesc) delete ObjectProto[key];
  dP(it, key, D);
  if (protoDesc && it !== ObjectProto) dP(ObjectProto, key, protoDesc);
} : dP;

var wrap = function (tag) {
  var sym = AllSymbols[tag] = _create($Symbol[PROTOTYPE]);
  sym._k = tag;
  return sym;
};

var isSymbol = USE_NATIVE && typeof $Symbol.iterator == 'symbol' ? function (it) {
  return typeof it == 'symbol';
} : function (it) {
  return it instanceof $Symbol;
};

var $defineProperty = function defineProperty(it, key, D) {
  if (it === ObjectProto) $defineProperty(OPSymbols, key, D);
  anObject(it);
  key = toPrimitive(key, true);
  anObject(D);
  if (has(AllSymbols, key)) {
    if (!D.enumerable) {
      if (!has(it, HIDDEN)) dP(it, HIDDEN, createDesc(1, {}));
      it[HIDDEN][key] = true;
    } else {
      if (has(it, HIDDEN) && it[HIDDEN][key]) it[HIDDEN][key] = false;
      D = _create(D, { enumerable: createDesc(0, false) });
    } return setSymbolDesc(it, key, D);
  } return dP(it, key, D);
};
var $defineProperties = function defineProperties(it, P) {
  anObject(it);
  var keys = enumKeys(P = toIObject(P));
  var i = 0;
  var l = keys.length;
  var key;
  while (l > i) $defineProperty(it, key = keys[i++], P[key]);
  return it;
};
var $create = function create(it, P) {
  return P === undefined ? _create(it) : $defineProperties(_create(it), P);
};
var $propertyIsEnumerable = function propertyIsEnumerable(key) {
  var E = isEnum.call(this, key = toPrimitive(key, true));
  if (this === ObjectProto && has(AllSymbols, key) && !has(OPSymbols, key)) return false;
  return E || !has(this, key) || !has(AllSymbols, key) || has(this, HIDDEN) && this[HIDDEN][key] ? E : true;
};
var $getOwnPropertyDescriptor = function getOwnPropertyDescriptor(it, key) {
  it = toIObject(it);
  key = toPrimitive(key, true);
  if (it === ObjectProto && has(AllSymbols, key) && !has(OPSymbols, key)) return;
  var D = gOPD(it, key);
  if (D && has(AllSymbols, key) && !(has(it, HIDDEN) && it[HIDDEN][key])) D.enumerable = true;
  return D;
};
var $getOwnPropertyNames = function getOwnPropertyNames(it) {
  var names = gOPN(toIObject(it));
  var result = [];
  var i = 0;
  var key;
  while (names.length > i) {
    if (!has(AllSymbols, key = names[i++]) && key != HIDDEN && key != META) result.push(key);
  } return result;
};
var $getOwnPropertySymbols = function getOwnPropertySymbols(it) {
  var IS_OP = it === ObjectProto;
  var names = gOPN(IS_OP ? OPSymbols : toIObject(it));
  var result = [];
  var i = 0;
  var key;
  while (names.length > i) {
    if (has(AllSymbols, key = names[i++]) && (IS_OP ? has(ObjectProto, key) : true)) result.push(AllSymbols[key]);
  } return result;
};

// 19.4.1.1 Symbol([description])
if (!USE_NATIVE) {
  $Symbol = function Symbol() {
    if (this instanceof $Symbol) throw TypeError('Symbol is not a constructor!');
    var tag = uid(arguments.length > 0 ? arguments[0] : undefined);
    var $set = function (value) {
      if (this === ObjectProto) $set.call(OPSymbols, value);
      if (has(this, HIDDEN) && has(this[HIDDEN], tag)) this[HIDDEN][tag] = false;
      setSymbolDesc(this, tag, createDesc(1, value));
    };
    if (DESCRIPTORS && setter) setSymbolDesc(ObjectProto, tag, { configurable: true, set: $set });
    return wrap(tag);
  };
  redefine($Symbol[PROTOTYPE], 'toString', function toString() {
    return this._k;
  });

  $GOPD.f = $getOwnPropertyDescriptor;
  $DP.f = $defineProperty;
  require('./_object-gopn').f = gOPNExt.f = $getOwnPropertyNames;
  require('./_object-pie').f = $propertyIsEnumerable;
  require('./_object-gops').f = $getOwnPropertySymbols;

  if (DESCRIPTORS && !require('./_library')) {
    redefine(ObjectProto, 'propertyIsEnumerable', $propertyIsEnumerable, true);
  }

  wksExt.f = function (name) {
    return wrap(wks(name));
  };
}

$export($export.G + $export.W + $export.F * !USE_NATIVE, { Symbol: $Symbol });

for (var es6Symbols = (
  // 19.4.2.2, 19.4.2.3, 19.4.2.4, 19.4.2.6, 19.4.2.8, 19.4.2.9, 19.4.2.10, 19.4.2.11, 19.4.2.12, 19.4.2.13, 19.4.2.14
  'hasInstance,isConcatSpreadable,iterator,match,replace,search,species,split,toPrimitive,toStringTag,unscopables'
).split(','), j = 0; es6Symbols.length > j;)wks(es6Symbols[j++]);

for (var wellKnownSymbols = $keys(wks.store), k = 0; wellKnownSymbols.length > k;) wksDefine(wellKnownSymbols[k++]);

$export($export.S + $export.F * !USE_NATIVE, 'Symbol', {
  // 19.4.2.1 Symbol.for(key)
  'for': function (key) {
    return has(SymbolRegistry, key += '')
      ? SymbolRegistry[key]
      : SymbolRegistry[key] = $Symbol(key);
  },
  // 19.4.2.5 Symbol.keyFor(sym)
  keyFor: function keyFor(sym) {
    if (!isSymbol(sym)) throw TypeError(sym + ' is not a symbol!');
    for (var key in SymbolRegistry) if (SymbolRegistry[key] === sym) return key;
  },
  useSetter: function () { setter = true; },
  useSimple: function () { setter = false; }
});

$export($export.S + $export.F * !USE_NATIVE, 'Object', {
  // 19.1.2.2 Object.create(O [, Properties])
  create: $create,
  // 19.1.2.4 Object.defineProperty(O, P, Attributes)
  defineProperty: $defineProperty,
  // 19.1.2.3 Object.defineProperties(O, Properties)
  defineProperties: $defineProperties,
  // 19.1.2.6 Object.getOwnPropertyDescriptor(O, P)
  getOwnPropertyDescriptor: $getOwnPropertyDescriptor,
  // 19.1.2.7 Object.getOwnPropertyNames(O)
  getOwnPropertyNames: $getOwnPropertyNames,
  // 19.1.2.8 Object.getOwnPropertySymbols(O)
  getOwnPropertySymbols: $getOwnPropertySymbols
});

// 24.3.2 JSON.stringify(value [, replacer [, space]])
$JSON && $export($export.S + $export.F * (!USE_NATIVE || $fails(function () {
  var S = $Symbol();
  // MS Edge converts symbol values to JSON as {}
  // WebKit converts symbol values to JSON as null
  // V8 throws on boxed symbols
  return _stringify([S]) != '[null]' || _stringify({ a: S }) != '{}' || _stringify(Object(S)) != '{}';
})), 'JSON', {
  stringify: function stringify(it) {
    var args = [it];
    var i = 1;
    var replacer, $replacer;
    while (arguments.length > i) args.push(arguments[i++]);
    $replacer = replacer = args[1];
    if (!isObject(replacer) && it === undefined || isSymbol(it)) return; // IE8 returns string on undefined
    if (!isArray(replacer)) replacer = function (key, value) {
      if (typeof $replacer == 'function') value = $replacer.call(this, key, value);
      if (!isSymbol(value)) return value;
    };
    args[1] = replacer;
    return _stringify.apply($JSON, args);
  }
});

// 19.4.3.4 Symbol.prototype[@@toPrimitive](hint)
$Symbol[PROTOTYPE][TO_PRIMITIVE] || require('./_hide')($Symbol[PROTOTYPE], TO_PRIMITIVE, $Symbol[PROTOTYPE].valueOf);
// 19.4.3.5 Symbol.prototype[@@toStringTag]
setToStringTag($Symbol, 'Symbol');
// 20.2.1.9 Math[@@toStringTag]
setToStringTag(Math, 'Math', true);
// 24.3.3 JSON[@@toStringTag]
setToStringTag(global.JSON, 'JSON', true);

},{"./_an-object":37,"./_descriptors":44,"./_enum-keys":47,"./_export":48,"./_fails":49,"./_global":51,"./_has":52,"./_hide":53,"./_is-array":59,"./_is-object":60,"./_library":67,"./_meta":68,"./_object-create":71,"./_object-dp":72,"./_object-gopd":74,"./_object-gopn":76,"./_object-gopn-ext":75,"./_object-gops":77,"./_object-keys":80,"./_object-pie":81,"./_property-desc":84,"./_redefine":86,"./_set-to-string-tag":89,"./_shared":91,"./_to-iobject":97,"./_to-primitive":100,"./_uid":101,"./_wks":105,"./_wks-define":103,"./_wks-ext":104}],115:[function(require,module,exports){
// https://github.com/tc39/proposal-promise-finally
'use strict';
var $export = require('./_export');
var core = require('./_core');
var global = require('./_global');
var speciesConstructor = require('./_species-constructor');
var promiseResolve = require('./_promise-resolve');

$export($export.P + $export.R, 'Promise', { 'finally': function (onFinally) {
  var C = speciesConstructor(this, core.Promise || global.Promise);
  var isFunction = typeof onFinally == 'function';
  return this.then(
    isFunction ? function (x) {
      return promiseResolve(C, onFinally()).then(function () { return x; });
    } : onFinally,
    isFunction ? function (e) {
      return promiseResolve(C, onFinally()).then(function () { throw e; });
    } : onFinally
  );
} });

},{"./_core":41,"./_export":48,"./_global":51,"./_promise-resolve":83,"./_species-constructor":92}],116:[function(require,module,exports){
'use strict';
// https://github.com/tc39/proposal-promise-try
var $export = require('./_export');
var newPromiseCapability = require('./_new-promise-capability');
var perform = require('./_perform');

$export($export.S, 'Promise', { 'try': function (callbackfn) {
  var promiseCapability = newPromiseCapability.f(this);
  var result = perform(callbackfn);
  (result.e ? promiseCapability.reject : promiseCapability.resolve)(result.v);
  return promiseCapability.promise;
} });

},{"./_export":48,"./_new-promise-capability":70,"./_perform":82}],117:[function(require,module,exports){
require('./_wks-define')('asyncIterator');

},{"./_wks-define":103}],118:[function(require,module,exports){
require('./_wks-define')('observable');

},{"./_wks-define":103}],119:[function(require,module,exports){
require('./es6.array.iterator');
var global = require('./_global');
var hide = require('./_hide');
var Iterators = require('./_iterators');
var TO_STRING_TAG = require('./_wks')('toStringTag');

var DOMIterables = ('CSSRuleList,CSSStyleDeclaration,CSSValueList,ClientRectList,DOMRectList,DOMStringList,' +
  'DOMTokenList,DataTransferItemList,FileList,HTMLAllCollection,HTMLCollection,HTMLFormElement,HTMLSelectElement,' +
  'MediaList,MimeTypeArray,NamedNodeMap,NodeList,PaintRequestList,Plugin,PluginArray,SVGLengthList,SVGNumberList,' +
  'SVGPathSegList,SVGPointList,SVGStringList,SVGTransformList,SourceBufferList,StyleSheetList,TextTrackCueList,' +
  'TextTrackList,TouchList').split(',');

for (var i = 0; i < DOMIterables.length; i++) {
  var NAME = DOMIterables[i];
  var Collection = global[NAME];
  var proto = Collection && Collection.prototype;
  if (proto && !proto[TO_STRING_TAG]) hide(proto, TO_STRING_TAG, NAME);
  Iterators[NAME] = Iterators.Array;
}

},{"./_global":51,"./_hide":53,"./_iterators":66,"./_wks":105,"./es6.array.iterator":107}],120:[function(require,module,exports){
(function (process){
/**
 * This is the web browser implementation of `debug()`.
 *
 * Expose `debug()` as the module.
 */

exports = module.exports = require('./debug');
exports.log = log;
exports.formatArgs = formatArgs;
exports.save = save;
exports.load = load;
exports.useColors = useColors;
exports.storage = 'undefined' != typeof chrome
               && 'undefined' != typeof chrome.storage
                  ? chrome.storage.local
                  : localstorage();

/**
 * Colors.
 */

exports.colors = [
  '#0000CC', '#0000FF', '#0033CC', '#0033FF', '#0066CC', '#0066FF', '#0099CC',
  '#0099FF', '#00CC00', '#00CC33', '#00CC66', '#00CC99', '#00CCCC', '#00CCFF',
  '#3300CC', '#3300FF', '#3333CC', '#3333FF', '#3366CC', '#3366FF', '#3399CC',
  '#3399FF', '#33CC00', '#33CC33', '#33CC66', '#33CC99', '#33CCCC', '#33CCFF',
  '#6600CC', '#6600FF', '#6633CC', '#6633FF', '#66CC00', '#66CC33', '#9900CC',
  '#9900FF', '#9933CC', '#9933FF', '#99CC00', '#99CC33', '#CC0000', '#CC0033',
  '#CC0066', '#CC0099', '#CC00CC', '#CC00FF', '#CC3300', '#CC3333', '#CC3366',
  '#CC3399', '#CC33CC', '#CC33FF', '#CC6600', '#CC6633', '#CC9900', '#CC9933',
  '#CCCC00', '#CCCC33', '#FF0000', '#FF0033', '#FF0066', '#FF0099', '#FF00CC',
  '#FF00FF', '#FF3300', '#FF3333', '#FF3366', '#FF3399', '#FF33CC', '#FF33FF',
  '#FF6600', '#FF6633', '#FF9900', '#FF9933', '#FFCC00', '#FFCC33'
];

/**
 * Currently only WebKit-based Web Inspectors, Firefox >= v31,
 * and the Firebug extension (any Firefox version) are known
 * to support "%c" CSS customizations.
 *
 * TODO: add a `localStorage` variable to explicitly enable/disable colors
 */

function useColors() {
  // NB: In an Electron preload script, document will be defined but not fully
  // initialized. Since we know we're in Chrome, we'll just detect this case
  // explicitly
  if (typeof window !== 'undefined' && window.process && window.process.type === 'renderer') {
    return true;
  }

  // Internet Explorer and Edge do not support colors.
  if (typeof navigator !== 'undefined' && navigator.userAgent && navigator.userAgent.toLowerCase().match(/(edge|trident)\/(\d+)/)) {
    return false;
  }

  // is webkit? http://stackoverflow.com/a/16459606/376773
  // document is undefined in react-native: https://github.com/facebook/react-native/pull/1632
  return (typeof document !== 'undefined' && document.documentElement && document.documentElement.style && document.documentElement.style.WebkitAppearance) ||
    // is firebug? http://stackoverflow.com/a/398120/376773
    (typeof window !== 'undefined' && window.console && (window.console.firebug || (window.console.exception && window.console.table))) ||
    // is firefox >= v31?
    // https://developer.mozilla.org/en-US/docs/Tools/Web_Console#Styling_messages
    (typeof navigator !== 'undefined' && navigator.userAgent && navigator.userAgent.toLowerCase().match(/firefox\/(\d+)/) && parseInt(RegExp.$1, 10) >= 31) ||
    // double check webkit in userAgent just in case we are in a worker
    (typeof navigator !== 'undefined' && navigator.userAgent && navigator.userAgent.toLowerCase().match(/applewebkit\/(\d+)/));
}

/**
 * Map %j to `JSON.stringify()`, since no Web Inspectors do that by default.
 */

exports.formatters.j = function(v) {
  try {
    return JSON.stringify(v);
  } catch (err) {
    return '[UnexpectedJSONParseError]: ' + err.message;
  }
};


/**
 * Colorize log arguments if enabled.
 *
 * @api public
 */

function formatArgs(args) {
  var useColors = this.useColors;

  args[0] = (useColors ? '%c' : '')
    + this.namespace
    + (useColors ? ' %c' : ' ')
    + args[0]
    + (useColors ? '%c ' : ' ')
    + '+' + exports.humanize(this.diff);

  if (!useColors) return;

  var c = 'color: ' + this.color;
  args.splice(1, 0, c, 'color: inherit')

  // the final "%c" is somewhat tricky, because there could be other
  // arguments passed either before or after the %c, so we need to
  // figure out the correct index to insert the CSS into
  var index = 0;
  var lastC = 0;
  args[0].replace(/%[a-zA-Z%]/g, function(match) {
    if ('%%' === match) return;
    index++;
    if ('%c' === match) {
      // we only are interested in the *last* %c
      // (the user may have provided their own)
      lastC = index;
    }
  });

  args.splice(lastC, 0, c);
}

/**
 * Invokes `console.log()` when available.
 * No-op when `console.log` is not a "function".
 *
 * @api public
 */

function log() {
  // this hackery is required for IE8/9, where
  // the `console.log` function doesn't have 'apply'
  return 'object' === typeof console
    && console.log
    && Function.prototype.apply.call(console.log, console, arguments);
}

/**
 * Save `namespaces`.
 *
 * @param {String} namespaces
 * @api private
 */

function save(namespaces) {
  try {
    if (null == namespaces) {
      exports.storage.removeItem('debug');
    } else {
      exports.storage.debug = namespaces;
    }
  } catch(e) {}
}

/**
 * Load `namespaces`.
 *
 * @return {String} returns the previously persisted debug modes
 * @api private
 */

function load() {
  var r;
  try {
    r = exports.storage.debug;
  } catch(e) {}

  // If debug isn't set in LS, and we're in Electron, try to load $DEBUG
  if (!r && typeof process !== 'undefined' && 'env' in process) {
    r = process.env.DEBUG;
  }

  return r;
}

/**
 * Enable namespaces listed in `localStorage.debug` initially.
 */

exports.enable(load());

/**
 * Localstorage attempts to return the localstorage.
 *
 * This is necessary because safari throws
 * when a user disables cookies/localstorage
 * and you attempt to access it.
 *
 * @return {LocalStorage}
 * @api private
 */

function localstorage() {
  try {
    return window.localStorage;
  } catch (e) {}
}

}).call(this,require('_process'))
},{"./debug":121,"_process":2}],121:[function(require,module,exports){

/**
 * This is the common logic for both the Node.js and web browser
 * implementations of `debug()`.
 *
 * Expose `debug()` as the module.
 */

exports = module.exports = createDebug.debug = createDebug['default'] = createDebug;
exports.coerce = coerce;
exports.disable = disable;
exports.enable = enable;
exports.enabled = enabled;
exports.humanize = require('ms');

/**
 * Active `debug` instances.
 */
exports.instances = [];

/**
 * The currently active debug mode names, and names to skip.
 */

exports.names = [];
exports.skips = [];

/**
 * Map of special "%n" handling functions, for the debug "format" argument.
 *
 * Valid key names are a single, lower or upper-case letter, i.e. "n" and "N".
 */

exports.formatters = {};

/**
 * Select a color.
 * @param {String} namespace
 * @return {Number}
 * @api private
 */

function selectColor(namespace) {
  var hash = 0, i;

  for (i in namespace) {
    hash  = ((hash << 5) - hash) + namespace.charCodeAt(i);
    hash |= 0; // Convert to 32bit integer
  }

  return exports.colors[Math.abs(hash) % exports.colors.length];
}

/**
 * Create a debugger with the given `namespace`.
 *
 * @param {String} namespace
 * @return {Function}
 * @api public
 */

function createDebug(namespace) {

  var prevTime;

  function debug() {
    // disabled?
    if (!debug.enabled) return;

    var self = debug;

    // set `diff` timestamp
    var curr = +new Date();
    var ms = curr - (prevTime || curr);
    self.diff = ms;
    self.prev = prevTime;
    self.curr = curr;
    prevTime = curr;

    // turn the `arguments` into a proper Array
    var args = new Array(arguments.length);
    for (var i = 0; i < args.length; i++) {
      args[i] = arguments[i];
    }

    args[0] = exports.coerce(args[0]);

    if ('string' !== typeof args[0]) {
      // anything else let's inspect with %O
      args.unshift('%O');
    }

    // apply any `formatters` transformations
    var index = 0;
    args[0] = args[0].replace(/%([a-zA-Z%])/g, function(match, format) {
      // if we encounter an escaped % then don't increase the array index
      if (match === '%%') return match;
      index++;
      var formatter = exports.formatters[format];
      if ('function' === typeof formatter) {
        var val = args[index];
        match = formatter.call(self, val);

        // now we need to remove `args[index]` since it's inlined in the `format`
        args.splice(index, 1);
        index--;
      }
      return match;
    });

    // apply env-specific formatting (colors, etc.)
    exports.formatArgs.call(self, args);

    var logFn = debug.log || exports.log || console.log.bind(console);
    logFn.apply(self, args);
  }

  debug.namespace = namespace;
  debug.enabled = exports.enabled(namespace);
  debug.useColors = exports.useColors();
  debug.color = selectColor(namespace);
  debug.destroy = destroy;

  // env-specific initialization logic for debug instances
  if ('function' === typeof exports.init) {
    exports.init(debug);
  }

  exports.instances.push(debug);

  return debug;
}

function destroy () {
  var index = exports.instances.indexOf(this);
  if (index !== -1) {
    exports.instances.splice(index, 1);
    return true;
  } else {
    return false;
  }
}

/**
 * Enables a debug mode by namespaces. This can include modes
 * separated by a colon and wildcards.
 *
 * @param {String} namespaces
 * @api public
 */

function enable(namespaces) {
  exports.save(namespaces);

  exports.names = [];
  exports.skips = [];

  var i;
  var split = (typeof namespaces === 'string' ? namespaces : '').split(/[\s,]+/);
  var len = split.length;

  for (i = 0; i < len; i++) {
    if (!split[i]) continue; // ignore empty strings
    namespaces = split[i].replace(/\*/g, '.*?');
    if (namespaces[0] === '-') {
      exports.skips.push(new RegExp('^' + namespaces.substr(1) + '$'));
    } else {
      exports.names.push(new RegExp('^' + namespaces + '$'));
    }
  }

  for (i = 0; i < exports.instances.length; i++) {
    var instance = exports.instances[i];
    instance.enabled = exports.enabled(instance.namespace);
  }
}

/**
 * Disable debug output.
 *
 * @api public
 */

function disable() {
  exports.enable('');
}

/**
 * Returns true if the given mode name is enabled, false otherwise.
 *
 * @param {String} name
 * @return {Boolean}
 * @api public
 */

function enabled(name) {
  if (name[name.length - 1] === '*') {
    return true;
  }
  var i, len;
  for (i = 0, len = exports.skips.length; i < len; i++) {
    if (exports.skips[i].test(name)) {
      return false;
    }
  }
  for (i = 0, len = exports.names.length; i < len; i++) {
    if (exports.names[i].test(name)) {
      return true;
    }
  }
  return false;
}

/**
 * Coerce `val`.
 *
 * @param {Mixed} val
 * @return {Mixed}
 * @api private
 */

function coerce(val) {
  if (val instanceof Error) return val.stack || val.message;
  return val;
}

},{"ms":123}],122:[function(require,module,exports){
(function (global){
// https://github.com/maxogden/websocket-stream/blob/48dc3ddf943e5ada668c31ccd94e9186f02fafbd/ws-fallback.js

var ws = null

if (typeof WebSocket !== 'undefined') {
  ws = WebSocket
} else if (typeof MozWebSocket !== 'undefined') {
  ws = MozWebSocket
} else if (typeof global !== 'undefined') {
  ws = global.WebSocket || global.MozWebSocket
} else if (typeof window !== 'undefined') {
  ws = window.WebSocket || window.MozWebSocket
} else if (typeof self !== 'undefined') {
  ws = self.WebSocket || self.MozWebSocket
}

module.exports = ws

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],123:[function(require,module,exports){
/**
 * Helpers.
 */

var s = 1000;
var m = s * 60;
var h = m * 60;
var d = h * 24;
var y = d * 365.25;

/**
 * Parse or format the given `val`.
 *
 * Options:
 *
 *  - `long` verbose formatting [false]
 *
 * @param {String|Number} val
 * @param {Object} [options]
 * @throws {Error} throw an error if val is not a non-empty string or a number
 * @return {String|Number}
 * @api public
 */

module.exports = function(val, options) {
  options = options || {};
  var type = typeof val;
  if (type === 'string' && val.length > 0) {
    return parse(val);
  } else if (type === 'number' && isNaN(val) === false) {
    return options.long ? fmtLong(val) : fmtShort(val);
  }
  throw new Error(
    'val is not a non-empty string or a valid number. val=' +
      JSON.stringify(val)
  );
};

/**
 * Parse the given `str` and return milliseconds.
 *
 * @param {String} str
 * @return {Number}
 * @api private
 */

function parse(str) {
  str = String(str);
  if (str.length > 100) {
    return;
  }
  var match = /^((?:\d+)?\.?\d+) *(milliseconds?|msecs?|ms|seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|years?|yrs?|y)?$/i.exec(
    str
  );
  if (!match) {
    return;
  }
  var n = parseFloat(match[1]);
  var type = (match[2] || 'ms').toLowerCase();
  switch (type) {
    case 'years':
    case 'year':
    case 'yrs':
    case 'yr':
    case 'y':
      return n * y;
    case 'days':
    case 'day':
    case 'd':
      return n * d;
    case 'hours':
    case 'hour':
    case 'hrs':
    case 'hr':
    case 'h':
      return n * h;
    case 'minutes':
    case 'minute':
    case 'mins':
    case 'min':
    case 'm':
      return n * m;
    case 'seconds':
    case 'second':
    case 'secs':
    case 'sec':
    case 's':
      return n * s;
    case 'milliseconds':
    case 'millisecond':
    case 'msecs':
    case 'msec':
    case 'ms':
      return n;
    default:
      return undefined;
  }
}

/**
 * Short format for `ms`.
 *
 * @param {Number} ms
 * @return {String}
 * @api private
 */

function fmtShort(ms) {
  if (ms >= d) {
    return Math.round(ms / d) + 'd';
  }
  if (ms >= h) {
    return Math.round(ms / h) + 'h';
  }
  if (ms >= m) {
    return Math.round(ms / m) + 'm';
  }
  if (ms >= s) {
    return Math.round(ms / s) + 's';
  }
  return ms + 'ms';
}

/**
 * Long format for `ms`.
 *
 * @param {Number} ms
 * @return {String}
 * @api private
 */

function fmtLong(ms) {
  return plural(ms, d, 'day') ||
    plural(ms, h, 'hour') ||
    plural(ms, m, 'minute') ||
    plural(ms, s, 'second') ||
    ms + ' ms';
}

/**
 * Pluralization helper.
 */

function plural(ms, n, name) {
  if (ms < n) {
    return;
  }
  if (ms < n * 1.5) {
    return Math.floor(ms / n) + ' ' + name;
  }
  return Math.ceil(ms / n) + ' ' + name + 's';
}

},{}],124:[function(require,module,exports){
/**
 * Copyright (c) 2014-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

// This method of obtaining a reference to the global object needs to be
// kept identical to the way it is obtained in runtime.js
var g = (function() { return this })() || Function("return this")();

// Use `getOwnPropertyNames` because not all browsers support calling
// `hasOwnProperty` on the global `self` object in a worker. See #183.
var hadRuntime = g.regeneratorRuntime &&
  Object.getOwnPropertyNames(g).indexOf("regeneratorRuntime") >= 0;

// Save the old regeneratorRuntime in case it needs to be restored later.
var oldRuntime = hadRuntime && g.regeneratorRuntime;

// Force reevalutation of runtime.js.
g.regeneratorRuntime = undefined;

module.exports = require("./runtime");

if (hadRuntime) {
  // Restore the original runtime.
  g.regeneratorRuntime = oldRuntime;
} else {
  // Remove the global property added by runtime.js.
  try {
    delete g.regeneratorRuntime;
  } catch(e) {
    g.regeneratorRuntime = undefined;
  }
}

},{"./runtime":125}],125:[function(require,module,exports){
/**
 * Copyright (c) 2014-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

!(function(global) {
  "use strict";

  var Op = Object.prototype;
  var hasOwn = Op.hasOwnProperty;
  var undefined; // More compressible than void 0.
  var $Symbol = typeof Symbol === "function" ? Symbol : {};
  var iteratorSymbol = $Symbol.iterator || "@@iterator";
  var asyncIteratorSymbol = $Symbol.asyncIterator || "@@asyncIterator";
  var toStringTagSymbol = $Symbol.toStringTag || "@@toStringTag";

  var inModule = typeof module === "object";
  var runtime = global.regeneratorRuntime;
  if (runtime) {
    if (inModule) {
      // If regeneratorRuntime is defined globally and we're in a module,
      // make the exports object identical to regeneratorRuntime.
      module.exports = runtime;
    }
    // Don't bother evaluating the rest of this file if the runtime was
    // already defined globally.
    return;
  }

  // Define the runtime globally (as expected by generated code) as either
  // module.exports (if we're in a module) or a new, empty object.
  runtime = global.regeneratorRuntime = inModule ? module.exports : {};

  function wrap(innerFn, outerFn, self, tryLocsList) {
    // If outerFn provided and outerFn.prototype is a Generator, then outerFn.prototype instanceof Generator.
    var protoGenerator = outerFn && outerFn.prototype instanceof Generator ? outerFn : Generator;
    var generator = Object.create(protoGenerator.prototype);
    var context = new Context(tryLocsList || []);

    // The ._invoke method unifies the implementations of the .next,
    // .throw, and .return methods.
    generator._invoke = makeInvokeMethod(innerFn, self, context);

    return generator;
  }
  runtime.wrap = wrap;

  // Try/catch helper to minimize deoptimizations. Returns a completion
  // record like context.tryEntries[i].completion. This interface could
  // have been (and was previously) designed to take a closure to be
  // invoked without arguments, but in all the cases we care about we
  // already have an existing method we want to call, so there's no need
  // to create a new function object. We can even get away with assuming
  // the method takes exactly one argument, since that happens to be true
  // in every case, so we don't have to touch the arguments object. The
  // only additional allocation required is the completion record, which
  // has a stable shape and so hopefully should be cheap to allocate.
  function tryCatch(fn, obj, arg) {
    try {
      return { type: "normal", arg: fn.call(obj, arg) };
    } catch (err) {
      return { type: "throw", arg: err };
    }
  }

  var GenStateSuspendedStart = "suspendedStart";
  var GenStateSuspendedYield = "suspendedYield";
  var GenStateExecuting = "executing";
  var GenStateCompleted = "completed";

  // Returning this object from the innerFn has the same effect as
  // breaking out of the dispatch switch statement.
  var ContinueSentinel = {};

  // Dummy constructor functions that we use as the .constructor and
  // .constructor.prototype properties for functions that return Generator
  // objects. For full spec compliance, you may wish to configure your
  // minifier not to mangle the names of these two functions.
  function Generator() {}
  function GeneratorFunction() {}
  function GeneratorFunctionPrototype() {}

  // This is a polyfill for %IteratorPrototype% for environments that
  // don't natively support it.
  var IteratorPrototype = {};
  IteratorPrototype[iteratorSymbol] = function () {
    return this;
  };

  var getProto = Object.getPrototypeOf;
  var NativeIteratorPrototype = getProto && getProto(getProto(values([])));
  if (NativeIteratorPrototype &&
      NativeIteratorPrototype !== Op &&
      hasOwn.call(NativeIteratorPrototype, iteratorSymbol)) {
    // This environment has a native %IteratorPrototype%; use it instead
    // of the polyfill.
    IteratorPrototype = NativeIteratorPrototype;
  }

  var Gp = GeneratorFunctionPrototype.prototype =
    Generator.prototype = Object.create(IteratorPrototype);
  GeneratorFunction.prototype = Gp.constructor = GeneratorFunctionPrototype;
  GeneratorFunctionPrototype.constructor = GeneratorFunction;
  GeneratorFunctionPrototype[toStringTagSymbol] =
    GeneratorFunction.displayName = "GeneratorFunction";

  // Helper for defining the .next, .throw, and .return methods of the
  // Iterator interface in terms of a single ._invoke method.
  function defineIteratorMethods(prototype) {
    ["next", "throw", "return"].forEach(function(method) {
      prototype[method] = function(arg) {
        return this._invoke(method, arg);
      };
    });
  }

  runtime.isGeneratorFunction = function(genFun) {
    var ctor = typeof genFun === "function" && genFun.constructor;
    return ctor
      ? ctor === GeneratorFunction ||
        // For the native GeneratorFunction constructor, the best we can
        // do is to check its .name property.
        (ctor.displayName || ctor.name) === "GeneratorFunction"
      : false;
  };

  runtime.mark = function(genFun) {
    if (Object.setPrototypeOf) {
      Object.setPrototypeOf(genFun, GeneratorFunctionPrototype);
    } else {
      genFun.__proto__ = GeneratorFunctionPrototype;
      if (!(toStringTagSymbol in genFun)) {
        genFun[toStringTagSymbol] = "GeneratorFunction";
      }
    }
    genFun.prototype = Object.create(Gp);
    return genFun;
  };

  // Within the body of any async function, `await x` is transformed to
  // `yield regeneratorRuntime.awrap(x)`, so that the runtime can test
  // `hasOwn.call(value, "__await")` to determine if the yielded value is
  // meant to be awaited.
  runtime.awrap = function(arg) {
    return { __await: arg };
  };

  function AsyncIterator(generator) {
    function invoke(method, arg, resolve, reject) {
      var record = tryCatch(generator[method], generator, arg);
      if (record.type === "throw") {
        reject(record.arg);
      } else {
        var result = record.arg;
        var value = result.value;
        if (value &&
            typeof value === "object" &&
            hasOwn.call(value, "__await")) {
          return Promise.resolve(value.__await).then(function(value) {
            invoke("next", value, resolve, reject);
          }, function(err) {
            invoke("throw", err, resolve, reject);
          });
        }

        return Promise.resolve(value).then(function(unwrapped) {
          // When a yielded Promise is resolved, its final value becomes
          // the .value of the Promise<{value,done}> result for the
          // current iteration. If the Promise is rejected, however, the
          // result for this iteration will be rejected with the same
          // reason. Note that rejections of yielded Promises are not
          // thrown back into the generator function, as is the case
          // when an awaited Promise is rejected. This difference in
          // behavior between yield and await is important, because it
          // allows the consumer to decide what to do with the yielded
          // rejection (swallow it and continue, manually .throw it back
          // into the generator, abandon iteration, whatever). With
          // await, by contrast, there is no opportunity to examine the
          // rejection reason outside the generator function, so the
          // only option is to throw it from the await expression, and
          // let the generator function handle the exception.
          result.value = unwrapped;
          resolve(result);
        }, reject);
      }
    }

    var previousPromise;

    function enqueue(method, arg) {
      function callInvokeWithMethodAndArg() {
        return new Promise(function(resolve, reject) {
          invoke(method, arg, resolve, reject);
        });
      }

      return previousPromise =
        // If enqueue has been called before, then we want to wait until
        // all previous Promises have been resolved before calling invoke,
        // so that results are always delivered in the correct order. If
        // enqueue has not been called before, then it is important to
        // call invoke immediately, without waiting on a callback to fire,
        // so that the async generator function has the opportunity to do
        // any necessary setup in a predictable way. This predictability
        // is why the Promise constructor synchronously invokes its
        // executor callback, and why async functions synchronously
        // execute code before the first await. Since we implement simple
        // async functions in terms of async generators, it is especially
        // important to get this right, even though it requires care.
        previousPromise ? previousPromise.then(
          callInvokeWithMethodAndArg,
          // Avoid propagating failures to Promises returned by later
          // invocations of the iterator.
          callInvokeWithMethodAndArg
        ) : callInvokeWithMethodAndArg();
    }

    // Define the unified helper method that is used to implement .next,
    // .throw, and .return (see defineIteratorMethods).
    this._invoke = enqueue;
  }

  defineIteratorMethods(AsyncIterator.prototype);
  AsyncIterator.prototype[asyncIteratorSymbol] = function () {
    return this;
  };
  runtime.AsyncIterator = AsyncIterator;

  // Note that simple async functions are implemented on top of
  // AsyncIterator objects; they just return a Promise for the value of
  // the final result produced by the iterator.
  runtime.async = function(innerFn, outerFn, self, tryLocsList) {
    var iter = new AsyncIterator(
      wrap(innerFn, outerFn, self, tryLocsList)
    );

    return runtime.isGeneratorFunction(outerFn)
      ? iter // If outerFn is a generator, return the full iterator.
      : iter.next().then(function(result) {
          return result.done ? result.value : iter.next();
        });
  };

  function makeInvokeMethod(innerFn, self, context) {
    var state = GenStateSuspendedStart;

    return function invoke(method, arg) {
      if (state === GenStateExecuting) {
        throw new Error("Generator is already running");
      }

      if (state === GenStateCompleted) {
        if (method === "throw") {
          throw arg;
        }

        // Be forgiving, per 25.3.3.3.3 of the spec:
        // https://people.mozilla.org/~jorendorff/es6-draft.html#sec-generatorresume
        return doneResult();
      }

      context.method = method;
      context.arg = arg;

      while (true) {
        var delegate = context.delegate;
        if (delegate) {
          var delegateResult = maybeInvokeDelegate(delegate, context);
          if (delegateResult) {
            if (delegateResult === ContinueSentinel) continue;
            return delegateResult;
          }
        }

        if (context.method === "next") {
          // Setting context._sent for legacy support of Babel's
          // function.sent implementation.
          context.sent = context._sent = context.arg;

        } else if (context.method === "throw") {
          if (state === GenStateSuspendedStart) {
            state = GenStateCompleted;
            throw context.arg;
          }

          context.dispatchException(context.arg);

        } else if (context.method === "return") {
          context.abrupt("return", context.arg);
        }

        state = GenStateExecuting;

        var record = tryCatch(innerFn, self, context);
        if (record.type === "normal") {
          // If an exception is thrown from innerFn, we leave state ===
          // GenStateExecuting and loop back for another invocation.
          state = context.done
            ? GenStateCompleted
            : GenStateSuspendedYield;

          if (record.arg === ContinueSentinel) {
            continue;
          }

          return {
            value: record.arg,
            done: context.done
          };

        } else if (record.type === "throw") {
          state = GenStateCompleted;
          // Dispatch the exception by looping back around to the
          // context.dispatchException(context.arg) call above.
          context.method = "throw";
          context.arg = record.arg;
        }
      }
    };
  }

  // Call delegate.iterator[context.method](context.arg) and handle the
  // result, either by returning a { value, done } result from the
  // delegate iterator, or by modifying context.method and context.arg,
  // setting context.delegate to null, and returning the ContinueSentinel.
  function maybeInvokeDelegate(delegate, context) {
    var method = delegate.iterator[context.method];
    if (method === undefined) {
      // A .throw or .return when the delegate iterator has no .throw
      // method always terminates the yield* loop.
      context.delegate = null;

      if (context.method === "throw") {
        if (delegate.iterator.return) {
          // If the delegate iterator has a return method, give it a
          // chance to clean up.
          context.method = "return";
          context.arg = undefined;
          maybeInvokeDelegate(delegate, context);

          if (context.method === "throw") {
            // If maybeInvokeDelegate(context) changed context.method from
            // "return" to "throw", let that override the TypeError below.
            return ContinueSentinel;
          }
        }

        context.method = "throw";
        context.arg = new TypeError(
          "The iterator does not provide a 'throw' method");
      }

      return ContinueSentinel;
    }

    var record = tryCatch(method, delegate.iterator, context.arg);

    if (record.type === "throw") {
      context.method = "throw";
      context.arg = record.arg;
      context.delegate = null;
      return ContinueSentinel;
    }

    var info = record.arg;

    if (! info) {
      context.method = "throw";
      context.arg = new TypeError("iterator result is not an object");
      context.delegate = null;
      return ContinueSentinel;
    }

    if (info.done) {
      // Assign the result of the finished delegate to the temporary
      // variable specified by delegate.resultName (see delegateYield).
      context[delegate.resultName] = info.value;

      // Resume execution at the desired location (see delegateYield).
      context.next = delegate.nextLoc;

      // If context.method was "throw" but the delegate handled the
      // exception, let the outer generator proceed normally. If
      // context.method was "next", forget context.arg since it has been
      // "consumed" by the delegate iterator. If context.method was
      // "return", allow the original .return call to continue in the
      // outer generator.
      if (context.method !== "return") {
        context.method = "next";
        context.arg = undefined;
      }

    } else {
      // Re-yield the result returned by the delegate method.
      return info;
    }

    // The delegate iterator is finished, so forget it and continue with
    // the outer generator.
    context.delegate = null;
    return ContinueSentinel;
  }

  // Define Generator.prototype.{next,throw,return} in terms of the
  // unified ._invoke helper method.
  defineIteratorMethods(Gp);

  Gp[toStringTagSymbol] = "Generator";

  // A Generator should always return itself as the iterator object when the
  // @@iterator function is called on it. Some browsers' implementations of the
  // iterator prototype chain incorrectly implement this, causing the Generator
  // object to not be returned from this call. This ensures that doesn't happen.
  // See https://github.com/facebook/regenerator/issues/274 for more details.
  Gp[iteratorSymbol] = function() {
    return this;
  };

  Gp.toString = function() {
    return "[object Generator]";
  };

  function pushTryEntry(locs) {
    var entry = { tryLoc: locs[0] };

    if (1 in locs) {
      entry.catchLoc = locs[1];
    }

    if (2 in locs) {
      entry.finallyLoc = locs[2];
      entry.afterLoc = locs[3];
    }

    this.tryEntries.push(entry);
  }

  function resetTryEntry(entry) {
    var record = entry.completion || {};
    record.type = "normal";
    delete record.arg;
    entry.completion = record;
  }

  function Context(tryLocsList) {
    // The root entry object (effectively a try statement without a catch
    // or a finally block) gives us a place to store values thrown from
    // locations where there is no enclosing try statement.
    this.tryEntries = [{ tryLoc: "root" }];
    tryLocsList.forEach(pushTryEntry, this);
    this.reset(true);
  }

  runtime.keys = function(object) {
    var keys = [];
    for (var key in object) {
      keys.push(key);
    }
    keys.reverse();

    // Rather than returning an object with a next method, we keep
    // things simple and return the next function itself.
    return function next() {
      while (keys.length) {
        var key = keys.pop();
        if (key in object) {
          next.value = key;
          next.done = false;
          return next;
        }
      }

      // To avoid creating an additional object, we just hang the .value
      // and .done properties off the next function object itself. This
      // also ensures that the minifier will not anonymize the function.
      next.done = true;
      return next;
    };
  };

  function values(iterable) {
    if (iterable) {
      var iteratorMethod = iterable[iteratorSymbol];
      if (iteratorMethod) {
        return iteratorMethod.call(iterable);
      }

      if (typeof iterable.next === "function") {
        return iterable;
      }

      if (!isNaN(iterable.length)) {
        var i = -1, next = function next() {
          while (++i < iterable.length) {
            if (hasOwn.call(iterable, i)) {
              next.value = iterable[i];
              next.done = false;
              return next;
            }
          }

          next.value = undefined;
          next.done = true;

          return next;
        };

        return next.next = next;
      }
    }

    // Return an iterator with no values.
    return { next: doneResult };
  }
  runtime.values = values;

  function doneResult() {
    return { value: undefined, done: true };
  }

  Context.prototype = {
    constructor: Context,

    reset: function(skipTempReset) {
      this.prev = 0;
      this.next = 0;
      // Resetting context._sent for legacy support of Babel's
      // function.sent implementation.
      this.sent = this._sent = undefined;
      this.done = false;
      this.delegate = null;

      this.method = "next";
      this.arg = undefined;

      this.tryEntries.forEach(resetTryEntry);

      if (!skipTempReset) {
        for (var name in this) {
          // Not sure about the optimal order of these conditions:
          if (name.charAt(0) === "t" &&
              hasOwn.call(this, name) &&
              !isNaN(+name.slice(1))) {
            this[name] = undefined;
          }
        }
      }
    },

    stop: function() {
      this.done = true;

      var rootEntry = this.tryEntries[0];
      var rootRecord = rootEntry.completion;
      if (rootRecord.type === "throw") {
        throw rootRecord.arg;
      }

      return this.rval;
    },

    dispatchException: function(exception) {
      if (this.done) {
        throw exception;
      }

      var context = this;
      function handle(loc, caught) {
        record.type = "throw";
        record.arg = exception;
        context.next = loc;

        if (caught) {
          // If the dispatched exception was caught by a catch block,
          // then let that catch block handle the exception normally.
          context.method = "next";
          context.arg = undefined;
        }

        return !! caught;
      }

      for (var i = this.tryEntries.length - 1; i >= 0; --i) {
        var entry = this.tryEntries[i];
        var record = entry.completion;

        if (entry.tryLoc === "root") {
          // Exception thrown outside of any try block that could handle
          // it, so set the completion value of the entire function to
          // throw the exception.
          return handle("end");
        }

        if (entry.tryLoc <= this.prev) {
          var hasCatch = hasOwn.call(entry, "catchLoc");
          var hasFinally = hasOwn.call(entry, "finallyLoc");

          if (hasCatch && hasFinally) {
            if (this.prev < entry.catchLoc) {
              return handle(entry.catchLoc, true);
            } else if (this.prev < entry.finallyLoc) {
              return handle(entry.finallyLoc);
            }

          } else if (hasCatch) {
            if (this.prev < entry.catchLoc) {
              return handle(entry.catchLoc, true);
            }

          } else if (hasFinally) {
            if (this.prev < entry.finallyLoc) {
              return handle(entry.finallyLoc);
            }

          } else {
            throw new Error("try statement without catch or finally");
          }
        }
      }
    },

    abrupt: function(type, arg) {
      for (var i = this.tryEntries.length - 1; i >= 0; --i) {
        var entry = this.tryEntries[i];
        if (entry.tryLoc <= this.prev &&
            hasOwn.call(entry, "finallyLoc") &&
            this.prev < entry.finallyLoc) {
          var finallyEntry = entry;
          break;
        }
      }

      if (finallyEntry &&
          (type === "break" ||
           type === "continue") &&
          finallyEntry.tryLoc <= arg &&
          arg <= finallyEntry.finallyLoc) {
        // Ignore the finally entry if control is not jumping to a
        // location outside the try/catch block.
        finallyEntry = null;
      }

      var record = finallyEntry ? finallyEntry.completion : {};
      record.type = type;
      record.arg = arg;

      if (finallyEntry) {
        this.method = "next";
        this.next = finallyEntry.finallyLoc;
        return ContinueSentinel;
      }

      return this.complete(record);
    },

    complete: function(record, afterLoc) {
      if (record.type === "throw") {
        throw record.arg;
      }

      if (record.type === "break" ||
          record.type === "continue") {
        this.next = record.arg;
      } else if (record.type === "return") {
        this.rval = this.arg = record.arg;
        this.method = "return";
        this.next = "end";
      } else if (record.type === "normal" && afterLoc) {
        this.next = afterLoc;
      }

      return ContinueSentinel;
    },

    finish: function(finallyLoc) {
      for (var i = this.tryEntries.length - 1; i >= 0; --i) {
        var entry = this.tryEntries[i];
        if (entry.finallyLoc === finallyLoc) {
          this.complete(entry.completion, entry.afterLoc);
          resetTryEntry(entry);
          return ContinueSentinel;
        }
      }
    },

    "catch": function(tryLoc) {
      for (var i = this.tryEntries.length - 1; i >= 0; --i) {
        var entry = this.tryEntries[i];
        if (entry.tryLoc === tryLoc) {
          var record = entry.completion;
          if (record.type === "throw") {
            var thrown = record.arg;
            resetTryEntry(entry);
          }
          return thrown;
        }
      }

      // The context.catch method must only be called with a location
      // argument that corresponds to a known catch block.
      throw new Error("illegal catch attempt");
    },

    delegateYield: function(iterable, resultName, nextLoc) {
      this.delegate = {
        iterator: values(iterable),
        resultName: resultName,
        nextLoc: nextLoc
      };

      if (this.method === "next") {
        // Deliberately forget the last sent value so that we don't
        // accidentally pass it on to the delegate.
        this.arg = undefined;
      }

      return ContinueSentinel;
    }
  };
})(
  // In sloppy mode, unbound `this` refers to the global object, fallback to
  // Function constructor if we're in global strict mode. That is sadly a form
  // of indirect eval which violates Content Security Policy.
  (function() { return this })() || Function("return this")()
);

},{}]},{},[5])(5)
});
