const auth = require("../auth.json");

module.exports = {
	permitted: (msg) => { return msg.author.id === auth.owner; },
	execute: (bot, msg, args, cfg) => {
		if(msg.author.id != auth.owner) return;
		for(let arg of args.slice(1)) {
			let path = `../${args[0]}s/${arg}`
			let fullPath = require.resolve(path);
			delete require.cache[fullPath];
			if(args[0] == "command") {
				bot.cmds[arg] = require(path);
			} else if(args[0] == "module") {
				switch(arg) {
					case "util":
						require("../modules/util")(bot);
						break;
					case "logger":
						bot.logger = require("../modules/logger");
						break;
				}
			}
			bot.send(msg.channel, `${arg} reloaded`);
		}
	}
};