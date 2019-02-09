module.exports = {
	permitted: (msg) => { return msg.author.id === process.env.DISCORD_OWNERID; },
	execute: (bot, msg, args, cfg) => {
		if(msg.author.id != bot.owner) return;
		let message = msg.content.substr(7);
		let out = "";
		try {
			out = eval(message);
		} catch(e) {
			out = e.toString();
		}
		return bot.send(msg.channel, require("util").inspect(out).slice(0,2000));
	}
};