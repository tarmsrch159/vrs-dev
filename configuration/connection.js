require('dotenv').config();

const prod = false; // Set to false for local development


const connectionStringOnProd = {
  user: "postgres",
  password: "reP@ssw0rd778900",
  host: "203.150.210.25",
  port: 5432,
  database: "tms_aos01"
}

const connectionStringOnDev = {
  user: "postgres",
  password: "reP@ssw0rd778900",
  host: "203.150.210.25",
  port: 5432,
  database: "vrs_dev"
}

// ============ Local ===========
// const connectionStringOnLocalhost = {
//   user: "tanachai_ho",
//   password: "123456",
//   host: "host.docker.internal",
//   port: 5432,
//   database: "vrs_dev"
// }

exports.prod = prod;

exports.connectionString = () => {
  return (prod == true) ? connectionStringOnProd : connectionStringOnDev;
}

exports.authWebsite = () => {
  return `Basic dG1zdjIud2Vic2l0ZTpyZVBAc3N3MHJkNzc4OTAw`;
}

exports.authMobile = () => {
  return `Basic dG1zdjIubW9iaWxlOnJlUEBzc3cwcmQ3Nzg5MDA=`;
}


exports.dbPrefix = () => {
  return ``;
}