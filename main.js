var async = require('async'),
	argv = require('yargs')
		.demand([ 'getiplayer', 'output' ])
		.alias('g', 'get')
		.alias('o', 'output')
		.default('getiplayer', '/usr/local/bin/get_iplayer')
		.default('output', __dirname)
		.argv,
	_ = require('underscore'),
	exec = require('child_process').exec,
	bbcListings = require('./bbc-listings');

bbcListings.getAllProgrammesByCategory('films', function (err, results) {
	var searchString = argv.get || argv._[0];
	if(searchString) {
		results = results.filter(function (r) { return r.name.match(new RegExp(searchString, 'gi')); });
	};
	console.log('Matching results:');
	console.log(results);
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
	}, function (err) {
		console.log("Done.");
	});
});
