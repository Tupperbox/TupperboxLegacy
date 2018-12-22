const {article,proper} = require("../modules/lang");

module.exports = {
		help: cfg => "Toggles whether the brackets are included or stripped in proxied messages for the given " + cfg.lang,
		usage: cfg =>  ["togglebrackets <name> - toggles showing brackets on or off for the given " + cfg.lang],
		permitted: () => true,
		execute: (bot, msg, args, cfg) => {
			let out = "";
			args = bot.getMatches(msg.content,/['](.*?)[']|(\S+)/gi).slice(1);
			if(!args[0]) {
				return bot.cmds.help.execute(bot, msg, ["togglebrackets"], cfg);
			} else if(!bot.tulpae[msg.author.id] || !bot.tulpae[msg.author.id].find(t => t.name.toLowerCase() == args[0].toLowerCase())) {
				out = "You don't have " + article(cfg) + " " + cfg.lang + " with that name registered.";
			} else {
				let tup = bot.tulpae[msg.author.id].find(t => t.name.toLowerCase() == args[0].toLowerCase());
				if(!tup.showbrackets) tup.showbrackets = false;
				tup.showbrackets = !tup.showbrackets;
				out = `Now ${tup.showbrackets ? "showing" : "hiding"} brackets in proxied messages for ${tup.name}.`;
			}
			bot.send(msg.channel, out);
		}
	};