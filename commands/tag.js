const {article,proper} = require("../modules/lang");

module.exports = {
	help: cfg => "Remove or change " + article(cfg) + " " + cfg.lang + "'s tag (displayed next to name when proxying)",
	usage: cfg => ["tag <name> [tag] - if tag is given, change the " + cfg.lang + "'s tag, if not, clear the tag"],
	desc: cfg => proper(article(cfg)) + " " + cfg.lang + "'s tag is shown next to their name when speaking.",
	permitted: () => true,
	execute: (bot, msg, args, cfg) => {
		let out = "";
		args = bot.getMatches(msg.content.slice(cfg.prefix.length),/['](.*?)[']|(\S+)/gi).slice(1);
		if(!args[0]) {
			return bot.cmds.help.execute(bot, msg, ["tag"], cfg);
		} else if(!bot.tulpae[msg.author.id] || !bot.tulpae[msg.author.id].find(t => t.name.toLowerCase() == args[0].toLowerCase())) {
			out = "You don't have " + article(cfg) + " " + cfg.lang + " with that name registered.";
		} else if(!args[1]) {
			delete bot.tulpae[msg.author.id].find(t => t.name.toLowerCase() == args[0].toLowerCase()).tag;
			out = "Tag cleared.";
		} else if (args.slice(1).join(" ").length + bot.tulpae[msg.author.id].find(t => t.name.toLowerCase() == args[0].toLowerCase()).name.length > 27) {
			out = "That tag is too long to use with that " + cfg.lang + "'s name. The combined total must be less than 28 characters.";
		} else {
			bot.tulpae[msg.author.id].find(t => t.name.toLowerCase() == args[0].toLowerCase()).tag = args.slice(1).join(" ");
			out = "Tag updated successfully.";
		}
		bot.send(msg.channel, out);
	}
};