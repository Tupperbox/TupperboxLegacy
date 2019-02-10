const announcement = "";

module.exports = {
	help: cfg => "Get a detailed list of yours or another user's registered " + cfg.lang + "s",
	usage: cfg =>  ["list [user] - Sends a list of the user's registered " + cfg.lang + "s, their brackets, post count, and birthday (if set). If user is not specified it defaults to the message author. If 'all' or '*' is given, gives a short form list of all tuppers in the server."],
	permitted: () => true,
	execute: async (bot, msg, args, cfg) => {
		//short list of all tuppers in server
		if(args[0] == "all" || args[0] == "*") {
			if(!msg.channel.guild) return "Cannot retrieve server-wide list in DMs.";
			let tups = (await bot.db.query("SELECT * FROM Members WHERE user_id = ANY ($1) ORDER BY id, position", [msg.channel.guild.members.map(m => m.id)])).rows;
			let all = {};
			tups.forEach(t => {
				if(!all[t.user_id]) all[t.user_id] = [];
				all[t.user_id].push(t);
			});
			let extra = { 
				title: `${tups.length} total registered ${cfg.lang}s in this server`,
				author: {
					name: msg.channel.guild.name,
					icon_url: msg.channel.guild.iconURL
				}
			};
			let embeds = bot.generatePages(Object.keys(all), id => {
				let user = bot.users.get(id);
				let field = {
					name: `${user.username}#${user.discriminator} (${all[id].length} registered)`,
					value: all[id].map(tul => tul.name).join(", ")
				};
				if(field.value.length > 1000) field.value = field.value.slice(0,1000) + "...";
				return field;
			}, extra);
			if(embeds[1]) return bot.paginate(msg, embeds);
			return embeds[0];
		}

		//get target list
		let target;
		if(args[0]) {
			if(msg.channel.type == 1) return "Cannot search for members in a DM.";
			target = bot.resolveUser(msg, args.join(" "));
		} else target = msg.author;
		if(!target) return "User not found.";
		let tulpae = (await bot.db.query("SELECT * FROM Members WHERE user_id = $1 ORDER BY position", [target.id])).rows;
		if(!tulpae[0]) return (target.id == msg.author.id) ? "You have not registered any " + cfg.lang + "s." : "That user has not registered any " + cfg.lang + "s.";

		//generate paginated list with groups
		let groups = (await bot.db.query("SELECT * FROM Groups WHERE user_id = $1 ORDER BY position", [target.id])).rows;
		if(groups[0]) {
			groups.push({name: "Ungrouped", id: null});
			let embeds = [];
			for(let i=0; i<groups.length; i++) {
				let extra = {
					title: `${target.username}#${target.discriminator}'s registered ${cfg.lang}s`,
					author: {
						name: target.username, 
						icon_url: target.avatarURL
					},
					description: `Group: ${groups[i].name}${groups[i].tag ? "\nTag: " + groups[i].tag : ""}${groups[i].description ? "\n" + groups[i].description : ""}`
				};
				let add = bot.generatePages(tulpae.filter(t => t.group_id == groups[i].id), bot.generateTulpaField,extra);
				if(add[add.length-1].embed.fields.length < 5 && groups[i+1]) add[add.length-1].embed.fields.push({
					name: "\u200b",
					value: `Next page: group ${groups[i+1].name}`
				});
				embeds = embeds.concat(add);
			}
			
			for(let i=0; i<embeds.length; i++) {
				embeds[i].embed.title = `${target.username}#${target.discriminator}'s registered ${cfg.lang}s`
				if(embeds.length > 1) embeds[i].embed.title += ` (page ${i+1}/${embeds.length}, ${tulpae.length} total)`;
			}

			if(embeds[1]) return bot.paginate(msg,embeds);
			return embeds[0];
		}

		//generate paginated list
		let extra = {
			title: `${target.username}#${target.discriminator}'s registered ${cfg.lang}s`,
			author: {
				name: target.username,
				icon_url: target.avatarURL
			}
		};
		let embeds = bot.generatePages(tulpae, bot.generateTulpaField, extra);
		if(embeds[1]) return bot.paginate(msg, embeds);
		return embeds[0];
	}
};