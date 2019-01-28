const validUrl = require("valid-url");
const request = require("got");
const {article,proper} = require("../modules/lang");

module.exports = {
	help: cfg => "View or change " + article(cfg) + " " + cfg.lang + "'s avatar",
	usage: cfg =>  ["avatar <name> [url] - if url is specified, change the " + cfg.lang + "'s avatar, if not, simply echo the current one"],
	permitted: () => true,
	desc: cfg => "The specified URL must be a direct link to an image - that is, the URL should end in .jpg or .png or another common image filetype. Also, it can't be over 1mb in size, as Discord doesn't accept images over this size as webhook avatars.",
	execute: (bot, msg, args, cfg) => {
		let out = "";
		args = bot.getMatches(msg.content,/['](.*?)[']|(\S+)/gi).slice(1);
		if(!args[0]) {
			return bot.cmds.help.execute(bot, msg, ["avatar"], cfg);
		} else if(!bot.tulpae[msg.author.id] || !bot.tulpae[msg.author.id].find(t => t.name.toLowerCase() == args[0].toLowerCase())) {
			out = "You don't have " + article(cfg) + " " + cfg.lang + " with that name registered.";
		} else if(!args[1]) {
			out = bot.tulpae[msg.author.id].find(t => t.name.toLowerCase() == args[0].toLowerCase()).url;
		} else if(!validUrl.isWebUri(args[1])) {
			out = "Malformed url.";
		} else {
			request.head(args[1]).then(res => {
				if(!res.headers["content-type"] || !res.headers["content-type"].startsWith("image")) return bot.send(msg.channel, "I couldn't find an image at that URL. Make sure it's a direct link (ends in .jpg or .png for example).");
				if(Number(res.headers["content-length"]) > 1000000) {
					return bot.send(msg.channel, "That image is too large and Discord will not accept it. Please use an image under 1mb.");
				}
				bot.tulpae[msg.author.id].find(t => t.name.toLowerCase() == args[0].toLowerCase()).url = args[1];
				bot.send(msg.channel, "Avatar changed successfully.");
			}).catch(err => bot.send(msg.channel, "I couldn't find an image at that URL. Make sure it's a direct link (ends in .jpg or .png for example)."));
			return;
		}
		bot.send(msg.channel, out);
	}
};