const {article,proper} = require("../modules/lang");

module.exports = {
	help: cfg => "View or change " + article(cfg) + " " + cfg.lang + "'s birthday, or see upcoming birthdays",
	usage: cfg =>  ["birthday [name] [date] -\n\tIf name and date are specified, set the named " + cfg.lang + "'s birthday to the date.\n\tIf name only is specified, show the " + cfg.lang + "'s birthday.\n\tIf neither are given, show the next 5 birthdays on the server.",
					"birthday [name] clear/remove/none/delete - Unset a birthday for the given " + cfg.lang + "."],
	desc: cfg => "Date must be given in format MM/DD/YY and are stored in UTC.",
	permitted: () => true,
	groupArgs: true,
	execute: async (bot, msg, args, cfg) => {
		//give next 5 birthdays
		if(!args[0]) {
			let tulps = (await bot.db.query(`SELECT *, birthday + date_trunc('year', age(birthday + 1)) + interval '1 year' as anniversary FROM Members WHERE user_id = ANY($1) ORDER BY anniversary LIMIT 5;`, [[msg.author.id].concat(msg.channel.guild ? msg.channel.guild.members.map(m => m.id) : [])])).rows.filter(t => t.anniversary != null);
			if(!tulps[0]) return "No " + cfg.lang + "s on this server have birthdays set.";
			return "Here are the next few upcoming " + cfg.lang + " birthdays in this server (UTC):\n" + tulps.map(t => (bot.checkTulpaBirthday(t) ? `${t.name}: Birthday today! \uD83C\uDF70` : `${t.name}: ${t.anniversary.toLocaleDateString("en-US",{timeZone:"UTC"})}`)).join("\n");
		}

		//check arguments
		let tulpa = await bot.db.getTulpa(msg.author.id,args[0]);
		if(!tulpa) return "You don't have " + article(cfg) + " " + cfg.lang + " with that name registered.";
		if(!args[1]) return tulpa.birthday ? "Current birthday: " + tulpa.birthday.toDateString() + "\nTo remove it, try " + cfg.prefix + "birthday " + tulpa.name + " clear" : "No birthday currently set for " + args[0];
		if(["clear","remove","none","delete"].includes(args[1])) {
			await bot.db.updateTulpa(msg.author.id,tulpa.name,"birthday",null);
			return "Birthday cleared.";
		}
		if(!(new Date(args[1]).getTime())) return "I can't understand that date. Please enter in the form MM/DD/YYYY with no spaces.";

		//update tulpa
		let date = new Date(args[1]);
		await bot.db.updateTulpa(msg.author.id,args[0],"birthday",date);
		return `${proper(cfg.lang)} '${args[0]}' birthday set to ${date.toDateString()}.`;
	}
};