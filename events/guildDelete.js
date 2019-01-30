module.exports = (guild,bot) => {
	console.log("Removed from guild " + guild.id + ", deleting config data!");
	delete bot.config[guild.id];
};