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
		let member = await bot.db.getMember(msg.author.id,args[0]);
		if(!member) return "You don't have " + article(cfg) + " " + cfg.lang + " with that name registered.";
		if(!args[1]) return member.description ? "Current description: " + member.description + "\nTo remove it, try " + cfg.prefix + "describe " + member.name + " clear" : "No description currently set for " + member.name;
		if(["clear","remove","none","delete"].includes(args[1])) {
			await bot.db.updateMember(msg.author.id,member.name,"description",null);
			return "Description cleared.";
		}
		
		//update member
		let temp = msg.content.slice(msg.content.indexOf(args[0]) + args[0].length);
		let desc = temp.slice(temp.indexOf(args[1]));
		await bot.db.updateMember(msg.author.id,args[0],"description",desc.slice(0,1023));
		if(desc.length > 1023) return "Description updated, but was truncated due to Discord embed limits.";
		return "Description updated successfully.";
	}
};