const util = require("util");

module.exports = {
	help: cfg => "Show info about the bot.",
	permitted: msg => true,
	execute: (bot, msg, args, cfg) => {
		process.send({name: 'postStats', channelID: msg.channel.id});
	}
};