const {article,proper} = require("../modules/lang");

module.exports = {
	help: cfg => "Remove or change " + article(cfg) + " " + cfg.lang + "'s tag (displayed next to name when proxying)",
	usage: cfg => ["tag <name> [tag] - if tag is given, change the " + cfg.lang + "'s tag, if not, show the current one.",
		"tag [name] clear/remove/none/delete - Unset a tag for the given " + cfg.lang + ".",
		"tag * - clear tag for all " + cfg.lang + "s"],
	desc: cfg => proper(article(cfg)) + " " + cfg.lang + "'s tag is shown next to their name when speaking.",
	permitted: () => true,
	groupArgs: true,
	execute: async (bot, msg, args, cfg) => {
		if(!args[0]) return bot.cmds.help.execute(bot, msg, ["tag"], cfg);
		
		//check arguments & clear tag if empty
		if(args[0] == "*") {
			if(args[1]) return "Cannot mass assign tags due to name limits.";
			await bot.db.query("UPDATE Members SET tag = null WHERE user_id = $1", [msg.author.id]);
			return "Tag cleared for all " + cfg.lang + "s.";
		}
		let member = await bot.db.getMember(msg.author.id,args[0]);
		if(!member) return "You don't have " + article(cfg) + " " + cfg.lang + " with that name registered.";
		if(!args[1]) return member.tag ? "Current tag: " + member.tag + "\nTo remove it, try " + cfg.prefix + "tag " + member.name + " clear" : "No tag currently set for " + args[0];
		if(["clear","remove","none","delete"].includes(args[1])) {
			await bot.db.updateMember(msg.author.id,member.name,"tag",null);
			return "Tag cleared.";
		}
		if (args.slice(1).join(" ").length > 25) return "That tag is too long. Please use one with less than 25 characters.";
		
		//update member
		await bot.db.updateMember(msg.author.id,args[0],"tag",bot.noVariation(args.slice(1).join(" ")));
		return "Tag updated successfully.";
	}
};