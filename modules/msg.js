
module.exports = async (bot,msg,edit) => {

    if(msg.author.bot || msg.type != 0) return;
    if(msg.channel.guild && bot.blacklist.includes(msg.channel.guild.id)) return;
    if(await bot.db.getGlobalBlacklisted(msg.author.id)) return;

    let blacklist = await bot.db.blacklist.get(msg.channel);
    let cfg = msg.channel.guild ? (await bot.db.config.get(msg.channel.guild.id) ?? { ...bot.defaultCfg }) : { ...bot.defaultCfg };
    let members = await bot.db.members.getAll(msg.author.id);

    let permissions;
    let dmChannel;

    if (msg.guild) {
        permissions = msg.channel.permissionsOf(bot.user.id);
        if(!permissions.has("readMessages")) return;
        if (!permissions.has("sendMessages")) {
            try { dmChannel = await bot.getDMChannel(msg.author.id); } 
            catch(e) { if(e.code != 50007) bot.err(msg,e,false); return; }
        }
    }

    if (!edit && ((blacklist & 1 || msg.member.permission.has("manageGuild")) ? await bot.cmd({ msg, bot, members, cfg, dmChannel}) : false)) return;
    if (members[0] && !(blacklist & 2) && msg.channel.guild && !dmChannel && !msg.content.startsWith(cfg.prefix)) bot.proxy.executeProxy({ msg, bot, members, cfg });

}