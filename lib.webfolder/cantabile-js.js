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

const debug = require('debug')('Cantabile');
const EndPoint = require('./EndPoint');
const EventEmitter = require('events');

/**
 * Represents an active connection watching a source binding point for changes/invocations

 * Returned from the {{#crossLink "Bindings/watch:method"}}{{/crossLink}} method.
 * 
 * @class BindingWatcher
 * @extends EventEmitter
 */
class BindingWatcher extends EventEmitter
{
	constructor(owner, name, indicies, condition, listener)
	{
		super();
		this.owner = owner;
		this._name = name;
		this._indicies = indicies;
		this._condition = condition;
        this._listener = listener;
        this._value = null;
	}

	/**
	 * Returns the name of the binding point being listened to
	 *
	 * @property name
	 * @type {String} 
	 */
	get name() { return this._name; }

	/**
	 * Returns the indicies of the binding point being listened to
	 *
	 * @property indicies
	 * @type {Number[]} 
	 */
    get indicies() { return this._indicies; }
    
	/**
	 * Returns the condition of the binding point being listened to
	 *
	 * @property condition
	 * @type {Object} 
	 */
    get condition() { return this._condition; }

	/**
	 * Returns the last received value for the source binding point
	 *
	 * @property value
	 * @type {Object} 
	 */
    get value() { return this._value; }
    
	_start()
	{
		this.owner.post("/watch", {
            name: this._name,
            indicies: this._indicies,
            condition: this._condition
		}).then(r => {
            this.owner._registerWatchId(r.data.watchId, this);
			this._watchId = r.data.watchId;
			if (r.data.value !== null && r.data.value !== undefined)
			{
				this._value = r.data.value;
				this._fireInvoked();
			}
		});
	}

