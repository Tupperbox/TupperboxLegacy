const announcement = "";

module.exports = {
	help: cfg => "Get a detailed list of yours or another user's registered " + cfg.lang + "s",
	usage: cfg =>  ["list [user] - Sends a list of the user's registered " + cfg.lang + "s, their brackets, post count, and birthday (if set). If user is not specified it defaults to the message author. If 'all' or '*' is given, gives a short form list of all tuppers in the server."],
	permitted: () => true,
	execute: async (bot, msg, args, cfg) => {
		let out = "";
		if(args[0] == "all" || args[0] == "*") { //short list of all tuppers
			if(!msg.channel.guild) return bot.send(msg.channel, "Cannot retrieve server-wide list in DMs.");
			let tups = (await bot.db.query("SELECT * FROM Members WHERE user_id = ANY ($1) ORDER BY user_id, position", [msg.channel.guild.members.map(m => m.id)])).rows;
			let all = {};
			tups.forEach(t => {
				if(!all[t.user_id]) all[t.user_id] = [];
				all[t.user_id].push(t);
			});
			let embeds = [];
			let current = { embed: {
				title: `${tups.length} total registered ${cfg.lang}s in this server`,
				author: {
					name: msg.channel.guild.name,
					icon_url: msg.channel.guild.iconURL
				},
				fields: []
			}, content: announcement};
			let page = 1;
			Object.keys(all).forEach(id => {
				let user = bot.users.get(id);
				let field = {
					name: `${user.username}#${user.discriminator} (${all[id].length} registered)`,
					value: all[id].map(tul => tul.name).join(", ")
				};
				if(field.value.length > 1000) field.value = field.value.slice(0,1000) + "...";
				if(current.embed.fields.length < 5) {
					current.embed.fields.push(field);
				} else {
					embeds.push(current);
					page++;
					current = { embed: {
						title: `${tups.length} total registered ${cfg.lang}s in this server`,
						author: {
							name: msg.channel.guild.name,
							icon_url: msg.channel.guild.iconURL
						},
						fields: []
					}, content: announcement};
				}
			});
			embeds.push(current);
			out = embeds[0];
			if(page > 1) {
				for(let i = 0; i < embeds.length; i++) 
					embeds[i].embed.title += ` (page ${i+1}/${embeds.length})`;
				return bot.paginate(msg, embeds);
			}
			return bot.send(msg.channel, out);
		}
		let target;
		if(args[0]) {
			if(msg.channel.type == 1) return bot.send(msg.channel,"Cannot search for members in a DM.");
			else target = bot.resolveUser(msg, args.join(" "));
		} else {
			target = msg.author;
		}
		if(!target) {
			return bot.send(msg.channel,"User not found.");
		}
		let tulpae = (await bot.db.query("SELECT * FROM Members WHERE user_id = $1 ORDER BY position", [target.id])).rows;
		if(!tulpae[0]) {
			out = (target.id == msg.author.id) ? "You have not registered any " + cfg.lang + "s." : "That user has not registered any " + cfg.lang + "s.";
		} else {
			let embeds = [];
			let current = { embed: {
				title: `${target.username}#${target.discriminator}'s registered ${cfg.lang}s`,
				author: {
					name: target.username,
					icon_url: target.avatarURL
				},
				fields: []
			}, content: announcement};
			let page = 1;
			tulpae.forEach(t => {
				let field = bot.generateTulpaField(t);
				if(current.embed.fields.length < 5) {
					current.embed.fields.push(field);
				} else {
					embeds.push(current);
					page++;
					current = { embed: {
						title: `${target.username}#${target.discriminator}'s registered ${cfg.lang}s`,
						author: {
							name: target.username,
							icon_url: target.avatarURL
						},
						fields: [field]
					}, content: announcement};
				}
			});
			embeds.push(current);
			out = embeds[0];
			if(page > 1) {
				for(let i = 0; i < embeds.length; i++)
					embeds[i].embed.title += ` (page ${i+1}/${embeds.length}, ${tulpae.length} total)`;
				return bot.paginate(msg, embeds);
			}
				
		}
		bot.send(msg.channel, out);
	}
};