var forever = require('forever-monitor');

var child = new (forever.Monitor)('bot.js', {
	silent: false,
	args: [],
	minUptime: 15000
});

child.on('exit', function () {
	console.log('Could not stay running long enough, exiting.');
});

child.start();