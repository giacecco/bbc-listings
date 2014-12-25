var async = require('async'),
	path = require('path'),
	argv = require('yargs')
		.demand([ 'getiplayer', 'output', 'type' ])
		.alias('c', 'category')
		.alias('g', 'get')
		.alias('o', 'output')
		.default('getiplayer', '/usr/local/bin/get_iplayer')
		.default('getiplayer-home', path.join(process.env.HOME, '.get_iplayer'))
		.default('output', __dirname)
		.default('type', 'tv')
		.argv,
	_ = require('underscore'),
	exec = require('child_process').exec,
	fs = require('fs'),
	bbcTvListings = require('./bbc-tv-listings');

var run = function (parameters, callback) {
	// check on the input parameters
	if (!_.every([ 'output', 'getiplayer' ], function (s) { return _.isString(parameters[s]); })) throw new Error('One or more required parameters are missing.');
	if (!fs.existsSync(parameters.output)) throw new Error('The specified output directory does not exist.');
	if (!fs.lstatSync(parameters.output).isDirectory()) throw new Error('The specified output directory is not a directory.');
	if (!fs.existsSync(parameters.getiplayer)) throw new Error('The specified get_iplayer script does not exist.');
	// do the job
	var nedbQuery = { };
	if (parameters.category) nedbQuery.category = { '$in': parameters.category };
	bbcTvListings.get(nedbQuery, function (err, results) {
		// filtering by search string
		results = !parameters.search0 ? results : results.filter(function (r) { return r.name.match(new RegExp(parameters.search0, 'gi')); });
		console.log('Matching results for ' + JSON.stringify(parameters) + ':');
		console.log(results);
		if (parameters.get && (results.length > 0)) {
			console.log('Executing:');
			async.eachSeries(results.map(function (r) { return r.url; }), function (url, callback) {
				var command = 			
					parameters.getiplayer + ' '
					+ (parameters.force ? '--force ' : '') 
					+ '--output "' + parameters.output + '" ' 
					+ (parameters.get ? '--get ' : '')
					+ url;
				console.log(command);
				var child = exec(command, function (err, stdout, stderr) {
						console.log(stdout);
						callback(null);
					});
			}, callback);
		} else {
			callback(null);
		}
	});
};

var loadPvrSettings = function (pvrSettingsDirectory, callback) {
	async.map(fs.readdirSync(pvrSettingsDirectory), function (pvrSettingsFile, callback) {
		console.log(pvrSettingsFile);
		callback(null, fs.readFileSync(path.join(pvrSettingsDirectory, pvrSettingsFile), { 'encoding': 'utf8' }).split('\n').reduce(function (memo, line) {
			if (line.match(/([^ ]*) (.*)/)) memo[line.match(/([^ ]*) (.*)/)[1]] = line.match(/([^ ]*) (.*)/)[2].trim();
			return memo;
		}, { }));
	}, function (err, results) {
		// fix the format of the category field
		results.forEach(function (r) { if (r.category) r.category = r.category.toLowerCase().split(','); });
		callback(null, results);
	});
};

// TODO: need to add support to regular expressions for all string searching
// options, as in the original get_iplayer
// TODO: add support to run --pvr [pvr settings filename] rather than all of them
var PARAMETERS_WITHOUT_VALUE = [ 'get', 'prv', 'force' ], 
	PARAMETERS_WITHOUT_TRANSFORMATION = PARAMETERS_WITHOUT_VALUE.concat([ 'getiplayer', 'getiplayer-home', 'output', 'type' ]),
	// propagate to the parameters object all parameters that do not need 
	// transformation
	defaultParameters = PARAMETERS_WITHOUT_TRANSFORMATION.reduce(function (memo, x) { memo[x] = argv[x]; return memo; }, { });
if (argv.pvr) {
	console.log('Running PVR Searches (radio programmes are currently *not* supported):');
	loadPvrSettings(path.join(argv['getiplayer-home'], 'pvr'), function (err, downloadList) {
		// TODO: radio is not supported, filtering that out
		downloadList = _.reject(downloadList, function (s) { return s.type === 'radio'; });
		// adds the default parameters where not defined already
		downloadList = downloadList.map(function (s) { return _.extend(JSON.parse(JSON.stringify(defaultParameters)), s); });
		// adds the 'get' parameter
		downloadList.forEach(function (d) { d.get = true; });
		async.eachSeries(downloadList, function (d, callback) {
			run(d, callback);
		}, function (err) {
			// finished
		});
	});
} else {
	var parameters = JSON.parse(JSON.stringify(defaultParameters));
	// interpret the 'category' parameter
	parameters.category = argv.category ? argv.category.toLowerCase().split(',') : null;
	// to mimic the original get_iplayer command line behaviour, the search 
	// string can appear on its own or as the value of any of the parameters
	// that do not have a value (e.g. --get)
	parameters.search0 = _.find(PARAMETERS_WITHOUT_VALUE.map(function (x) { return argv[x]; }).concat(argv._[0]), function (x) { return _.isString(x); });
	// TODO: add support for reading get_iplayer's original pvr folder, or equivalent
	run(parameters, function (err) { });
}

