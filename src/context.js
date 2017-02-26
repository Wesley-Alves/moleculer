/*
 * moleculer
 * Copyright (c) 2017 Icebob (https://github.com/ice-services/moleculer)
 * MIT Licensed
 */

"use strict";

const Promise = require("bluebird");
const utils = require("./utils");

const LOGGER_PREFIX = "CTX";

/**
 * Context class for action calls
 * 
 * @class Context
 */
class Context {

	/**
	 * Creates an instance of Context.
	 * 
	 * @param {any} opts
	 * 
	 * @memberOf Context
	 */
	constructor(opts = {}) {
		this.opts = opts;
		this.broker = opts.broker;
		this.action = opts.action;
		this.nodeID = opts.nodeID;
		this.user = opts.user;
		this.parent = opts.parent;

		this.setParams(opts.params);

		if (opts.metrics) {
			this.id = utils.generateToken();
			this.requestID = opts.requestID || this.id;

			this.level = opts.parent && opts.parent.level ? opts.parent.level + 1 : 1;
			
			this.startTime = null;
			this.startHrTime = null;
			this.stopTime = null;
			this.duration = 0;
		}		

		this.error = null;
		this.cachedResult = false;
	}

	/**
	 * Create a sub-context from this context
	 * 
	 * @param {any} action
	 * @param {any} params
	 * @returns
	 * 
	 * @memberOf Context
	 */
	createSubContext(action, params, nodeID) {
		let ContextClass = this.broker ? this.broker.ContextFactory : Context;
		let ctx = new ContextClass({
			parent: this,
			requestID: this.requestID,
			broker: this.broker,
			action: action || this.action,
			nodeID,
			user: this.user,
			params
		});

		return ctx;
	}

	/**
	 * Set params of context
	 * 
	 * @param {any} newParams
	 * 
	 * @memberOf Context
	 */
	setParams(newParams) {
		if (this.opts.cloneParams && newParams)
			this.params = Object.assign({}, newParams);
		else
			this.params = newParams || {};
	}

	/**
	 * Call an other action. It will be create a sub-context.
	 * 
	 * @param {any} actionName
	 * @param {any} params
	 * @param {any} opts
	 * @returns
	 * 
	 * @memberOf Context
	 */
	call(actionName, params, opts = {}) {
		opts.parentCtx = this;
		return this.broker.call(actionName, params, opts);
	}	

	/**
	 * Call a global event (with broker.emit)
	 * 
	 * @param {any} eventName
	 * @param {any} data
	 * @returns
	 * 
	 * @memberOf Context
	 */
	emit(eventName, data) {
		return this.broker.emit(eventName, data);
	}

	/**
	 * Send start event to metrics system
	 * 
	 * @memberOf Context
	 */
	_metricStart() {
		this.startTime = Date.now();
		this.startHrTime = process.hrtime();
		this.duration = 0;
		
		let payload = {
			id: this.id,
			requestID: this.requestID,
			startTime: this.startTime,
			level: this.level,
			remoteCall: this.remoteCall
		};
		if (this.action) {
			payload.action = {
				name: this.action.name
			};
		}
		if (this.parent) {
			payload.parent = this.parent.id;
		}
		this.broker.emit("metrics.context.start", payload);
	}

	/**
 	 * Send finish event to metrics system
	 * 
	 * @memberOf Context
	 */
	_metricFinish() {
		let diff = process.hrtime(this.startHrTime);
		this.duration = (diff[0] * 1e3) + (diff[1] / 1e6); // milliseconds
		this.stopTime = this.startTime + this.duration;

		let payload = {
			id: this.id,
			requestID: this.requestID,
			level: this.level,
			endTime: this.stopTime,
			duration: this.duration,
			remoteCall: this.remoteCall,
			fromCache: this.cachedResult
		};
		if (this.action) {
			payload.action = {
				name: this.action.name
			};
		}			
		if (this.parent) {
			payload.parent = this.parent.id;
		}
		if (this.error) {
			payload.error = {
				type: this.error.name,
				message: this.error.message
			};
		}
		this.broker.emit("metrics.context.finish", payload);
	}
}

module.exports = Context;