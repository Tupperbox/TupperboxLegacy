module.exports = {
	help: cfg => "Show the user that registered the " + cfg.lang + " that last spoke",
	usage: cfg =>  ["showuser - Finds the user that registered the " + cfg.lang + " that last sent a message in this channel"],
	permitted: (msg) => true,
	execute: (bot, msg, args, cfg) => {
		if(!bot.recent[msg.channel.id])	return "No " + cfg.lang + "s have spoken in this channel since I last started up, sorry.";
		let recent = bot.recent[msg.channel.id][0];
		bot.send(msg.channel, { content: `That proxy was sent by <@!${recent.user_id}> (tag at time of sending: ${recent.tag} - id: ${recent.user_id}).`, allowedMentions: { users: false } });
	}
};