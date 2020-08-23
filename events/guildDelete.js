module.exports = (guild,bot) => {
	bot.db.config.delete(guild.id);
};