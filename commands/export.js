module.exports = {
	help: cfg => "Export your data to a file",
	usage: cfg =>  ["export - Get a .json file of your data that you can import to compatible bots"],
	permitted: () => true,
	execute: async (bot, msg, args, cfg) => {
		let tups = (await bot.db.query('SELECT name, avatar_url, brackets, posts, show_brackets, birthday, description, tag, group_id, group_pos FROM Members WHERE user_id = $1 ORDER BY position', [msg.author.id])).rows;
		let groups = (await bot.db.query('SELECT id, name, description, tag FROM Groups WHERE user_id = $1 ORDER BY position',[msg.author.id])).rows;
		let data = { tuppers: tups, groups };
		try {
			let channel = await msg.author.getDMChannel(); //get the user's DM channel
			return await bot.send(channel,"",{name:"tuppers.json",file:Buffer.from(JSON.stringify(data))}); //send it to them in DMs
		} catch (e) {
			return bot.send(msg.channel,"I couldn't access your DMs; sending publicly: ",{name:"tuppers.json",file:Buffer.from(JSON.stringify(data))});
		}
	}
};
