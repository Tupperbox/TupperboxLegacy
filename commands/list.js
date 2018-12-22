module.exports = {
		help: cfg => "Get a detailed list of yours or another user's registered " + cfg.lang + "s",
		usage: cfg =>  ["list [user] - Sends a list of the user's registered " + cfg.lang + "s, their brackets, post count, and birthday (if set). If user is not specified it defaults to the message author. If 'all' or '*' is given, gives a short form list of all tuppers in the server."],
		permitted: () => true,
		execute: (bot, msg, args, cfg) => {
			let out = "";
			if(args[0] == "all" || args[0] == "*") { //short list of all tuppers
				let tups = msg.channel.guild.members.filter(m => bot.tulpae[m.id] && bot.tulpae[m.id].length > 0).map(m => bot.tulpae[m.id]);

				let embeds = [];
				let current = { embed: {
					title: `${tups.reduce((acc,val) => acc+val.length,0)} total registered ${cfg.lang}s in this server`,
					author: {
						name: msg.channel.guild.name,
						icon_url: msg.channel.guild.iconURL
					},
					fields: []
				}};
				let page = 1;
				tups.forEach(t => {
					let user = bot.users.get(t[0].host);
					let field = {
						name: `${user.username}#${user.discriminator}`,
						value: t.map(tul => tul.name).join(', ')
					};
					if(current.embed.fields.length < 5) {
						current.embed.fields.push(field);
					} else {
						embeds.push(current);
						page++;
						current = { embed: {
							title: `${tups.reduce((acc,val) => acc+val.length,0)} total registered ${cfg.lang}s in this server`,
							author: {
								name: msg.channel.guild.name,
								icon_url: msg.channel.guild.iconURL
							},
							fields: []
						}};
					}
				});
				embeds.push(current);
				out = embeds[0];
				if(page > 1) {
					for(let i = 0; i < embeds.length; i++)
						embeds[i].embed.title += ` (page ${i+1}/${embeds.length})`
					return bot.paginate(msg, embeds);
				}
				return bot.send(msg.channel, out);
			}
			let target;
			if(args[0]) {
				if(msg.channel.type == 1) return send(msg.channel,"Cannot search for members in a DM.");
				else target = bot.resolveUser(msg, args.join(" "));
			} else {
				target = msg.author;
			}
			if(!target) {
				out = "User not found.";
			} else if(!bot.tulpae[target.id]) {
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
				}};
				let page = 1;
				bot.tulpae[target.id].forEach(t => {
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
						}};
					}
				});
				embeds.push(current);
				out = embeds[0];
				if(page > 1) {
					for(let i = 0; i < embeds.length; i++)
						embeds[i].embed.title += ` (page ${i+1}/${embeds.length}, ${bot.tulpae[target.id].length} total)`
					return bot.paginate(msg, embeds);
				}
				
			}
			bot.send(msg.channel, out);
		}
	};