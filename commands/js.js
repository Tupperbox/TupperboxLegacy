const util = require("util");
const auth = require("../auth.json");

module.exports = {
		permitted: (msg) => { return msg.author.id === auth.owner; },
		execute: (bot, msg, args, cfg) => {
			if(msg.author.id != auth.owner) return;
			let message = msg.content.substr(7);
			let out = "";
			try {
				out = eval(message);
			} catch(e) {
				out = e.toString();
			}
			bot.send(msg.channel, util.inspect(out).slice(0,2000));
		}
	};