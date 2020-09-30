module.exports = {
	help: cfg => "Export your data to a file",
	usage: cfg =>  ["export [name] - Get a .json file of your data that you can import to compatible bots. If a name is specified, will export only that " + cfg.lang + "."],
	permitted: () => true,
	groupArgs: true,
	cooldown: msg => 600000,
	execute: async (bot, msg, args, cfg, members) => {
		let data = { tuppers: [], groups: []};
		if(!args[0]) data = { tuppers: members, groups: (await bot.db.groups.getAll(msg.author.id)) };			
		else {
			for (let arg of args) {
				let tup = await bot.db.members.get(msg.author.id, arg);
				if(!tup) return `You don't have a registered ${cfg.lang} with the name '${arg}'.`;
				data.tuppers.push(tup);
			}
		}
		if(data.tuppers.length == 0 && data.groups.length == 0) return "You don't have anything to export.";
		try {
			let channel = await msg.author.getDMChannel(); //get the user's DM channel
			let exportMsg = await bot.send(channel,"",{name:`tuppers.json`,file:Buffer.from(JSON.stringify(data))}); //send it to them in DMs
			await bot.send(channel, `<${exportMsg.attachments[0].url}>`);
			if (msg.channel.guild) return "Sent you a DM!";
		} catch (e) {
			if (e.code != 50007) throw e;
			return `<${(await bot.send(msg.channel,"I couldn't access your DMs; sending publicly: ",{name:"tuppers.json",file:Buffer.from(JSON.stringify(data))})).attachments[0].url}>`;
		}
	}
};
