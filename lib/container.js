
if (typeof define !== 'function') { var define = require('amdefine')(module) };

define(['events', 'util'], function(events, util) {
	
	"use strict";

	var EventEmitter = events.EventEmitter;

	function Container(manager, name, config) {
		EventEmitter.call(this);
		this.manager = manager;
		this.name = name;
		this.config = config;
	}
	util.inherits(Container, EventEmitter);

	Container.prototype.freeze = function() {
		this.manager.freeze(this)
	}

	Container.prototype.unfreeze = function() {
		this.manager.unfreeze(this);
	}

	Container.prototype.stop = function() {
		this.manager.stop(this);
	}

	Container.prototype.execute = function(program, args) {
		this.manager.execute(this, program, args);
	}

	Container.prototype.getControlGroupProperty = function(name, callback) {
		
	}

	Container.prototype.setControlGroupProperty = function(name, value, callback) {
		this.manager.cgroup(this, name, value, callback);
	}

	return Container;
});