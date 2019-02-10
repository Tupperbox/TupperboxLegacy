const {article,proper} = require("../modules/lang");

module.exports = {
	help: cfg => "View or change " + article(cfg) + " " + cfg.lang + "'s description",
	usage: cfg =>  ["describe <name> [desc] - if desc is specified, change the " + cfg.lang + "'s describe, if not, simply echo the current one"],
	permitted: () => true,
	groupArgs: true,
	execute: async (bot, msg, args, cfg) => {
		if(!args[0]) return bot.cmds.help.execute(bot, msg, ["describe"], cfg);
		
		//check arguments
		let tulpa = await bot.db.getTulpa(msg.author.id,args[0]);
		if(!tulpa) return "You don't have " + article(cfg) + " " + cfg.lang + " with that name registered.";
		if(!args[1]) return "Current description: " + tulpa.description;
		
		//update tulpa
		let desc = args.slice(1).join(" ");
		await bot.db.updateTulpa(msg.author.id,args[0],"description",desc.slice(0,700));
		if(desc.length > 700) return "Description updated, but was truncated due to Discord embed limits.";
		return "Description updated successfully.";
	}
};