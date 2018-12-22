module.exports = bot => {
	bot.on("guildCreate", guild => bot.validateGuildCfg(guild));
};