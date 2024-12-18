const {Pool} = require('pg');


const pool = new Pool ({
    user: 'postgres',  
    host: 'localhost',  
    database: 'postgres',  
    password: 'postgres',  
    port: 5432,  
    ssl: false,  
})

module.exports= pool;