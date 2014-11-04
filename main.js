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

var getAllProgrammesByCategoryAndPage_L = function (category, pageNo, callback) {
	category = category.toLowerCase();
	request({
		'url': 'http://www.bbc.co.uk/iplayer/categories/' + category + '/all?sort=atoz&page=' + pageNo,
		'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 8_0 like Mac OS X) AppleWebKit/600.1.3 (KHTML, like Gecko) Version/8.0 Mobile/12A4345d Safari/600.1.4',	
	}, function (error, response, body) {
		var results = [ ];
	    if (error || response.statusCode != 200) {
	    	callback(error || new Error('response.statusCode is ' + response.statusCode), results);
	    } else {
	    	var $ = cheerio.load(response.body),
	    		record;
	    	if ($('#main div:nth-child(2) div div p').text().indexOf('There are no programmes available at the moment for ') !== -1) {
	    		// one page too many!
	    		callback(null, results);
	    	} else {
		    	$('#category-tleo-list ul li').each(function (index, element) {
		    		results.push({
		    			'name': $('a', element).attr('title'),
		    			'url': $('a', element).attr('href'),
		    		});
		    		console.log('*** ' + $('a:nth-child(1)', element).attr('title') + ' - ' + $('a:nth-child(2)', element).text().trim()); 
		    	});
				async.eachSeries(results, function (result, callback) {
					db.update(
						{ '_id': result._id },
						result,
						{ 'upsert': true },
						callback
					);
				}, function (err) {
					callback(err, results);
				});
	    	}
	    }
	});
};

var getAllProgrammesByCategory_L = function (category, callback) {
	var pageNo = 0,
		foundSomething = false,
		results = [ ];
	async.doWhilst(
		function (callback) { 
			getAllProgrammesByCategoryAndPage_L(category, ++pageNo, function (err, r) {
				foundSomething = r.length > 0;
				results = results.concat(r);
				callback(err);
			});
		}, 
		function () { return foundSomething; },
		function (err) { callback(err, results); });
}



getAllProgrammesByCategory_L('comedy', function (err) {
	console.log('Done.');
});

/*
var getAllProgrammes = function (callback) {
	async.eachSeries([ 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k',
		'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y',
		'z', '0-9' ], 
		getAllProgrammesByLetter,
		callback);
};
*/

