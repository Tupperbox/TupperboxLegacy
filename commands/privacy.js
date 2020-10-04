const fs = require("fs").promises;
let policy = null;
fs.readFile("./privacy.txt").then(file => policy = file.toString()).catch((err) => { if(err.code != "ENOENT") console.warn(err); });

module.exports = {
	help: cfg => "View my privacy policy.",
	usage: cfg => ["privacy - show the privacy policy"],
	permitted: msg => true,
	execute: (bot, msg, args, cfg) => {
		return policy;
	}
};
