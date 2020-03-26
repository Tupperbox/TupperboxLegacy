const util = require("util");

module.exports = {
	permitted: (msg) => { return msg.author.id === process.env.DISCORD_OWNERID; },
	execute: async (bot, msg, args, cfg) => {
		if(msg.author.id != bot.owner) return;
		let out;
		try {
			out = await eval(msg.content.slice(cfg.prefix.length + 2).trim());
		} catch(e) {
			out = e.toString();
		}
		return util.inspect(out).slice(0,2000);
	}
};