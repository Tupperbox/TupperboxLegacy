module.exports = bot => {
  bot.on("guildMemberAdd", async (guild, member) => {
    /*if(bot.tulpae[member.id] && bot.config[guild.id].rolesEnabled) {
      bot.tulpae[member.id].forEach(tul => {
        bot.createRole(guild.id,{name:tul.name,mentionable:true}).then(role => member.addRole(role.id));
      });
    }*/
  });
};