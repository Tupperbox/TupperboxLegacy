const {article,proper} = require("../modules/lang");

module.exports = {
	help: cfg => "View or change " + article(cfg) + " " + cfg.lang + "'s description",
	usage: cfg =>  ["describe <name> [desc] - if desc is specified, change the " + cfg.lang + "'s describe, if not, simply echo the current one"],
	permitted: () => true,
	execute: (bot, msg, args, cfg) => {
		let out = "";
		args = bot.getMatches(msg.content,/['](.*?)[']|(\S+)/gi).slice(1);
		if(!args[0]) {
			return bot.cmds.help.execute(bot, msg, ["describe"], cfg);
		} else if(!bot.tulpae[msg.author.id] || !bot.tulpae[msg.author.id].find(t => t.name.toLowerCase() == args[0].toLowerCase())) {
			out = "You don't have " + article(cfg) + " " + cfg.lang + " with that name registered.";
		} else if(!args[1]) {
			out = "Current description: " + bot.tulpae[msg.author.id].find(t => t.name.toLowerCase() == args[0].toLowerCase()).desc;
		} else {
			let desc = args.slice(1).join(" ");
			if(desc.length > 700) out = "Description updated, but was truncated due to Discord embed limits.";
			else out = "Description updated successfully.";
			bot.tulpae[msg.author.id].find(t => t.name.toLowerCase() == args[0].toLowerCase()).desc = desc.slice(0,700);
		}
		bot.send(msg.channel, out);
	}
};