const {article,proper} = require("../modules/lang");

module.exports = {
	help: cfg => "Unregister " + article(cfg) + " " + cfg.lang + "",
	usage: cfg =>  ["remove <name> - Unregister the named " + cfg.lang + " from your list"],
	permitted: () => true,
	execute: (bot, msg, args, cfg) => {
		let out = "";
		args = bot.getMatches(msg.content,/['](.*?)[']|(\S+)/gi).slice(1);
		let name = args.join(" ");
		if(!args[0]) {
			return bot.cmds.help.execute(bot, msg, ["remove"], cfg);
		} else if(!bot.tulpae[msg.author.id]) {
			out = "You do not have any " + cfg.lang + "s registered.";
		} else if(!bot.tulpae[msg.author.id].find(t => t.name.toLowerCase() == name.toLowerCase())) {
			out = "Could not find " + cfg.lang + " with that name registered under your account.";
		} else {
			out = proper(cfg.lang) + " unregistered.";
			let arr = bot.tulpae[msg.author.id];
			let tul = arr.find(t => t.name.toLowerCase() == name.toLowerCase());
			/*if(tul.roles) {
					Object.keys(tul.roles).filter(id => bot.config[id].rolesEnabled).forEach(id => {
						if(bot.guilds.get(id).roles.has(tul.roles[id]))
							bot.deleteRole(id,tul.roles[id]);
					});
				}*/
			arr.splice(arr.indexOf(tul), 1);
		}
		bot.send(msg.channel, out);
	}
};