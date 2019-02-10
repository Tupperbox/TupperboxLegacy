module.exports = (guild,bot) => {
	bot.db.deleteCfg(guild.id);
};