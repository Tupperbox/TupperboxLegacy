const auth = require("../auth.json");

module.exports = {
	permitted: (msg) => { return msg.author.id === auth.owner; },
	execute: (bot, msg, args, cfg) => {
		if(msg.author.id != auth.owner) return;
		for(let arg of args.slice(1)) {
			let path = `../${args[0]}s/${arg}`;
			let fullPath = require.resolve(path);
			if(args[0] == "command") {
				delete require.cache[fullPath];
				bot.cmds[arg] = require(path);
			} else if(args[0] == "module") {
				delete require.cache[fullPath];
				switch(arg) {
				case "util":
					require("../modules/util")(bot);
					break;
				case "logger":
					bot.logger = require("../modules/logger");
					break;
				}
			} else if(args[0] == "event") {
				bot.off(args[1], require(path));
				delete require.cache[fullPath];
				bot.on(args[1], require(path));
			}
			bot.send(msg.channel, `${arg} reloaded`);
		}
	}
};