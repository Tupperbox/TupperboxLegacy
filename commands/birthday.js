const {article,proper} = require("../modules/lang");

module.exports = {
	help: cfg => "View or change " + article(cfg) + " " + cfg.lang + "'s birthday, or see upcoming birthdays",
	usage: cfg =>  ["birthday [name] [date] -\n\tIf name and date are specified, set the named " + cfg.lang + "'s birthday to the date.\n\tIf name only is specified, show the " + cfg.lang + "'s birthday.\n\tIf neither are given, show the next 5 birthdays on the server."],
	desc: cfg => "Date must be given in format MM/DD/YY and are stored in UTC.",
	permitted: () => true,
	groupArgs: true,
	execute: async (bot, msg, args, cfg) => {
		let out = "";
		if(!args[0]) {
			let tulps = (await bot.db.query(`
				SELECT *, birthday + date_trunc('year', age(birthday + 1)) + interval '1 year' as anniversary FROM Members WHERE user_id = ANY($1) ORDER BY anniversary LIMIT 5;
			`, [[msg.author.id].concat(msg.channel.guild ? msg.channel.guild.members.map(m => m.id) : [])])).rows;
			if(!tulps[0])
				return bot.send(msg.channel, "No " + cfg.lang + "s on this server have birthdays set.");
			return bot.send(msg.channel, "Here are the next few upcoming " + cfg.lang + " birthdays in this server (UTC):\n" + tulps.map(t => (bot.checkTulpaBirthday(t) ? `${t.name}: Birthday today! \uD83C\uDF70` : `${t.name}: ${t.anniversary.toLocaleDateString("en-US",{timeZone:"UTC"})}`)).join("\n"));
		}
		let tulpa = await bot.db.getTulpa(msg.author.id,args[0]);
		if(!tulpa) {
			out = "You don't have " + article(cfg) + " " + cfg.lang + " with that name registered.";
		} else if(!args[1]) {
			out = tulpa.birthday ? tulpa.birthday.toDateString() : "No birthday currently set for " + args[0];
		} else if(!(new Date(args[1]).getTime())) {
			out = "I can't understand that date. Please enter in the form MM/DD/YYYY with no spaces.";
		} else {
			let date = new Date(args[1]);
			await bot.db.updateTulpa(msg.author.id,args[0],"birthday",date);
			out = `${proper(cfg.lang)} '${args[0]}' birthday set to ${date.toDateString()}.`;
		}
		bot.send(msg.channel, out);
	}
};