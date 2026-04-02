require('dotenv').config();

const prod = process.env.NODE_ENV === 'production';

const connectionStringOnProd = {
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "reP@ssw0rd778900",
  host: process.env.DB_HOST || "203.150.210.25",
  port: parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || "tms_aos01"
}

const connectionStringOnLocalhost = {
  user: process.env.DB_USER || "tanachai_ho",
  password: process.env.DB_PASSWORD || "123456",
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || "vrs_dev"
}

exports.connectionString = () => {
  return (prod == true) ? connectionStringOnProd : connectionStringOnLocalhost;
}

exports.authWebsite = () => {
  return process.env.AUTH_WEBSITE || `Basic dG1zdjIud2Vic2l0ZTpyZVBAc3N3MHJkNzc4OTAw`;
}

exports.authMobile = () => {
  return process.env.AUTH_MOBILE || `Basic dG1zdjIubW9iaWxlOnJlUEBzc3cwcmQ3Nzg5MDA=`;
}

exports.dbPrefix = () => {
  return process.env.DB_PREFIX || `tms_`;
}