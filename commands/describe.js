const {article,proper} = require("../modules/lang");

module.exports = {
	help: cfg => "View or change " + article(cfg) + " " + cfg.lang + "'s description",
	usage: cfg =>  ["describe <name> [desc] - if desc is specified, change the " + cfg.lang + "'s describe, if not, simply echo the current one"],
	permitted: () => true,
	groupArgs: true,
	execute: async (bot, msg, args, cfg) => {
		let out = "";
		if(!args[0]) {
			return bot.cmds.help.execute(bot, msg, ["describe"], cfg);
		}
		let tulpa = await bot.db.getTulpa(msg.author.id,args[0]);
		if(!tulpa) {
			out = "You don't have " + article(cfg) + " " + cfg.lang + " with that name registered.";
		} else if(!args[1]) {
			out = "Current description: " + tulpa.description;
		} else {
			let desc = args.slice(1).join(" ");
			await bot.db.updateTulpa(msg.author.id,args[0],"description",desc.slice(0,700));
			if(desc.length > 700) out = "Description updated, but was truncated due to Discord embed limits.";
			else out = "Description updated successfully.";
		}
		bot.send(msg.channel, out);
	}
};