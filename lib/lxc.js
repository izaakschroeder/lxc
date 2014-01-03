
if (typeof define !== 'function') { var define = require('amdefine')(module) };

define(['./container', 'com.izaakschroeder.uuid', 'async', 'fs', 'child_process', 'byline'], function(Container, UUID, async, fs, child_process, byline) {

	"use strict";

	function run(name, args, callback) {
		var process = spawn(name, args), stderr = '';
		process.stderr.on('readable', function(hunk) {
			stderr += hunk.toString('utf8');
		})
		process.on('error', function(err) {
			callback(err);
		}).on('exit', function(code) {
			callback(code !== 0 ? stderr : undefined);
		});
	}
	
	function LXC(path) {
		this.path = path;
	}

	LXC.createClient = function(path) {
		return new LXC(path || '/var/lib/lxc');
	}

	LXC.config = function(config) {
		if (Array.isArray(config)) return config;
		return Object.getOwnPropertyNames(config).reduce(function(prev, key, i) {
			var val = config[key];
			if (!Array.isArray(val)) val = [val];
			return val.reduce(function(prev, value) {
				if (typeof value === 'object') {
					return prev.concat(LXC.config(value).map(function(e) { 
						return { key: key+'.'+e.key, value: e.value }; 
					}));
				}
				else
					return prev.concat({key: key, value: value})
			}, prev);
		}, []);
	}

	LXC.switches = function(config) {
		var c = LXC.config(config), opts = [ ];
		for (var i = 0; i < c.length; ++i) {
			var e = c[i];
			opts.push('-s', e.key+'='+e.value);
		}
		console.log(opts);
		return opts;
	}

	LXC.prototype.createContainer = function(name, config) {
		name = name || UUID.generate();
		var lxc = this,
			container = new Container(this, name, config);
		return container;
	}

	LXC.prototype.execute = function(container, executable, args) {
		var opts = [
			'-P', this.path,
			'-o', '/tmp/lxc-'+container.name+'.log', 
			'-n', container.name, 
			].concat(LXC.switches(container.config))
			.concat([executable, '--'])
			.concat(args ? args : []),

			//remember that even though the documentation says
			//"To summarize, lxc-execute is for running an application 
			//and lxc-start is for running a system." they are lying!
			//you want lxc-start in both cases unless you want lxc-init
			//to fuck your day right up by attempting to do totally
			//unnecessary things!
			child = child_process.spawn('lxc-start', opts);
		
		container.emit('process', child);

		//Bubble through some of the more useful events
		child.on('error', function(err) {
			container.emit('error', err);
		}).on('exit', function(code) {
			if (code != 0)
				container.emit('error', code)
			else
				container.emit('exit');
		});

		//This is so fucking stupid. Important to note that even though the documentation
		//says it does regular expressions -n .* doesn't actually work! So create one
		//monitor for every instance spawned. Fun.
		var monitor = child_process.spawn('lxc-monitor', ['-P', this.path, '-n', container.name]);

		byline(monitor.stdout).on('readable', function() {
			var line, result;
			while (line = this.read()) {
				if (result = line.toString('utf8').match(/changed state to \[([^\]]+)\]/))
					container.emit('state', result[1]);
				//TODO: Any other kind of info that comes from this magical monitor
				//process?
			}
		})

		//When the container bails, then kill off the monitor too.
		child.on('exit', function() {
			var quit = false;
			monitor.on('exit', function() {
				quit = true;
			});
			//This may or may not actually kill the process... we have
			//to wait and find out if it actually worked.
			monitor.kill();
			setTimeout(function() {
				//If it doesn't, try and take "drastic measures".
				if (!quit)
					//If this doesn't work... well that's just too 
					//bad isn't it because kill -9 is the best we 
					//have. Just abandon ship after this.
					monitor.kill(9);
			}, 4000);
		})
	}


	LXC.prototype.unfreeze = function(name, callback) {
		if (typeof name === 'object') name = name.name;
		run('lxc-unfreeze', [
			'-P', this.path,
			'-n', name
		], callback);
	}

	LXC.prototype.freeze = function(name, callback) {
		if (typeof name === 'object') name = name.name;
		run('lxc-freeze', [
			'-P', this.path,
			'-n', name
		], callback);
		
	}

	LXC.prototype.stop = function(name, callback) {
		if (typeof name === 'object') name = name.name;
		run('lxc-stop', [
			'-P', this.path,
			'-n', name
		], callback);
	}

	LXC.prototype.cgroup = function(name, key, value, callback) {
		if (typeof name === 'object') name = name.name;
		run('lxc-cgroup', [
			'-P', this.path,
			'-n', name,
			key,
			value
		], callback);
	}

	return LXC;
});