	_stop()
	{
		if (this.owner._epid && this._watchId)
		{
			this.owner.send("/unwatch", { watchId: this._watchId})
			this.owner._revokeWatchId(this._watchId);
			this._watchId = 0;
			if (this._value !== null && this._value !== undefined)
			{
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
	unwatch()
	{
		this._stop();
		this.owner._revokeWatcher(this);
	}

	_update(data)
	{
		this._value = data.value;
		this._fireInvoked();
	}

	_fireInvoked()
	{
		// Function listener?
		if (this._listener)
			this._listener(this._value, this);

		/**
		 * Fired when the source binding point is triggered
		 *
		 * @event invoked
		 * @param {Object} value The value supplied from the source binding
		 * @param {BindingWatcher} source This object
		 */
		this.emit('invoked', this.value, this);
	}
}

/**
 * Provides access to Cantabile's binding points.
 * 
 * Access this object via the {{#crossLink "Cantabile/bindings:property"}}{{/crossLink}} property.
 *
 * @class Bindings
 * @extends EndPoint
 */
class Bindings extends EndPoint
{
    constructor(owner)
    {
        super(owner, "/api/bindings");
		this._watchers = [];
		this._watchIds = {};
    }

    _onOpen()
    {
		for (let i=0; i<this._watchers.length; i++)
		{
			this._watchers[i]._start();
		}
    }

    _onClose()
    {
		for (let i=0; i<this._watchers.length; i++)
		{
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
    async availableBindingPoints()
    {
        await this.owner.untilConnected();
        return (await this.request("GET", "/availableBindingPoints")).data;
    }

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
    async invoke(name, value, indicies, parameter)
    {
        return (await this.request("POST", "/invoke", {
            name: name,
            value: value,
            indicies: indicies,
            parameter: parameter,
        }));
    }

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
    async query(name, indicies)
    {
        return (await this.request("POST", "/query", {
            name: name,
            indicies: indicies,
        })).data.value;
    }

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
	watch(name, indicies, condition, listener)
	{
		let w = new BindingWatcher(this, name, indicies, condition, listener);
		this._watchers.push(w);

		if (this.isOpen)
			w._start();
	}

	_registerWatchId(watchId, watcher)
	{
		this._watchIds[watchId] = watcher;
	}

	_revokeWatchId(watchId)
	{
		delete this._watchIds[watchId];
	}

	_revokeWatcher(w)
	{
		this._watchers = this._watchers.filter(x=>x != w);
	}

	_onEvent_invoked(data)
	{
		// Get the watcher
		let w = this._watchIds[data.watchId];
		if (w)
		{
			w._update(data);
		}
	}
}



module.exports = Bindings;
},{"./EndPoint":5,"debug":13,"events":1}],4:[function(require,module,exports){
(function (process){
'use strict';

const WebSocket = require('isomorphic-ws');
const debug = require('debug')('Cantabile');
const EventEmitter = require('events');

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
class Cantabile extends EventEmitter
{
	constructor(socketUrl)
	{
		super();

		var defaultHost = process.browser ? window.location.host : "localhost:35007";
		this.socketUrl = socketUrl || `ws://${defaultHost}/api/socket/`;
		this.shouldConnect = false;
		this._nextRid = 1;
		this._pendingResponseHandlers = {};
		this._endPointEventHandlers = {};
		this._setState("disconnected");

		/**
		 * Gets the setList object
		 *
		 * @property setList
		 * @type {SetList} 
		 */
		this.setList = new (require('./SetList'))(this);

		/**
		 * Gets the states of the current song
		 *
		 * @property songStates
		 * @type {SongStates} 
		 */
		this.songStates = new (require('./SongStates'))(this);

		/**
		 * Gets the currently active key ranges
		 *
		 * @property keyRanges
		 * @type {KeyRanges} 
		 */
		this.keyRanges = new (require('./KeyRanges'))(this);

		/**
		 * Gets the current set of show notes
		 *
		 * @property showNotes
		 * @type {ShowNotes} 
		 */
		this.showNotes = new (require('./ShowNotes'))(this);

		/**
		 * Provides access to variable expansion facilities
		 *
		 * @property variables
		 * @type {Variables} 
		 */
		this.variables = new (require('./Variables'))(this);

		/**
		 * Provides access to global binding points
		 *
		 * @property bindings
		 * @type {Bindings} 
		 */
		this.bindings = new (require('./Bindings'))(this);

		/**
		 * Provides access to information about the current song
		 *
		 * @property song
		 * @type {Song} 
		 */
		this.song = new (require('./Song'))(this);
	}

	/**
	 * The current connection state, either "connecting", "connected" or "disconnected"
	 *
	 * @property state
	 * @type {String} 
	 */
	get state()
	{
		return this._state;
	}

	/**
	 * Initiate connection and retry if fails
	 * @method connect
	 */
	connect()
	{
		this.shouldConnect = true;
		this._internalConnect();
	}

	/**
	 * Disconnect and stop retries
	 * @method disconnect
	 */
	disconnect()
	{
		this.shouldConnect = false;
		this._internalDisconnect();
	}

	/**
	 * Stringify an object as a JSON message and send it to the server
	 *
	 * @method send
	 * @param {object} obj The object to send
	 */
	send(obj)
	{
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
	request(message)
	{
		return new Promise(function(resolve, reject) {

			// Tag the message with the request id
			message.rid = this._nextRid++;

			// Store in the response handler map
			this._pendingResponseHandlers[message.rid] = {
				message: message,
				resolve: resolve,
				reject: reject,
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
	untilConnected()
	{
		if (this._state == "connected")
		{
			return Promise.resolve();		
		}
		else
		{
			return new Promise((resolve, reject) => {
				if (!this.pendingConnectPromises)
					 this.pendingConnectPromises = [resolve];
				else
					this.pendingConnectPromises.push(resolve);
			});
		}
	}

	// PRIVATE:

	// Internal helper to change state, log it and fire event
	_setState(value)
	{
		if (this._state != value)
		{
			this._state = value;
			this.emit('stateChanged', value);
			this.emit(value);
			debug(value);

			if (this._state == "connected")
			{
				if (this.pendingConnectPromises)
				{
					for (let i=0; i<this.pendingConnectPromises.length; i++)
					{
						this.pendingConnectPromises[i]();
					}
					this.pendingConnectPromises = null;
				}
			}
		}
	}

	// Internal helper to actually perform the connection
	_internalConnect()
	{
		if (!this.shouldConnect)
			return;

		// Already connected?
		if (this._ws)
			return;

		this._setState("connecting");

		// Create the socket and hook up handlers
		debug("Opening web socket '%s'", this.socketUrl);
		this._ws =  new WebSocket(this.socketUrl);
		this._ws.onerror = this._onSocketError.bind(this);
		this._ws.onopen = this._onSocketOpen.bind(this);
		this._ws.onclose = this._onSocketClose.bind(this);
		this._ws.onmessage = this._onSocketMessage.bind(this);
	}

	// Internal helper to disconnect
	_internalDisconnect()
	{
		if (this.state == "connected")
			this._setState("disconnected");

		// Already disconnected?
		if (!this._ws)
			return;

		this._ws.close();
		delete this._ws;
	}

	// Internal helper to retry connection every 1 second
	_internalReconnect()
	{
		if (this.shouldConnect && !this.timeoutPending)
		{
			this.timeoutPending = true;
			this._setState("connecting");
			setTimeout(function() {
				this.timeoutPending = false;
				this._internalConnect();
			}.bind(this), 1000);
		}
	}

	// Socket onerror handler
	_onSocketError(evt)
	{
		// Log it
		debug("socket error: %j", evt.error.message);

		// Disconnect
		this._internalDisconnect();

		// Try to reconnect...
		this._internalReconnect();
	}

	// Socket onopen handler
	_onSocketOpen()
	{
		this._setState("connected");
	}

	// Socket onclose handler
	_onSocketClose()
	{
		if (this._ws)
		{
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
	_onSocketMessage(msg)
	{
		msg = JSON.parse(msg.data);

		debug('RECV: %j', msg);

		// Request response?
		if (msg.rid)
		{
			// Find the handler
			let handlerInfo = this._pendingResponseHandlers[msg.rid];
			if (!handlerInfo)
			{
				debug('ERROR: received response for unknown rid:', msg.rid)
				return;
			}

			// Remove from pending map
			delete this._pendingResponseHandlers[msg.rid];

			// Resolve reject
			if (msg.status >= 200 && msg.status < 300)
				handlerInfo.resolve(msg);
			else
				handlerInfo.reject(new Error(`${msg.status} - ${msg.statusDescription}`));
		}

		// Event message?
		if (msg.epid && msg.eventName)
		{
			var ep = this._endPointEventHandlers[msg.epid];
			if (ep)
			{
				ep._dispatchEventMessage(msg.eventName, msg.data);
			}
			else
			{
				debug(`ERROR: No event handler found for end point ${msg.epid}`)
			}
		}
	}


	_registerEndPointEventHandler(epid, endPoint)
	{
		this._endPointEventHandlers[epid] = endPoint;
	}

	_revokeEndPointEventHandler(epid)
	{
		delete this._endPointEventHandlers[epid];
	}

}

/**
 * Fired when the {{#crossLink "Cantabile/state:property"}}{{/crossLink}} property value changes
 *
 * @event stateChanged
 * @param {String} state The new connection state ("connecting", "connected" or "disconnected")
 */
const eventStateChanged = "stateChanged";

/**
 * Fired when entering the connected state
 *
 * @event connected
 */
const eventConnected = "connected";

/**
 * Fired when entering the connecting state
 *
 * @event connecting
 */
const eventConnecting = "connecting";

/**
 * Fired when entering the disconnected state
 *
 * @event disconnected
 */
const eventDiconnected = "disconnected";




module.exports = Cantabile;
}).call(this,require('_process'))
},{"./Bindings":3,"./KeyRanges":6,"./SetList":7,"./ShowNotes":8,"./Song":9,"./SongStates":10,"./Variables":12,"_process":2,"debug":13,"events":1,"isomorphic-ws":15}],5:[function(require,module,exports){
'use strict';

const debug = require('debug')('Cantabile');
const EventEmitter = require('events');


// Helper to correctly join two paths ensuring only a single slash between them
function joinPath(a,b)
{
	while (a.endsWith('/'))
		a = a.substr(0, a.length - 1);
	while (b.startsWith('/'))
		b = b.substr(1);
	return `${a}/${b}`;
}

/**
 * Common functionality for all end point handlers
 *
 * @class EndPoint
 * @extends EventEmitter
 */
class EndPoint extends EventEmitter
{
	// Private constructor
	constructor(owner, endPoint)
	{
		super();
		this.owner = owner;
		this.endPoint = endPoint;
		this.openCount = 0;
		this.owner.on('connected', this._onConnected.bind(this));
		this.owner.on('disconnected', this._onDisconnected.bind(this));
	}

	/**
	 * Opens this end point and starts listening for events
	 * @method open
	 */
	open()
	{
		this.openCount++;

		if (this.openCount == 1 && this.owner.state == "connected")
		{
			this._onConnected();
		}
	}

	/**
	 * Closes the end point and stops listening for events
	 * @method close
	 */
	close()
	{
		// Reduce the open reference count
		this.openCount--;
		if (this.openCount > 0)
			return;

		// Send the close message
		this.owner.send({
			method: "close",
			epid: this._epid,
		});

		// Remove end point event handler
		this.owner._revokeEndPointEventHandler(this._epid);

		this._onClose();

		delete this._epid;
		delete this._data;
	}

	send(method, endPoint, data)
	{
		if (this._epid)
		{
			// If connection is open, pass the epid and just the sub-url path
			return this.owner.send({
				ep: endPoint,
				epid: this._epid,
				method: method,
				data: data,
			});
		}
		else
		{
			// If connection isn't open, need to specify the full end point url
			return this.owner.send({
				ep: joinPath(this.endPoint, endPoint),
				method: method,
				data: data,
			});
		}
	}

	request(method, endPoint, data)
	{
		if (this._epid)
		{
			// If connection is open, pass the epid and just the sub-url path
			return this.owner.request({
				ep: endPoint,
				epid: this._epid,
				method: method,
				data: data,
			});
		}
		else
		{
			// If connection isn't open, need to specify the full end point url
			return this.owner.request({
				ep: joinPath(this.endPoint, endPoint),
				method: method,
				data: data,
			});
		}
	}

	post(endPoint, data)
	{
		return this.request('post', endPoint, data);
	}

	get isOpen() { return !!this._epid }

	async _onConnected()
	{
		try
		{
			if (this.openCount == 0)
				return;
				
			var msg = await this.owner.request(
			{ 
				method: "open",
				ep: this.endPoint,
			});

			this._epid = msg.epid;
			this._data = msg.data;
			this.owner._registerEndPointEventHandler(this._epid, this);

			this._onOpen();
		}
		catch (err)
		{
			debug(err);
			throw err;
			// What to do?
		}
	}

	_onDisconnected()
	{
		if (this._epid)
			this.owner._revokeEndPointEventHandler(this._epid);
		delete this._epid;
		delete this._data;
		this._onClose();
	}

	_onOpen()
	{
	}

	_onClose()
	{
	}

	_dispatchEventMessage(eventName, data)
	{
		if (this["_onEvent_" + eventName])
		{
			this["_onEvent_" + eventName](data);
		}
	}

}

module.exports = EndPoint;
},{"debug":13,"events":1}],6:[function(require,module,exports){
'use strict';

const debug = require('debug')('Cantabile');
const EndPoint = require('./EndPoint');

/**
 * Provides access to information about the currently active set of key ranges
 * 
 * Access this object via the {{#crossLink "Cantabile/keyRanges:property"}}{{/crossLink}} property.
 *
 * @class KeyRanges
 * @extends EndPoint
 */
class KeyRanges extends EndPoint
{
	constructor(owner)
	{
		super(owner, "/api/keyranges");
	}

	_onOpen()
	{
		/**
		 * Fired when the active set of key ranges has changed
		 *
		 * @event changed
		 */
		this.emit('changed');
	}

	/**
	 * An array of key ranges
	 * @property items
	 * @type {KeyRange[]}
	 */
	get items() { return this._data ? this._data.items : null; }

	_onEvent_keyRangesChanged(data)
	{
		this._data = data;
		this.emit('changed');
	}
}



module.exports = KeyRanges;
},{"./EndPoint":5,"debug":13}],7:[function(require,module,exports){
'use strict';

const debug = require('debug')('Cantabile');
const EndPoint = require('./EndPoint');

/**
 * Used to access and control Cantabile's set list functionality.
 * 
 * Access this object via the {{#crossLink "Cantabile/setList:property"}}{{/crossLink}} property.
 *
 * @class SetList
 * @extends EndPoint
 */
class SetList extends EndPoint
{
	constructor(owner)
	{
		super(owner, "/api/setlist");
		this._currentSong = null;
	}

	_onOpen()
	{
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
	get items() { return this._data ? this._data.items : null; }

	/**
	 * The display name of the current set list (ie: its file name with path and extension removed)
	 * @property name
	 * @type {String} 
	 */
	get name() { return this._data ? this._data.name : null; }

	/**
	 * Indicates if the set list is currently pre-loaded
	 * @property preLoaded
	 * @type {Boolean}
	 */
	get preLoaded() { return this._data ? this._data.preLoaded : false; }

	/**
	 * The index of the currently loaded song (or -1 if the current song isn't in the set list)
	 * @property currentSongIndex
	 * @type {Number}
	 */
	get currentSongIndex() { return this._data.items.indexOf(this._currentSong); }

	/**
	 * The currently loaded item (or null if the current song isn't in the set list)
	 * @property currentSong
	 * @type {SetListItem}
	 */
	get currentSong() { return this._currentSong; }

	/**
	 * Load the song at a given index position
	 * @method loadSongByIndex
	 * @param {Number} index The zero based index of the song to load
	 * @param {Boolean} [delayed=false] Whether to perform a delayed or immediate load
	 */
	loadSongByIndex(index, delayed)
	{
		this.post("/loadSongByIndex", {
			index: index,
			delayed: delayed,
		})
	}

	/**
	 * Load the song with a given program number
	 * @method loadSongByProgram
	 * @param {Number} index The zero based program number of the song to load
	 * @param {Boolean} [delayed=false] Whether to perform a delayed or immediate load
	 */
	loadSongByProgram(pr, delayed)
	{
		this.post("/loadSongByProgram", {
			pr: pr,
			delayed: delayed,
		})
	}

	/**
	 * Load the first song in the set list
	 * @method loadFirstSong
	 * @param {Boolean} [delayed=false] Whether to perform a delayed or immediate load
	 */
	loadFirstSong(delayed)
	{
		this.post("/loadFirstSong", {
			delayed: delayed,
		})
	}

	/**
	 * Load the last song in the set list
	 * @method loadLastSong
	 * @param {Boolean} [delayed=false] Whether to perform a delayed or immediate load
	 */
	loadLastSong(delayed)
	{
		this.post("/loadLastSong", {
			delayed: delayed,
		})
	}

	/**
	 * Load the next or previous song in the set list
	 * @method loadNextSong
	 * @param {Number} direction Direction to move (1 = next, -1 = previous)
	 * @param {Boolean} [delayed=false] Whether to perform a delayed or immediate load
	 * @param {Boolean} [wrap=false] Whether to wrap around at the start/end of the list
	 */
	loadNextSong(direction, delayed, wrap)
	{
		this.post("/loadNextSong", {
			direction: direction,
			delayed: delayed,
			wrap: wrap,
		})
	}


	_resolveCurrentSong()
	{
		// Check have data and current index is in range and record the current song
		if (this._data && this._data.current>=0 && this._data.current < this._data.items.length)
		{
			this._currentSong = this._data.items[this._data.current];
		}
		else
		{
			this._currentSong = null;
		}
	}

	_onEvent_setListChanged(data)
	{
		this._data = data;
		this._resolveCurrentSong();
		this.emit('reload');
		this.emit('changed');
		this.emit('preLoadedChanged');
	}

	_onEvent_itemAdded(data)
	{
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
	_onEvent_itemRemoved(data)
	{
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
	_onEvent_itemMoved(data)
	{
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

	_onEvent_itemChanged(data)
	{
		if (this.currentSongIndex == data.index)
			this._currentSong = data.item;

		this._data.items.splice(data.index, 1, data.item);		// Don't use [] so Vue can handle it

		this.emit('itemChanged', data.index);
		this.emit('changed');

		/**
		 * Fired when something about an item has changed
		 *
		 * @event itemChanged
		 * @param {Number} index The zero based index of the item that changed
		 */

	}
	_onEvent_itemsReload(data)
	{
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

	_onEvent_preLoadedChanged(data)
	{
		this._data.preLoaded = data.preLoaded;
		this.emit('preLoadedChanged');

		/**
		 * Fired when the pre-loaded state of the list has changed
		 * 
		 * @event preLoadedChanged
		 */
	}

	_onEvent_currentSongChanged(data)
	{
		this._data.current = data.current;
		this._resolveCurrentSong();
		this.emit('currentSongChanged');

		/**
		 * Fired when the currently loaded song changes
		 * 
		 * @event currentSongChanged
		 */
	}

	_onEvent_nameChanged(data)
	{
		if (this._data)
			this._data.name = data ? data.name : null;
		this.emit('nameChanged');
		this.emit('changed');

		/**
		 * Fired when the name of the currently loaded set list changes
		 * 
		 * @event nameChanged
		 */
	}
}



module.exports = SetList;
},{"./EndPoint":5,"debug":13}],8:[function(require,module,exports){
'use strict';

const debug = require('debug')('Cantabile');
const EndPoint = require('./EndPoint');

/**
 * Used to access the current set of show notes
 * 
 * Access this object via the {{#crossLink "Cantabile/showNotes:property"}}{{/crossLink}} property.
 *
 * @class ShowNotes
 * @extends EndPoint
 */
class ShowNotes extends EndPoint
{
	constructor(owner)
	{
		super(owner, "/api/shownotes");
	}

	_onOpen()
	{
		this.emit('reload');
		this.emit('changed');
	}

	/**
	 * An array of show note items
	 * @property items
	 * @type {ShowNote[]}
	 */
	get items() { return this._data ? this._data.items : null; }

	_onEvent_itemAdded(data)
	{
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
	_onEvent_itemRemoved(data)
	{
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
	_onEvent_itemMoved(data)
	{
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

	_onEvent_itemChanged(data)
	{
		this._data.items.splice(data.index, 1, data.item);		// Don't use [] so Vue can handle it

		this.emit('itemChanged', data.index);
		this.emit('changed');

		/**
		 * Fired when something about an show note has changed
		 *
		 * @event itemChanged
		 * @param {Number} index The zero based index of the item that changed
		 */

	}
	_onEvent_itemsReload(data)
	{
		this._data.items = data.items;
		this.emit('reload');
		this.emit('changed');

		/**
		 * Fired when the entire set of show notes has changed (eg: after  loading a new song)
		 * 
		 * @event reload
		 */
	}
}



module.exports = ShowNotes;
},{"./EndPoint":5,"debug":13}],9:[function(require,module,exports){
'use strict';

const EndPoint = require('./EndPoint');

/**
 * Interface to the current song
 * 
 * Access this object via the {{#crossLink "Cantabile/song:property"}}{{/crossLink}} property.
 *
 * @class Song
 * @extends EndPoint
 */
class SongStates extends EndPoint
{
	constructor(owner)
	{
		super(owner, "/api/song");
	}

	_onOpen()
	{
		this.emit('changed');
		this.emit('nameChanged');
		this.emit('currentStateChanged');
	}

	get name() { return this._data ? this._data.name : null; }
	get currentState() { return this._data ? this._data.currentState : null; }

	_onEvent_songChanged(data)
	{
		this._data = data;
		this.emit('changed');
		this.emit('nameChanged');
		this.emit('currentStateChanged');
	}

	_onEvent_nameChanged(data)
	{
		this._data.name = data.name;
		this.emit('changed');
		this.emit('nameChanged');
	}

	_onEvent_currentStateChanged(data)
	{
		this._data.currentState = data.currentState;
		this.emit('changed');
		this.emit('currentStateChanged');
	}

}


module.exports = SongStates;
},{"./EndPoint":5}],10:[function(require,module,exports){
'use strict';

const States = require('./States');

/**
 * Interface to the states of the current song
 * 
 * Access this object via the {{#crossLink "Cantabile/songStates:property"}}{{/crossLink}} property.
 *
 * @class SongStates
 * @extends States
 */
class SongStates extends States
{
	constructor(owner)
	{
		super(owner, "/api/songStates");
	}
}


module.exports = SongStates;
},{"./States":11}],11:[function(require,module,exports){
'use strict';

const debug = require('debug')('Cantabile');
const EndPoint = require('./EndPoint');

/**
 * Base states functionality for State and racks
 * 
 * @class States
 * @extends EndPoint
 */
class States extends EndPoint
{
	constructor(owner, endPoint)
	{
		super(owner, endPoint);
		this._currentState = null;
	}

	_onOpen()
	{
		this._resolveCurrentState();
		this.emit('reload');
		this.emit('changed');
	}

	/**
	 * An array of states
	 * @property items
	 * @type {State[]}
	 */
	get items() { return this._data ? this._data.items : null; }

	/**
	 * The display name of the containing song or rack
	 * @property name
	 * @type {String} 
	 */
	get name() { return this._data ? this._data.name : null; }

	/**
	 * The index of the currently loaded State (or -1 if no active state)
	 * @property currentStateIndex
	 * @type {Number}
	 */
	get currentStateIndex() { return this._data.items.indexOf(this._currentState); }

	/**
	 * The currently loaded item (or null if no active state)
	 * @property currentState
	 * @type {State}
	 */
	get currentState() { return this._currentState; }

	/**
	 * Load the State at a given index position
	 * @method loadStateByIndex
	 * @param {Number} index The zero based index of the State to load
	 * @param {Boolean} [delayed=false] Whether to perform a delayed or immediate load
	 */
	loadStateByIndex(index, delayed)
	{
		this.post("/loadStateByIndex", {
			index: index,
			delayed: delayed,
		})
	}

	/**
	 * Load the State with a given program number
	 * @method loadStateByProgram
	 * @param {Number} index The zero based program number of the State to load
	 * @param {Boolean} [delayed=false] Whether to perform a delayed or immediate load
	 */
	loadStateByProgram(pr, delayed)
	{
		this.post("/loadStateByProgram", {
			pr: pr,
			delayed: delayed,
		})
	}

	/**
	 * Load the first state
	 * @method loadFirstState
	 * @param {Boolean} [delayed=false] Whether to perform a delayed or immediate load
	 */
	loadFirstState(delayed)
	{
		this.post("/loadFirstState", {
			delayed: delayed,
		})
	}

	/**
	 * Load the last state
	 * @method loadLastState
	 * @param {Boolean} [delayed=false] Whether to perform a delayed or immediate load
	 */
	loadLastState(delayed)
	{
		this.post("/loadLastState", {
			delayed: delayed,
		})
	}

	/**
	 * Load the next or previous state
	 * @method loadNextState
	 * @param {Number} direction Direction to move (1 = next, -1 = previous)
	 * @param {Boolean} [delayed=false] Whether to perform a delayed or immediate load
	 * @param {Boolean} [wrap=false] Whether to wrap around at the start/end
	 */
	loadNextState(direction, delayed, wrap)
	{
		this.post("/loadNextState", {
			direction: direction,
			delayed: delayed,
			wrap: wrap,
		})
	}


	_resolveCurrentState()
	{
		// Check have data and current index is in range and record the current State
		if (this._data && this._data.current>=0 && this._data.current < this._data.items.length)
		{
			this._currentState = this._data.items[this._data.current];
		}
		else
		{
			this._currentState = null;
		}
	}

	_onEvent_songChanged(data)
	{
		this._data = data;
		this._resolveCurrentState();
		this.emit('reload');
		this.emit('changed');
	}

	_onEvent_itemAdded(data)
	{
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
	_onEvent_itemRemoved(data)
	{
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
	_onEvent_itemMoved(data)
	{
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

	_onEvent_itemChanged(data)
	{
		if (this.currentStateIndex == data.index)
			this._currentState = data.item;

		this._data.items.splice(data.index, 1, data.item);		// Don't use [] so Vue can handle it

		this.emit('itemChanged', data.index);
		this.emit('changed');

		/**
		 * Fired when something about an state has changed
		 *
		 * @event itemChanged
		 * @param {Number} index The zero based index of the item that changed
		 */

	}
	_onEvent_itemsReload(data)
	{
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

	_onEvent_currentStateChanged(data)
	{
		this._data.current = data.current;
		this._resolveCurrentState();
		this.emit('currentStateChanged');

		/**
		 * Fired when the current state changes
		 * 
		 * @event currentStateChanged
		 */
	}

	_onEvent_nameChanged(data)
	{
		if (this._data)
			this._data.name = data ? data.name : null;
		this.emit('nameChanged');
		this.emit('changed');

		/**
		 * Fired when the name of the containing song or rack changes
		 * 
		 * @event nameChanged
		 */
	}
}



module.exports = States;
},{"./EndPoint":5,"debug":13}],12:[function(require,module,exports){
'use strict';

const debug = require('debug')('Cantabile');
const EndPoint = require('./EndPoint');
const EventEmitter = require('events');

/**
 * Represents a monitored pattern string.

 * Returned from the {{#crossLink "Variables/watch:method"}}{{/crossLink}} method.
 *
 * @class PatternWatcher
 * @extends EventEmitter
 */
class PatternWatcher extends EventEmitter
{
	constructor(owner, pattern, listener)
	{
		super();
		this.owner = owner;
		this._pattern = pattern;	
		this._patternId = 0;
		this._resolved = "";
		this._listener = listener;
	}

	/**
	 * Returns the pattern string being watched
	 *
	 * @property pattern
	 * @type {String} 
	 */
	get pattern() { return this._pattern; }

	/**
	 * Returns the current resolved display string
	 *
	 * @property resolved
	 * @type {String} 
	 */
	get resolved() { return this._resolved; }

	_start()
	{
		this.owner.post("/watch", {
			pattern: this._pattern,
		}).then(r => {
			if (r.data.patternId)
			{
				this.owner._registerPatternId(r.data.patternId, this);
				this._patternId = r.data.patternId;
			}
			this._resolved = r.data.resolved;
			this._fireChanged();
		});
	}

	_stop()
	{
		if (this.owner._epid && this._patternId)
		{
			this.owner.send("/unwatch", { patternId: this._patternId})
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
	unwatch()
	{
		this._stop();
		this.owner._revokeWatcher(this);
	}

	_update(data)
	{
		this._resolved = data.resolved;
		this._fireChanged();
	}

	_fireChanged()
	{
		// Function listener?
		if (this._listener)
			this._listener(this.resolved, this);

		/**
		 * Fired after a new show note has been added
		 *
		 * @event changed
		 * @param {String} resolved The new display string
		 * @param {PatternWatcher} source This object
		 */
		this.emit('changed', this.resolved, this);
	}
}



/**
 * Provides access to Cantabile's internal variables by allowing a pattern string to be
 * expanded into a final display string.
 * 
 * Access this object via the {{#crossLink "Cantabile/variables:property"}}{{/crossLink}} property.
 *
 * @class Variables
 * @extends EndPoint
 */
class Variables extends EndPoint
{
	constructor(owner)
	{
		super(owner, "/api/variables");
		this.watchers = [];
		this.patternIds = {};
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
	async resolve(pattern)
	{
		await this.owner.untilConnected();

		return (await this.post("/resolve", {
			pattern: pattern
		})).data.resolved;
	}

	_onOpen()
	{
		for (let i=0; i<this.watchers.length; i++)
		{
			this.watchers[i]._start();
		}
	}

	_onClose()
	{
		for (let i=0; i<this.watchers.length; i++)
		{
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
	watch(pattern, listener)
	{
		let w = new PatternWatcher(this, pattern, listener);
		this.watchers.push(w);

		if (this.isOpen)
			w._start();
	}

	_registerPatternId(patternId, watcher)
	{
		this.patternIds[patternId] = watcher;
	}

	_revokePatternId(patternId)
	{
		delete this.patternIds[patternId];
	}

	_revokeWatcher(w)
	{
		this.watchers = this.watchers.filter(x=>x != w);
	}

	_onEvent_patternChanged(data)
	{
		// Get the watcher
		let w = this.patternIds[data.patternId];
		if (w)
		{
			w._update(data);
		}
	}
}



module.exports = Variables;
},{"./EndPoint":5,"debug":13,"events":1}],13:[function(require,module,exports){
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
},{"./debug":14,"_process":2}],14:[function(require,module,exports){

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

},{"ms":16}],15:[function(require,module,exports){
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
},{}],16:[function(require,module,exports){
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

},{}]},{},[4])(4)
});
