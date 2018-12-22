module.exports = {
	help: cfg => "Show the user that registered the " + cfg.lang + " that last spoke",
	usage: cfg =>  ["showuser - Finds the user that registered the " + cfg.lang + " that last sent a message in this channel"],
	permitted: (msg) => true,
	execute: (bot, msg, args, cfg) => {
		if(!bot.recent[msg.channel.id]) bot.send(msg.channel, "No " + cfg.lang + "s have spoken in this channel since I last started up, sorry.");
		else {
			let user = bot.users.get(bot.recent[msg.channel.id].userID);
			bot.send(msg.channel, `Last ${cfg.lang} message sent by ${bot.recent[msg.channel.id].tulpa.name}, registered to ${user ? user.username + "#" + user.discriminator : "(unknown user " + bot.recent[msg.channel.id].userID + ")"}`);
		}
	}
};