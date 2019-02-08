const {article,proper} = require("../modules/lang");

module.exports = {
	help: cfg => "Register a new " + cfg.lang + "",
	usage: cfg =>  ["register <name> <brackets> - Register a new " + cfg.lang + ".\n\t<name> - the " + cfg.lang + "'s name, for multi-word names surround this argument in `''`\n\t<brackets> - the word 'text' surrounded by any characters on one or both sides"],
	desc: cfg => "Example use: `register Test >text<` - registers " + article(cfg) + " " + cfg.lang + " named 'Test' that is triggered by messages surrounded by ><\nBrackets can be anything, one sided or both. For example `text<<` and `T:text` are both valid\nNote that you can enter multi-word names by surrounding the full name in apostrophes `''`.",
	permitted: () => true,
	groupArgs: true,
	execute: async (bot, msg, args, cfg) => {
		let out = "";
		let brackets;
		if(args[0])
			brackets = msg.content.slice(msg.content.indexOf(args[0])+args[0].length+1).trim().split("text");
		if(!args[0]) {
			return bot.cmds.help.execute(bot, msg, ["register"], cfg);
		}
		let tulpa = (await bot.db.query('SELECT name,brackets FROM Members WHERE user_id = $1::VARCHAR(32) AND (LOWER(name) = LOWER($2::VARCHAR(32)) OR brackets = $3)',[msg.author.id,args[0],brackets || []])).rows[0];
		if(!args[1]) {
			out = "Missing argument 'brackets'. Try `" + cfg.prefix + "help register` for usage details.";
		} else if(args[0].length < 2 || args[0].length > 28) {
			out = "Name must be between 2 and 28 characters.";
		} else if(brackets.length < 2) {
			out = "No 'text' found to detect brackets with. For the last part of your command, enter the word 'text' surrounded by any characters.\nThis determines how the bot detects if it should replace a message.";
		} else if(!brackets[0] && !brackets[1]) {
			out = "Need something surrounding 'text'.";
		} else if(tulpa && tulpa.name.toLowerCase() == args[0].toLowerCase()) {
			out = proper(cfg.lang) + " with that name under your user account already exists.";
		} else if(tulpa && tulpa.brackets[0] == brackets[0] && tulpa.brackets[1] == brackets[1]) {
			out = proper(cfg.lang) + " with those brackets under your user account already exists.";
		} else {
			await bot.db.addTulpa(msg.author.id,args[0],brackets);
			out = proper(cfg.lang) + " registered successfully!\nName: " + args[0] + "\nBrackets: " + `${brackets[0]}text${brackets[1]}` + "\nUse `" + cfg.prefix + "rename`, `" + cfg.prefix + "brackets`, and `" + cfg.prefix + "avatar` to set/update your " + cfg.lang + "'s info."; 
		}
		bot.send(msg.channel, out);
	}
};