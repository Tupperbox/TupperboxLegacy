module.exports = {
	help: cfg => "Get a detailed list of yours or another user's registered " + cfg.lang + "s",
	usage: cfg =>  ["list [user] - Sends a list of the user's registered " + cfg.lang + "s, their brackets, post count, and birthday (if set). If user is not specified it defaults to the message author.\nThe bot will provide reaction emoji controls for navigating long lists: Arrows navigate through pages, # jumps to a specific page, ABCD jumps to a specific " + cfg.lang + ", and the stop button deletes the message."],
	permitted: () => true,
	cooldown: msg => 60000,
	execute: async (bot, msg, args, cfg, _members, ng = false) => {

		//get target list
		let target;
		if(args[0]) {
			if(msg.channel.type == 1) return "Cannot search for members in a DM.";
			target = await bot.resolveUser(msg, args.join(" "));
		} else target = msg.author;
		if(!target) return "User not found.";

		//generate paginated list with groups
		let groups = (await bot.db.query("SELECT * FROM Groups WHERE user_id = $1 ORDER BY position", [target.id])).rows;
		if(groups[0] && !ng) {
			let members = (await bot.db.query("SELECT * FROM Members WHERE user_id = $1 ORDER BY group_pos, position", [target.id])).rows;
			if(!members[0]) return (target.id == msg.author.id) ? "You have not registered any " + cfg.lang + "s." : "That user has not registered any " + cfg.lang + "s.";
			if(members.find(t => !t.group_id)) groups.push({name: "Ungrouped", id: null});
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
				let add = await bot.generatePages(members.filter(t => t.group_id == groups[i].id), t => bot.generateMemberField(t),extra);
				if(add[add.length-1].embed.fields.length < 5 && groups[i+1]) add[add.length-1].embed.fields.push({
					name: "\u200b",
					value: `Next page: group ${groups[i+1].name}`
				});
				embeds = embeds.concat(add);
			}
			
			for(let i=0; i<embeds.length; i++) {
				embeds[i].embed.title = `${target.username}#${target.discriminator}'s registered ${cfg.lang}s`;
				if(embeds.length > 1) embeds[i].embed.title += ` (page ${i+1}/${embeds.length}, ${members.length} total)`;
			}

			if(embeds[1]) return bot.paginate(msg,embeds);
			return embeds[0];
		}
		let members = (await bot.db.query("SELECT * FROM Members WHERE user_id = $1 ORDER BY position", [target.id])).rows;
		if(!members[0]) return (target.id == msg.author.id) ? "You have not registered any " + cfg.lang + "s." : "That user has not registered any " + cfg.lang + "s.";

		//generate paginated list
		let extra = {
			title: `${target.username}#${target.discriminator}'s registered ${cfg.lang}s`,
			author: {
				name: target.username,
				icon_url: target.avatarURL
			}
		};
		
		let embeds = await bot.generatePages(members, async t => {
			let group = null;
			if(t.group_id) group = (await bot.db.query("SELECT name FROM Groups WHERE id = $1",[t.group_id])).rows[0];
			return bot.generateMemberField(t,group);
		}, extra);
		if(embeds[1]) return bot.paginate(msg, embeds);
		return embeds[0];
	}
};
