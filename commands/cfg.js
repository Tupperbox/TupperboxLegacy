const {article,proper} = require("../modules/lang");

module.exports = {
	help: cfg => "Configure server-specific settings",
	usage: cfg =>  ["cfg prefix <newPrefix> - Change the bot's prefix.",
		"cfg rename <newname> - Change all instances of the default name 'member' in bot replies in this server to the specified term.",
		"cfg log [channel] - Enable the bot to send a log of all " + cfg.lang + " messages and some basic info like who registered them. Useful for having a searchable channel and for distinguishing between similar names. To disable logging, run with no channel argument.",
		"cfg blacklist <add|remove> <channel(s)> - Add or remove channels to the bot's proxy blacklist - users will be unable to proxy in blacklisted channels.",
		"cfg cmdblacklist <add|remove> <channel(s)> - Add or remove channels to the bot's command blacklist - users will be unable to issue commands in blacklisted channels."],
		
	permitted: (msg) => (msg.member && msg.member.permission.has("administrator")),
	execute: async (bot, msg, args, cfg) => {
		if(msg.channel.type == 1) return "This command cannot be used in private messages.";

		let gid = msg.channel.guild.id;
		let channels, out;
		switch(args[0]) {
		case "prefix":
			if(!args[1]) return "Missing argument 'prefix'.";
			let prefix = args.slice(1).join(" ");

			await bot.db.config.update(gid,"prefix",prefix,bot.defaultCfg);
			return "Prefix changed to " + prefix + "\nThis means that all commands must now be preceded by your chosen prefix rather than `tul!`. If this was changed by mistake, run `" + prefix + "cfg prefix tul!` to return to default behavior.";

		case "roles":
			return "This feature has been disabled indefinitely.";

		case "rename":
			if(!args[1]) return "Missing argument 'newname'";
			let lang = args.slice(1).join(" ");
			await bot.db.config.update(gid,"lang",lang,bot.defaultCfg);
			return "Entity name changed to " + lang;

		case "log":
			if(!args[1]) {
				await bot.db.config.update(gid,"log_channel",null,bot.defaultCfg);
				return "Logging channel unset. Logging is now disabled.";
			}
			let channel = bot.resolveChannel(msg,args[1]);
			if(!channel) return "Channel not found.";
			await bot.db.config.update(gid,"log_channel",channel.id,bot.defaultCfg);
			return `Logging channel set to <#${channel.id}>`;					

		case "blacklist":
			if(!args[1]) {
				let blacklist = (await bot.db.blacklist.get(gid)).filter(bl => bl.is_channel && bl.block_proxies);
				if(blacklist[0]) return `Currently blacklisted channels: ${blacklist.map(bl => "<#"+bl.id+">").join(" ")}`;
				return "No channels currently blacklisted.";
			}
			switch(args[1]) {
			case "add":
				if(!args[2]) return "Must provide name/mention/id of channel to blacklist.";
				channels = args.slice(2).map(arg => bot.resolveChannel(msg,arg)).map(ch => { if(ch) return ch.id; else return ch; });
				if(!channels.find(ch => ch != undefined)) return `Could not find ${channels.length > 1 ? "those channels" : "that channel"}.`;
				if(channels.some(ch => ch == undefined)) {
					out = "Could not find these channels: ";
					for(let i = 0; i < channels.length; i++)
						if(!channels[i]) out += args.slice(2)[i];
					return out;
				}
				for(let i=0; i<channels.length; i++) await bot.db.blacklist.update(gid,channels[i],true,true,null);
				return `Channel${channels.length > 1 ? "s" : ""} blacklisted successfully.`;
						
			case "remove":
				if(!args[2]) return "Must provide name/mention/id of channel to allow.";
				channels = args.slice(2).map(arg => bot.resolveChannel(msg,arg)).map(ch => { if(ch) return ch.id; else return ch; });
				if(!channels.find(ch => ch != undefined)) return `Could not find ${channels.length > 1 ? "those channels" : "that channel"}.`;
				if(channels.some(ch => ch == undefined)) {
					out = "Could not find these channels: ";
					for(let i = 0; i < channels.length; i++)
						if(!channels[i]) out += args.slice(2)[i] + " ";
					return out;
				}
				for(let i=0; i<channels.length; i++) await bot.db.blacklist.update(gid,channels[i],true,false,null);
				return `Channel${channels.length > 1 ? "s" : ""} removed from blacklist.`;

			default:
				return "Invalid argument: must be 'add' or 'remove'";
			}

		case "cmdblacklist":
			if(!args[1]) {
				let blacklist = (await bot.db.blacklist.get(gid)).filter(bl => bl.is_channel && bl.block_commands);
				if(blacklist[0]) return `Currently blacklisted channels: ${blacklist.map(bl => "<#"+bl.id+">").join(" ")}`;
				return "No channels currently cmdblacklisted.";
			}
			switch(args[1]) {
			case "add":
				if(!args[2]) return "Must provide name/mention/id of channel to cmdblacklist.";
				channels = args.slice(2).map(arg => bot.resolveChannel(msg,arg)).map(ch => { if(ch) return ch.id; else return ch; });
				if(!channels.find(ch => ch != undefined)) return `Could not find ${channels.length > 1 ? "those channels" : "that channel"}.`;
				if(channels.some(ch => ch == undefined)) {
					out = "Could not find these channels: ";
					for(let i = 0; i < channels.length; i++)
						if(!channels[i]) out += args.slice(2)[i];
					return out;
				}
				for(let i=0; i<channels.length; i++) await bot.db.blacklist.update(gid,channels[i],true,null,true);
				return `Channel${channels.length > 1 ? "s" : ""} blacklisted successfully.`;
						
			case "remove":
				if(!args[2]) return "Must provide name/mention/id of channel to allow.";
				channels = args.slice(2).map(arg => bot.resolveChannel(msg,arg)).map(ch => { if(ch) return ch.id; else return ch; });
				if(!channels.find(ch => ch != undefined)) return `Could not find ${channels.length > 1 ? "those channels" : "that channel"}.`;
				if(channels.some(ch => ch == undefined)) {
					out = "Could not find these channels: ";
					for(let i = 0; i < channels.length; i++)
						if(!channels[i]) out += args.slice(2)[i] + " ";
					return out;
				}
				for(let i=0; i<channels.length; i++) await bot.db.blacklist.update(gid,channels[i],true,null,false);
				return `Channel${channels.length > 1 ? "s" : ""} removed from cmdblacklist.`;

			default:
				return "Invalid argument: must be 'add' or 'remove'";
			}

		default:
			return bot.cmds.help.execute(bot, msg, ["cfg"], cfg);
		}
	}
};
