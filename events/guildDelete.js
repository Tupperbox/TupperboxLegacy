module.exports = bot => {
  bot.on("guildDelete", guild => {
    console.log("Removed from guild " + guild.id + ", deleting config data!");
    delete bot.config[guild.id];
  });
};