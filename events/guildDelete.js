module.exports = (guild,bot) => {
	console.log("Removed from guild " + guild.id + ", deleting config data!");
	bot.db.deleteCfg(guild.id);
};