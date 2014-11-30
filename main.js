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
	bbcListings = require('./bbc-listings');

var exit = function (err) {
	//finished, do nothing
}
bbcListings.get(function (err, results) {
	// TODO: need to add support to regular expressions below, as in the 
	// original get_iplayer
	if (argv.category) {
		// filtering by category
		var categories = argv.category.toLowerCase().split(',');
		results = results.filter(function (r) { return _.intersection(categories, r.category).length > 0; });
	}
	// to mimic the original get_iplayer command line behaviour, the search 
	// string can appear on its own or as the value of any of the parameters
	// that do not have a value (e.g. --get)
	var searchString = _.find([ argv.get, argv.force, argv._[0] ], function (x) { return _.isString(x); });
	if (searchString) {
		// filtering by search string
		results = results.filter(function (r) { return r.name.match(new RegExp(searchString, 'gi')); });
	};
	console.log('Matching results:');
	console.log(results);
	if (results.length > 0) {
		console.log('Executing:');
		async.eachSeries(argv.get ? results.map(function (r) { return r.url; }) : [ ], function (url, callback) {
			var command = 			
				argv.getiplayer + ' '
				+ (argv.force ? '--force ' : '') 
				+ '--output "' + argv.output + '" ' 
				+ (argv.get ? '--get ' : '')
				+ url;
			console.log(command);
			var child = exec(command, function (err, stdout, stderr) {
					console.log(stdout);
					callback(null);
				});
		}, exit);
	} else {
		exit(null);
	}
});
