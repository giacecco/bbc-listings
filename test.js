var Nedb = require('nedb');

var db = new Nedb({ filename: 'test.db' });
db.loadDatabase(function (err) { 
	db.update({ '_id': 'foo_id' }, { somedata: 'hello' }, { 'upsert': true }, function (err, numReplaced) {
		console.log(numReplaced, err);
		db.update({ '_id': 'foo_id' }, { somedata: 'hello' }, { 'upsert': true }, function (err, numReplaced) {
			console.log(numReplaced, err);
			db.update({ '_id': 'foo_id' }, { somedata: 'hello' }, { 'upsert': true }, function (err, numReplaced) {
				console.log(numReplaced, err);

			});
		});
	});
});