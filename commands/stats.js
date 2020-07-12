const util = require("util");

module.exports = {
	help: cfg => "Show info about the bot.",
	usage: cfg => ["stats - Show list of technical info about the bot's status"],
	desc: cfg =>  "Displays a list of useful technical information about the bot's running processes. Lists technical details of all clusters, useful for monitoring recent outages and the progress of ongoing restarts. Displays the total memory usage and allocation of the bot, along with how many servers the bot is serving. Displays which shard is currently supporting this server and which cluster that shard is a part of.",
	permitted: msg => true,
	execute: (bot, msg, args, cfg) => {
		process.send({name: "postStats", channelID: msg.channel.id, shard: msg.channel.guild ? msg.channel.guild.shard.id : 0});
	}
};
