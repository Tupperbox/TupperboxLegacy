const {article,proper} = require("../modules/lang");

module.exports = {
	help: cfg => "Register a new " + cfg.lang + "",
	usage: cfg =>  ["register <name> <brackets> - Register a new " + cfg.lang + ".\n\t<name> - the " + cfg.lang + "'s name, for multi-word names surround this argument in single or double quotes.\n\t<brackets> - the word 'text' surrounded by any characters on one or both sides"],
	desc: cfg => "Upload an image when using this command to quickly set that image as the avatar!\n\nExample use: `register Test >text<` - registers " + article(cfg) + " " + cfg.lang + " named 'Test' that is triggered by messages surrounded by ><\nBrackets can be anything, one sided or both. For example `text<<` and `T:text` are both valid\nNote that you can enter multi-word names by surrounding the full name in single or double quotes `'like this'` or `\"like this\"`.",
	permitted: () => true,
	groupArgs: true,
	execute: async (bot, msg, args, cfg) => {
		if(!args[0]) return bot.cmds.help.execute(bot, msg, ["register"], cfg);

		//check arguments
		// let content = msg.content.replace("tul!register ","");
		let brackets = msg.content.slice(msg.content.indexOf(args[0], msg.content.indexOf("register")+8)+args[0].length+1).trim().split("text");
		let name = bot.sanitizeName(args[0]);
		let member = (await bot.db.query("SELECT name,brackets FROM Members WHERE user_id = $1::VARCHAR(32) AND (LOWER(name) = LOWER($2::VARCHAR(32)) OR brackets = $3)",[msg.author.id,name,brackets || []])).rows[0];
		if(!args[1]) return "Missing argument 'brackets'. Try `" + cfg.prefix + "help register` for usage details.";
		if(name.length < 1 || name.length > 76)	return "Name must be between 1 and 76 characters.";
		if(brackets.length < 2)	return "No 'text' found to detect brackets with. For the last part of your command, enter the word 'text' surrounded by any characters.\nThis determines how the bot detects if it should replace a message.";
		if(!brackets[0] && !brackets[1]) return "Need something surrounding 'text'.";
		if(member && member.name.toLowerCase() == name.toLowerCase())	return proper(cfg.lang) + " with that name under your user account already exists.";
		if(member && member.brackets[0] == brackets[0] && member.brackets[1] == brackets[1]) return proper(cfg.lang) + " with those brackets under your user account already exists.";
		let avatar = msg.attachments[0] ? msg.attachments[0].url : "https://i.imgur.com/ZpijZpg.png";

		//add member
		await bot.db.addMember(msg.author.id,{name,avatarURL:avatar,brackets:brackets.slice(0,2)});
		return {
			content: `${proper(cfg.lang)} registered!`,
			embed: {
				title: name,
				description: `**Brackets:**\t${brackets[0]}text${brackets[1]}\n**Avatar URL:**\t${avatar}\n\nSample usage: \`${brackets[0]}hello${brackets[1]}\``,
				footer: {
					text: 'If the brackets look wrong, try re-registering using "quotation marks" around the name!'
				}
			}
		};
	}
};
