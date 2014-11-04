var async = require('async'),
	cheerio = require('cheerio'),
	Nedb = require('nedb'),
	request = require('request'),
	argv = require('yargs')
		.demand([ 'db' ])
		.default('db', require('path').join(__dirname, 'foo.db'))
		.argv,
	_ = require('underscore');

var MEMOISATION_TTL = 5; // minutes

var db = new Nedb({ filename: argv.db, autoload: true });

var getAllProgrammesByLetter_L = function (letter, callback) {
	letter = letter.toLowerCase();
	request({
		'url': 'http://www.bbc.co.uk/iplayer/a-z/' + letter,
		'user-agent': 'Mozilla/5.0 (BB10; Touch) AppleWebKit/537.10+ (KHTML, like Gecko) Version/10.0.9.2372 Mobile Safari/537.10+',	
	}, function (error, response, body) {
		var results = [ ];
	    if (error || response.statusCode != 200) {
	    	callback(error || new Error('response.statusCode is ' + response.statusCode), results);
	    } else {
	    	var $ = cheerio.load(response.body),
	    		record;
	    	$('#atoz-content ol.tleo-list.left li').each(function (index, element) {
	    		results.push({
	    			'name': $(element).text().trim(),
	    			'_id': $('a', element).attr('href').match(/([^/]+)$/)[1],
	    		});
	    	});
	    	$('#atoz-content ol.tleo-list.right li').each(function (index, element) {
	    		results.push({
	    			'name': $(element).text().trim(),
	    			'_id': $('a', element).attr('href').match(/([^/]+)$/)[1],
	    		});
	    	});
			async.eachSeries(results, function (result, callback) {
				db.update(
					{ '_id': result._id },
					result,
					{ 'upsert': true },
					callback
				);
			}, callback);
	    }
	});
};

var getAllProgrammesByLetter_M = async.memoize(
	getAllProgrammesByLetter_L,
	function (letter) { 
		letter = letter.toLowerCase();
		return letter + '_' + Math.floor((new Date()).valueOf() / (MEMOISATION_TTL * 3600000));
	}
); 

var getAllProgrammesByLetter_Q = async.queue(function (letter, callback) {
	getAllProgrammesByLetter_M(letter, callback);
}, 1);

var getAllProgrammesByLetter = function (letter, callback) {
	getAllProgrammesByLetter_Q.push(letter, callback);
}

var getAllProgrammes = function (callback) {
	async.eachSeries([ 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k',
		'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y',
		'z', '0-9' ], 
		getAllProgrammesByLetter,
		callback);
};

getAllProgrammes(function (err) {
	console.log('Done.');
});
