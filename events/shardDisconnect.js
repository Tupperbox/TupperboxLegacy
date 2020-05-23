module.exports = async (err,id,bot) => {
	console.log(`Shard ${id} disconnected with code ${err ? err.code : "unknown"}: ${err ? err.reason : "unknown reason"}`);
};