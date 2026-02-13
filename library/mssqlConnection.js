const sql = require("mssql");

exports.execute = async (database,script,connectionstring) => 
{
    try 
    {
        //debugger
        if (database != undefined) 
        {
            connectionstring.database = database;
        }

        let pool = await sql.connect(connectionstring);
        await pool.request().query(script);
        return { code: false, message: '' };

    } catch (e) 
    {
        if (e.message.indexOf('duplicate') != -1) 
        {
            return  { code: false, message: '' };
        }
        else 
        {
            console.log(script,':','error',':',e);
            return  { code: true, message: e.message };
        }
    }
}


exports.get = async (database,script,connectionstring) => 
{
    try 
    {
        if (database != undefined) 
        {
            connectionstring.database = database;
        }

        let pool = await sql.connect(connectionstring);
        let result = await pool.request().query(script);

        if (result.rowsAffected != undefined) 
        {
            if (result.rowsAffected.length > 0) 
            {
                return  { code: false, data: result.recordsets[0] };
            }
            else 
            {
                return  { code: false, data: result.recordsets[0] };
            }
        }
        else 
        {
            return  { code: false, data: [] };
        }

    } catch (e) 
    {
        debugger
        console.log(e.message);
        return  { code: true, message: e.message };
    }
}