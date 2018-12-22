module.exports = bot => {
  bot.on("guildMemberRemove", (guild, member) => {
    /*if(bot.tulpae[member.id] && bot.config[guild.id].rolesEnabled) {
      bot.tulpae[member.id].filter(t => t.roles && t.roles[guild.id]).forEach(tul => {
        bot.deleteRole(guild.id,tul.roles[guild.id]);
        delete tul.roles[guild.id];
        if(Object.keys(tul.roles).length == 0) delete tul.roles;
      });
    }*/
  });
};