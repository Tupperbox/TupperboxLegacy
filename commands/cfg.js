const {article,proper} = require("../modules/lang");

module.exports = {
	help: cfg => "Configure server-specific settings",
	usage: cfg =>  ["cfg prefix <newPrefix> - Change the bot's prefix",
		"cfg rename <newname> - Change all instances of the default name 'tulpa' in bot replies in this server to the specified term",
		"cfg log <channel> - Enable the bot to send a log of all " + cfg.lang + " messages and some basic info like who registered them. Useful for having a searchable channel and for distinguishing between similar names.",
		"cfg blacklist <add|remove> <channel(s)> - Add or remove channels to the bot's proxy blacklist - users will be unable to proxy in blacklisted channels.",
		"cfg cmdblacklist <add|remove> <channel(s)> - Add or remove channels to the bot's command blacklist - users will be unable to issue commands in blacklisted channels."],
		
	permitted: (msg) => (msg.member && msg.member.permission.has("administrator")),
	execute: async (bot, msg, args, cfg) => {
		let out = "";
		let gid = msg.channel.guild.id;
		if(msg.channel.type == 1) {
			out = "This command cannot be used in private messages.";
		} else if(!args[0] || !["prefix","roles","rename","log","blacklist","cmdblacklist"].includes(args[0])) {
			return bot.cmds.help.execute(bot, msg, ["cfg"], cfg);
		} else if(args[0] == "prefix") {
			if(!args[1]) {
				out = "Missing argument 'prefix'.";
			} else {
				let prefix = args.slice(1).join(' ');
				bot.db.updateCfg(gid,'prefix',prefix);
				out = "Prefix changed to " + prefix;
			}
		} else if(args[0] == "roles") {
			out = "This feature has been disabled indefinitely.";
		} else if(args[0] == "rename") {
			if(!args[1]) {
				out = "Missing argument 'newname'";
			} else {
				let lang = args.slice(1).join(" ");
				bot.db.updateCfg(gid,'lang',lang);
				out = "Entity name changed to " + lang;
			}
		} else if(args[0] == "log") {
			if(!args[1]) {
				out = "Logging channel unset. Logging is now disabled.";
				bot.db.updateCfg(gid,'log_channel',null);
			} else {
				let channel = bot.resolveChannel(msg,args[1]);
				if(!channel) {
					out = "Channel not found.";
				} else {
					out = `Logging channel set to <#${channel.id}>`;
					bot.db.updateCfg(gid,'log_channel',channel.id);
				}
			}
		} else if(args[0] == "blacklist") {
			if(!args[1]) {
				let blacklist = (await bot.db.getBlacklist(gid)).filter(bl => bl.is_channel && bl.block_proxies);
				if(blacklist[0]) out = `Currently blacklisted channels: ${blacklist.map(bl => "<#"+bl.id+">").join(" ")}`;
				else out = "No channels currently blacklisted.";
			} else if(args[1] == "add") {
				if(!args[2]) {
					out = "Must provide name/mention/id of channel to blacklist.";
				} else {
					let channels = args.slice(2).map(arg => bot.resolveChannel(msg,arg)).map(ch => { if(ch) return ch.id; else return ch; });
					if(!channels.find(ch => ch != undefined)) {
						out = `Could not find ${channels.length > 1 ? "those channels" : "that channel"}.`;
					} else if(channels.find(ch => ch == undefined)) {
						out = "Could not find these channels: ";
						for(let i = 0; i < channels.length; i++)
							if(!channels[i]) out += args.slice(2)[i];
					} else {
						for(let i=0; i<channels.length; i++) await bot.db.updateBlacklist(gid,channels[i],true,true,null);
						out = `Channel${channels.length > 1 ? "s" : ""} blacklisted successfully.`;
					}
				}
			} else if(args[1] == "remove") {
				if(!args[2]) {
					out = "Must provide name/mention/id of channel to allow.";
				} else {
					let channels = args.slice(2).map(arg => bot.resolveChannel(msg,arg)).map(ch => { if(ch) return ch.id; else return ch; });
					if(!channels.find(ch => ch != undefined)) {
						out = `Could not find ${channels.length > 1 ? "those channels" : "that channel"}.`;
					} else if(channels.find(ch => ch == undefined)) {
						out = "Could not find these channels: ";
						for(let i = 0; i < channels.length; i++)
							if(!channels[i]) out += args.slice(2)[i] + " ";
					} else {
						for(let i=0; i<channels.length; i++) await bot.db.updateBlacklist(gid,channels[i],true,false,null);
						out = `Channel${channels.length > 1 ? "s" : ""} removed from blacklist.`;
					}
				}
			} else {
				out = "Invalid argument: must be 'add' or 'remove'";
			}
		} else if(args[0] == "cmdblacklist") {
			if(!args[1]) {
				let blacklist = (await bot.db.getBlacklist(gid)).filter(bl => bl.is_channel && bl.block_commands);
				if(blacklist[0]) out = `Currently blacklisted channels: ${blacklist.map(bl => "<#"+bl.id+">").join(" ")}`;
				else out = "No channels currently cmdblacklisted.";
			} else if(args[1] == "add") {
				if(!args[2]) {
					out = "Must provide name/mention/id of channel to cmdblacklist.";
				} else {
					let channels = args.slice(2).map(arg => bot.resolveChannel(msg,arg)).map(ch => { if(ch) return ch.id; else return ch; });
					if(!channels.find(ch => ch != undefined)) {
						out = `Could not find ${channels.length > 1 ? "those channels" : "that channel"}.`;
					} else if(channels.find(ch => ch == undefined)) {
						out = "Could not find these channels: ";
						for(let i = 0; i < channels.length; i++)
							if(!channels[i]) out += args.slice(2)[i];
					} else {
						for(let i=0; i<channels.length; i++) await bot.db.updateBlacklist(gid,channels[i],true,null,true);
						out = `Channel${channels.length > 1 ? "s" : ""} blacklisted successfully.`;
					}
				}
			} else if(args[1] == "remove") {
				if(!args[2]) {
					out = "Must provide name/mention/id of channel to allow.";
				} else {
					let channels = args.slice(2).map(arg => bot.resolveChannel(msg,arg)).map(ch => { if(ch) return ch.id; else return ch; });
					if(!channels.find(ch => ch != undefined)) {
						out = `Could not find ${channels.length > 1 ? "those channels" : "that channel"}.`;
					} else if(channels.find(ch => ch == undefined)) {
						out = "Could not find these channels: ";
						for(let i = 0; i < channels.length; i++)
							if(!channels[i]) out += args.slice(2)[i] + " ";
					} else {
						for(let i=0; i<channels.length; i++) await bot.db.updateBlacklist(gid,channels[i],true,null,false);
						out = `Channel${channels.length > 1 ? "s" : ""} removed from cmdblacklist.`;
					}
				}
			} else {
				out = "Invalid argument: must be 'add' or 'remove'";
			}
		}

		bot.send(msg.channel, out);
	}
};