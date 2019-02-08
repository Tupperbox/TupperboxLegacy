const {article,proper} = require("../modules/lang");

module.exports = {
	help: cfg => "Remove or change " + article(cfg) + " " + cfg.lang + "'s tag (displayed next to name when proxying)",
	usage: cfg => ["tag <name> [tag] - if tag is given, change the " + cfg.lang + "'s tag, if not, clear the tag"],
	desc: cfg => proper(article(cfg)) + " " + cfg.lang + "'s tag is shown next to their name when speaking.",
	permitted: () => true,
	groupArgs: true,
	execute: async (bot, msg, args, cfg) => {
		let out = "";
		if(!args[0]) {
			return bot.cmds.help.execute(bot, msg, ["tag"], cfg);
		} 
		let tulpa = await bot.db.getTulpa(msg.author.id,args[0]);
		if(!tulpa) {
			out = "You don't have " + article(cfg) + " " + cfg.lang + " with that name registered.";
		} else if(!args[1]) {
			await bot.db.updateTulpa(msg.author.id,args[0],"tag",null);
			out = "Tag cleared.";
		} else if (args.slice(1).join(" ").length + tulpa.name.length > 27) {
			out = "That tag is too long to use with that " + cfg.lang + "'s name. The combined total must be less than 28 characters.";
		} else {
			await bot.db.updateTulpa(msg.author.id,args[0],"tag",args.slice(1).join(" "));
			out = "Tag updated successfully.";
		}
		bot.send(msg.channel, out);
	}
};