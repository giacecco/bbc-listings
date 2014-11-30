var async = require('async'),
	cheerio = require('cheerio'),
	path = require('path'),
	Nedb = require('nedb'),
	request = require('request'),
	_ = require('underscore');

var CACHE_TTL = 30; // minutes

var db = null;

var _getAllProgrammesByCategoryAndPage = function (category, pageNo, callback) {
	category = category.toLowerCase();
	var timestamp = new Date();
	request({
		'url': 'http://www.bbc.co.uk/iplayer/categories/' + category + '/all?sort=atoz&page=' + pageNo,
		'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 8_0 like Mac OS X) AppleWebKit/600.1.3 (KHTML, like Gecko) Version/8.0 Mobile/12A4345d Safari/600.1.4',	
	}, function (error, response, body) {
	    if (error || response.statusCode != 200) {
	    	callback(error || new Error('response.statusCode is ' + response.statusCode), results);
	    } else {
	    	var $ = cheerio.load(response.body),
	    		record;
	    	if ($('#main div:nth-child(2) div div p').text().indexOf('There are no programmes available at the moment for ') !== -1) {
	    		// one page too many!
	    		callback(null, [ ]);
	    	} else {
				var results = [ ];
		    	$('#category-tleo-list ul li.list-item.programme').each(function (index, element) {
		    		results.push({
		    			'_id': $(element).attr('data-ip-id'),
		    			'existenceLatestKnown': timestamp,
		    			'name': $('a', element).attr('title'),
		    			'type': 'tv',
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
			_getAllProgrammesByCategoryAndPage(category, ++pageNo, function (err, pageResults) {
				foundSomething = pageResults.length > 0;
				results = results.concat(pageResults);
				callback(err);
			});
		}, 
		function () { return foundSomething; },
		function (err) { 
			callback(err, results);	
		});
}

var _getAll = function (optionalNedbQuery, callback) {

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
						var preexistingProgramme = memo.filter(function (m) { return m._id === r._id; });
						if (preexistingProgramme.length > 0) {
							preexistingProgramme[0].category = preexistingProgramme[0].category.concat(r.category);
						} else {
							memo = memo.concat(r);
						}
					});
					callback(err, memo);
				});
		}, function (err, results) {
	    	// clear the cache
    		var currentIds = results.map(function (r) { return r._id; });
    		db.remove({ }, { 'multi': true }, function (err, numRemoved) {
		    	// write the new one
		    	async.map(results, function (result, callback) {
		    		db.findOne({ '_id': result._id }, function (err, doc) {
		    			if (!doc) {
		    				// new record!
		    				db.insert(result, function (err) { callback(err, result); });
		    			} else {
		    				result.category = _.union(result.category, doc.category);
		    				db.update({ '_id': result._id }, result, { }, function (err) { callback(err, result); });
		    			}
		    		});
		    	}, callback);
    		});
		});
	}

	if (!callback) { callback = optionalNedbQuery; optionalNedbQuery = { }; }
	db = new Nedb({ filename: path.join(__dirname, path.basename(__filename) + '.db') });
	db.loadDatabase(function (err) {   
		db.find({ }).sort({ 'existenceLatestKnown': -1 }).limit(1).exec(function (err, docs) {
			if (docs.length === 0 || ((new Date()) - docs[0].existenceLatestKnown > CACHE_TTL * 60000)) {
				readLiveData(function (err, cache) {
					db.find(optionalNedbQuery, callback);
				});
			} else {
				db.find(optionalNedbQuery, callback);
			}
		})
	});
}

exports.get = _getAll;

