var async = require('async'),
	cheerio = require('cheerio'),
	request = require('request'),
	_ = require('underscore');

var MEMOISATION_TTL = 5; // minutes


var getAllProgrammesByLetter_L = function (letter, callback) {
	letter = letter.toLowerCase();
	request({
		'url': 'http://www.bbc.co.uk/iplayer/a-z/' + letter,
		'user-agent': 'Mozilla/5.0 (BB10; Touch) AppleWebKit/537.10+ (KHTML, like Gecko) Version/10.0.9.2372 Mobile Safari/537.10+',	
	}, function (error, response, body) {
		var results = { };
	    if (error || response.statusCode != 200) {
	    	callback(error || new Error('response.statusCode is ' + response.statusCode), results);
	    } else {
	    	var $ = cheerio.load(response.body);
	    	$('#atoz-content ol.tleo-list.left li').each(function (index, element) {
	    		results[$(element).text().trim().toLowerCase()] = (results[$(element).text().trim().toLowerCase()] || [ ]).concat('http://www.bbc.co.uk' + $('a', element).attr('href'));
	    	});
	    	$('#atoz-content ol.tleo-list.right li').each(function (index, element) {
	    		results[$(element).text().trim().toLowerCase()] = (results[$(element).text().trim().toLowerCase()] || [ ]).concat('http://www.bbc.co.uk' + $('a', element).attr('href'));
	    	});
	    	callback(null, results);
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
	async.reduce([ 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k',
		'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y',
		'z', '0-9' ], 
		{ }, 
		function (memo, letter, callback) {
			getAllProgrammesByLetter(letter, function (err, results) {
				_.extend(memo, memo, results);
				callback(null, memo);
			});
		}, function (err, result) {
			callback(err, result);
		});
};

getAllProgrammes(function (err, result) {
	console.log(JSON.stringify(result));
});
