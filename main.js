var async = require('async'),
	argv = require('yargs')
		.demand([ 'getiplayer', 'output' ])
		.alias('c', 'category')
		.alias('g', 'get')
		.alias('o', 'output')
		.default('getiplayer', '/usr/local/bin/get_iplayer')
		.default('output', __dirname)
		.argv,
	_ = require('underscore'),
	exec = require('child_process').exec,
	fs = require('fs'),
	bbcListings = require('./bbc-listings');

var run = function (parameters, callback) {
	// check on the input parameters
	if (!_.every([ 'output', 'getIplayerScript' ], function (s) { return _.isString(parameters[s]); })) throw new Error('One or more required parameters are missing.');
	if (!fs.existsSync(parameters.output)) throw new Error('The specified output directory does not exist.');
	if (!fs.lstatSync(parameters.output).isDirectory()) throw new Error('The specified output directory is not a directory.');
	if (!fs.existsSync(parameters.getIplayerScript)) throw new Error('The specified get_iplayer script does not exist.');
	// do the job
	bbcListings.get(function (err, results) {
		// filtering by category
		results = !parameters.categories ? results : results.filter(function (r) { return _.intersection(parameters.categories, r.category).length > 0; });
		// filtering by search string
		results = !parameters.searchString ? results : results.filter(function (r) { return r.name.match(new RegExp(parameters.searchString, 'gi')); });
		console.log('Matching results:');
		console.log(results);
		if (results.length > 0) {
			console.log('Executing:');
			async.eachSeries(argv.get ? results.map(function (r) { return r.url; }) : [ ], function (url, callback) {
				var command = 			
					parameters.getIplayerScript + ' '
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

// TODO: need to add support to regular expressions for all string searching
// options, as in the original get_iplayer
// TODO: abort if the specified get_iplayer script does not exist
var parameters = { };
parameters.categories = argv.category ? argv.category.toLowerCase().split(',') : null;
// to mimic the original get_iplayer command line behaviour, the search 
// string can appear on its own or as the value of any of the parameters
// that do not have a value (e.g. --get)
parameters.searchString = _.find([ argv.get, argv.force, argv._[0] ], function (x) { return _.isString(x); });
parameters.force = argv.force;
parameters.get = argv.get;
parameters.getIplayerScript = argv.getiplayer;
// TODO: abort if the output folder does not exist
parameters.output = argv.output;
run(parameters, function (err) { });
