var async = require('async'),
	cheerio = require('cheerio'),
	fs = require('fs'), 
	path = require('path'),
	request = require('request'),
	_ = require('underscore');

var CACHE_TTL = 5; // minutes

var _getAllProgrammesByCategoryAndPage = function (category, pageNo, callback) {
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
		    	$('#category-tleo-list ul li.list-item.programme').each(function (index, element) {
		    		results.push({
		    			'dataIpId': $(element).attr('data-ip-id'),
		    			'name': $('a', element).attr('title'),
		    			'category': [ category ],
		    			'url': 'http://www.bbc.co.uk' + $('a', element).attr('href'),
		    			'synopsis': $('div.secondary p.synopsis', element).text().trim(),
		    		});
		    	});
				callback(null, results);
	    	}
	    }
	});
};

var _getAllProgrammesByCategory = function (category, callback) {
	var pageNo = 0,
		foundSomething = false,
		results = [ ];
	async.doWhilst(
		function (callback) { 
			_getAllProgrammesByCategoryAndPage(category, ++pageNo, function (err, r) {
				foundSomething = r.length > 0;
				results = results.concat(r);
				callback(err);
			});
		}, 
		function () { return foundSomething; },
		function (err) { callback(err, results); });
}

var _getAll = function (callback) {

	var cacheFilename = path.join(__dirname, path.basename(__filename) + '.db');

	var readLiveData = function (callback) {
		var timestamp = new Date();
		async.reduce(
			[ 'arts', 'cbbc', 'cbeebies', 'comedy', 'documentaries', 
				'drama-and-soaps', 'entertainment', 'films', 'food', 
				'history', 'lifestyle', 'music', 'news', 'science-and-nature',
				'sport', 'audio-described', 'signed', 'northern-ireland',
				'scotland', 'wales' ], 
			[ ], 
			function (memo, category, callback) {
				_getAllProgrammesByCategory(category, function (err, results) {
					results.forEach(function (r) {
						var preexistingProgramme = memo.filter(function (m) { return m.dataIpId === r.dataIpId; });
						if (preexistingProgramme.length > 0) {
							preexistingProgramme[0].category = preexistingProgramme[0].category.concat(r.category);
						} else {
							memo = memo.concat(r);
						}
					});
					callback(err, memo);
				});
		}, function (err, results) {
			callback(null, {
				'lastUpdated': timestamp,
				'programmes': results,
			});
		});
	}

	var readCache = function (callback) {
		callback(null, fs.existsSync(cacheFilename) ? JSON.parse(fs.readFileSync(cacheFilename)) : { });
	};

	var saveCache = function (cache, callback) {
		fs.writeFile(cacheFilename, JSON.stringify(cache), callback);
	}

	readCache(function (err, cache) {
		if (!cache.lastUpdated || (((new Date()) - cache.lastUpdated) > CACHE_TTL * 60000)) {
			readLiveData(function (err, cache) {
				saveCache(cache, function (err) {
					callback(err, cache.programmes);
				});
			})
		} else {
			callback(err, cache.programmes);
		}
	});

}

exports.get = _getAll;
