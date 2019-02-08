const {article,proper} = require("../modules/lang");

module.exports = {
	help: cfg => "Unregister " + article(cfg) + " " + cfg.lang + "",
	usage: cfg =>  ["remove <name> - Unregister the named " + cfg.lang + " from your list"],
	permitted: () => true,
	groupArgs: true,
	execute: async (bot, msg, args, cfg) => {
		let out = "";
		let name = args.join(" ");
		if(!args[0]) {
			return bot.cmds.help.execute(bot, msg, ["remove"], cfg);
		}
		let tulpa = await bot.db.getTulpa(msg.author.id,name);
		if(!tulpa) {
			out = "Could not find " + cfg.lang + " with that name registered under your account.";
		} else {
			await bot.db.deleteTulpa(msg.author.id,name);
			out = proper(cfg.lang) + " unregistered.";
		}
		bot.send(msg.channel, out);
	}
};