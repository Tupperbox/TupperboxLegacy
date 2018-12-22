const {article} = require("../modules/lang");

module.exports = {
		help: cfg => "Print this message, or get help for a specific command",
		usage: cfg =>  ["help - print list of commands", 
			"help [command] - get help on a specific command"],
		permitted: () => true,
		execute: (bot, msg, args, cfg) => {
			let output = "";
			if(args[0]) { //help for a specific command
				if(bot.cmds[args[0]] && bot.checkPermissions(args[0],msg,args) && bot.cmds[args[0]].usage) {
					output = { embed: {
						title: "Bot Command | " + args[0],
						description: bot.cmds[args[0]].help(cfg) + "\n\n**Usage:**\n",
						timestamp: new Date().toJSON(),
						color: 0x999999,
						author: {
							name: "Tupperware",
							icon_url: bot.user.avatarURL
						},
						footer: {
							text: "If something is wrapped in <> or [], do not include the brackets when using the command. They indicate whether that part of the command is required <> or optional []."
						}
					}};
					for(let u of bot.cmds[args[0]].usage(cfg))
						output.embed.description += `${cfg.prefix + u}\n`;
					if(bot.cmds[args[0]].desc)
						output.embed.description += `\n${bot.cmds[args[0]].desc(cfg)}`;
				} else output += "Command not found.";
			} else { //general help
				output = { embed: {
					title: "Tupperware | Help",
					description: "I am Tupperware, a bot made to give " + cfg.lang + "s a voice using Discord webhooks.\nTo get started, register " + article(cfg) + " " + cfg.lang + " with `" + cfg.prefix + "register` and enter a message with the brackets you set!\n\n**Command List**\nType `"+cfg.prefix+"help command` for detailed help on a command.\n" + String.fromCharCode(8203) + "\n",
					timestamp: new Date().toJSON(),
					color: 0x999999,
					author: {
						name: "Tupperware",
						icon_url: bot.user.avatarURL
					},
					footer: {
						text: "By Keter#1730"
					}
				}};
				for(let cmd of Object.keys(bot.cmds)) {
					if(bot.cmds[cmd].help && bot.cmds[cmd].permitted(msg,args))
						output.embed.description += `**${cfg.prefix + cmd}**  -  ${bot.cmds[cmd].help(cfg)}\n`;
				}
			}
			bot.send(msg.channel, output);
		}
	};