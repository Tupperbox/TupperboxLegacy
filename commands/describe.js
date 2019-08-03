const {article,proper} = require("../modules/lang");

module.exports = {
	help: cfg => "View or change " + article(cfg) + " " + cfg.lang + "'s description",
	usage: cfg =>  ["describe <name> [desc] - if desc is specified, change the " + cfg.lang + "'s describe, if not, simply echo the current one",
		"describe [name] clear/remove/none/delete - Unset a description for the given " + cfg.lang + "."],
	permitted: () => true,
	groupArgs: true,
	execute: async (bot, msg, args, cfg) => {
		if(!args[0]) return bot.cmds.help.execute(bot, msg, ["describe"], cfg);
		
		//check arguments
		let tulpa = await bot.db.getTulpa(msg.author.id,args[0]);
		if(!tulpa) return "You don't have " + article(cfg) + " " + cfg.lang + " with that name registered.";
		if(!args[1]) return tulpa.description ? "Current description: " + tulpa.description + "\nTo remove it, try " + cfg.prefix + "describe " + tulpa.name + " clear" : "No description currently set for " + tulpa.name;
		if(["clear","remove","none","delete"].includes(args[1])) {
			await bot.db.updateTulpa(msg.author.id,tulpa.name,"description",null);
			return "Description cleared.";
		}
		
		//update tulpa
		let desc = args.slice(1).join(" ");
		await bot.db.updateTulpa(msg.author.id,args[0],"description",desc.slice(0,1023));
		if(desc.length > 1023) return "Description updated, but was truncated due to Discord embed limits.";
		return "Description updated successfully.";
	}
};