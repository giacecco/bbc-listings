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
	if (!_.every([ 'output', 'getiplayer' ], function (s) { return _.isString(parameters[s]); })) throw new Error('One or more required parameters are missing.');
	if (!fs.existsSync(parameters.output)) throw new Error('The specified output directory does not exist.');
	if (!fs.lstatSync(parameters.output).isDirectory()) throw new Error('The specified output directory is not a directory.');
	if (!fs.existsSync(parameters.getiplayer)) throw new Error('The specified get_iplayer script does not exist.');
	// do the job
	bbcListings.get(function (err, results) {
		// filtering by category
		results = !parameters.categories ? results : results.filter(function (r) { return _.intersection(parameters.categories, r.category).length > 0; });
		// filtering by search string
		results = !parameters.searchString ? results : results.filter(function (r) { return r.name.match(new RegExp(parameters.searchString, 'gi')); });
		console.log('Matching results:');
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

// TODO: need to add support to regular expressions for all string searching
// options, as in the original get_iplayer
// TODO: abort if the specified get_iplayer script does not exist
var PARAMETERS_WITHOUT_VALUE = [ 'get', 'prv', 'force' ], 
	PARAMETERS_WITHOUT_TRANSFORMATION = PARAMETERS_WITHOUT_VALUE.concat([ 'getiplayer', 'output' ]),
	parameters = { };
// propagate to the parameters object all parameters that do not need 
// transformation
PARAMETERS_WITHOUT_TRANSFORMATION.forEach(function (x) { parameters[x] = argv[x]; });
// interpret the 'category' parameter
parameters.categories = argv.category ? argv.category.toLowerCase().split(',') : null;
// to mimic the original get_iplayer command line behaviour, the search 
// string can appear on its own or as the value of any of the parameters
// that do not have a value (e.g. --get)
parameters.searchString = _.find(PARAMETERS_WITHOUT_VALUE.map(function (x) { return argv[x]; }).concat(argv._[0]), function (x) { return _.isString(x); });
// TODO: add support for reading get_iplayer's original pvr folder, or equivalent
run(parameters, function (err) { });


