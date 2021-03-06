// Redis Local and Cloud Databases. Local Redis used for cache.
const toBoolean = require('to-boolean');
const Redis = require("redis")                                                                                                               
const {promisifyAll} = require('bluebird');
promisifyAll(Redis);            

const redisLocal = Redis.createClient(process.env.REDIS_LOCAL_PORT || 6379)
const redisCloud = Redis.createClient({
    port: process.env.REDIS_CLOUD_PORT,         
    host: process.env.REDIS_CLOUD_HOST,            
})       

redisLocal.on("error", err => {
    console.log("     Error Connecting to Redis! - Install redis then run 'redis-server' to start the redis server!.\n\
        Error: " + err+"\n");
})
redisCloud.auth(process.env.REDIS_CLOUD_PASSWD, (err, res)=>{ if(err) console.log("Couldnt connect to Redis Cloud. Err: "+err)})

// These functions combines calls to local and cloud versions redis databases. Using Local Redis for quick cache and cloud redis as the key value database. Redis local keeps data cached, redis cloud. 
class RedisFunctions{
    set = async (key, value, exp, onlyCache = false)=>{                                       // usage: await redis.set(...)
        if (typeof(value) !== "string"){                                                            // Redis v6 automatically turned values to strings using .toString() so i had to add this to make suer JSON data is stringified.            
            try{   value = JSON.stringify(value)}
            catch{ value = value.toString()}
        }
        await redisLocal.setAsync(key, value, 'EX', exp)  
        if (!onlyCache && !toBoolean(process.env.DEV_MODE))                                      
            redisCloud.setAsync(key, value, 'EX', exp)                                     
    }
    get = async (key)=>{                                                                    
        let val
        try{
            val = await redisLocal.getAsync(key)                                                    // Get from local version of redis sine it could be cached, if cant, get from cloud and then cache it
        } catch(err){
            if (!toBoolean(process.env.DEV_MODE))
                throw err
            val = await redisCloud.getAsync(key)   
            await redisLocal.setAsync(key, val, 'EX', 86400)                                        // Not in local cache so getting from cloud and caching for a day                              
        }     
        return val  
    }
    exists = async(key)=>{                                                             
        let val = await redisLocal.existsAsync(key)
        if (!val && !toBoolean(process.env.DEV_MODE))
            val = await redisCloud.existsAsync(key)
        return val
    }
    del = async(key)=>{ 
        if (!toBoolean(process.env.DEV_MODE)) 
            redisCloud.del(key)                                  
        await redisLocal.del(key)
    }
}
// const redis = new RedisFunctions()
module.exports = {
    redis: new RedisFunctions(),
}
