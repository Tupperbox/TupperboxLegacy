const {article,proper} = require("../modules/lang");

module.exports = {
	help: cfg => "Find and display info about " + cfg.lang + "s by name",
	usage: cfg =>  ["find <name> - Attempts to find " + article(cfg) + " " + cfg.lang + " with exactly the given name, and if none are found, tries to find " + cfg.lang + "s with names containing the given name."],
	permitted: (msg) => true,
	groupArgs: true,
	execute: async (bot, msg, args, cfg) => {
		if(!args[0]) return bot.cmds.help.execute(bot, msg, ["find"], cfg);

		//do search
		let search = args.join(" ").toLowerCase();
		let targets; 
		if(msg.channel.type == 1)
			targets = [msg.author];
		else {
			targets = await bot.findAllUsers(msg.channel.guild.id);
		}
		let results = (await bot.db.query("SELECT * FROM Members WHERE user_id IN (select(unnest($1::text[]))) AND (CASE WHEN tag IS NULL THEN LOWER(name) LIKE '%' || $2 || '%' ELSE (LOWER(name) || LOWER(tag)) LIKE '%' || $2 || '%' END) LIMIT 25",[targets.map(u => u.id),search])).rows;
		if(!results[0]) return "Couldn't find " + article(cfg) + " " + cfg.lang + " with that name.";

		//return single match
		if(results.length == 1) { 
			let t = results[0];
			let host = targets.find(u => u.id == t.user_id);
			let group = null;
			if(t.group_id) group = bot.db.groups.getById(t.group_id);
			let val = `User: ${host ? host.username + "#" + host.discriminator : "Unknown user " + t.user_id}\n`;
			let embed = { embed: {
				author: {
					name: t.name,
					icon_url: t.url
				},
				description: val + bot.paginator.generateMemberField(bot, t,group,val.length).value,
			}};
			return embed;
		}

		//build paginated list of results
		let embeds = [];
		let current = { embed: {
			title: "Results",
			fields: []
		}};
		for(let i=0; i<results.length; i++) {
			let t = results[i];
			if(current.embed.fields.length >= 5) {
				embeds.push(current);
				current = { embed: {
					title: "Results",
					fields: []
				}};
			}
			let group = null;
			if(t.group_id) group = await bot.db.groups.getById(t.group_id);
			let host = targets.find(u => u.id == t.user_id);
			let val = `User: ${host ? host.username + "#" + host.discriminator : "Unknown user " + t.user_id}\n`;
			current.embed.fields.push({name: t.name, value: val + bot.paginator.generateMemberField(bot, t,group,val.length).value});
		}

		embeds.push(current);
		if(embeds.length > 1) {
			for(let i = 0; i < embeds.length; i++)
				embeds[i].embed.title += ` (page ${i+1}/${embeds.length} of ${results.length} results)`;
			return bot.paginator.paginate(bot, msg, embeds);
		}
		return embeds[0];
	}
};
