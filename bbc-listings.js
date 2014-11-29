var async = require('async'),
	cheerio = require('cheerio'),
	Nedb = require('nedb'), 
	path = require('path'),
	request = require('request'),
	_ = require('underscore');

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
		    			'_id': $(element).attr('data-ip-id'),
		    			'name': $('a', element).attr('title'),
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
	var db = new Nedb({ filename: path.join(__dirname, path.basename(__filename) + '.db') });
	db.loadDatabase(function (err) { 
		async.reduce([ 'films' ], [ ], function (memo, category, callback) {
			_getAllProgrammesByCategory(category, function (err, results) {
				callback(err, memo.concat(results));
			});
		}, function (err, results) {
			async.each(results, function (result, callback) {
				db.update(
					{ '_id': result._id },
					result,
					{ 'upsert': true },
					callback
				);
			}, function (err) {
				callback(err, results);
			});
		});
	});
}

exports.get = _getAll;
