const redis = new (require("ioredis"))(process.env.REDISURL);

module.exports = {
    redis,

    cooldowns: {
        get: async (key) =>
            await redis.get(`cooldowns/${key}`),

        set: async (key, time) =>
            await redis.set(`cooldowns/${key}`, Date.now() + time, "px", time),
        
        update: async (key, time) =>
            await redis.pexpire(`cooldowns/${key}`, time),
    },

    config: {
        // TODO: rewrite this with a hashmap
        get: async (guildID) =>
            JSON.parse(await redis.get(`config/${guildID}`)),

        set: async (guildID, config) =>
            await redis.set(`config/${guildID}`, JSON.stringify(Object.fromEntries(Object.entries(config).filter(ent => ent[1] !== null)))),

        delete: async (guildID) =>
            await redis.del(`config/${guildID}`),
    },

    blacklist: {
        get: async (channelID) =>
            await redis.hget("blacklist", channelID),

        set: async (channelID, value) =>
            await redis.hset("blacklist", channelID, value),

        delete: async (channelID) =>
            await redis.hdel("blacklist", channelID),
    },
}
