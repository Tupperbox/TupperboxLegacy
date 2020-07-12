module.exports = {
	help: cfg => "Export your data to a file",
	usage: cfg =>  ["export [name] - Get a .json file of your data that you can import to compatible bots. If a name is specified, will export only that " + cfg.lang + "."],
	permitted: () => true,
	groupArgs: true,
	cooldown: msg => 600000,
	execute: async (bot, msg, args, cfg) => {
		let data;
		if(!args[0]) {
			let tups = (await bot.db.query("SELECT name, avatar_url, brackets, posts, show_brackets, birthday, description, tag, group_id, group_pos FROM Members WHERE user_id = $1 ORDER BY position", [msg.author.id])).rows;
			let groups = (await bot.db.query("SELECT id, name, description, tag FROM Groups WHERE user_id = $1 ORDER BY position",[msg.author.id])).rows;
			data = { tuppers: tups, groups };
		} else {
			let tup = (await bot.db.query("SELECT name, avatar_url, brackets, posts, show_brackets, birthday, description, tag, group_id, group_pos FROM Members WHERE user_id = $1 AND LOWER(name) = LOWER($2)", [msg.author.id, args.join(" ")])).rows[0];
			if(!tup) return "You don't have a registered " + cfg.lang + " with that name.";
			data = { tuppers: [tup], groups: []};
		}
		try {
			let channel = await msg.author.getDMChannel(); //get the user's DM channel
			await bot.send(channel,"",{name:"tuppers.json",file:Buffer.from(JSON.stringify(data))}); //send it to them in DMs
			return "Sent you a DM!";
		} catch (e) {
			return bot.send(msg.channel,"I couldn't access your DMs; sending publicly: ",{name:"tuppers.json",file:Buffer.from(JSON.stringify(data))});
		}
	}
};
