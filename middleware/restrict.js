var authConfiguration = require('../configuration/connection');
module.exports = async (req, res, next) => {
  debugger
  if (req.url.toString().indexOf('/source/?image=') != -1 || req.url.toString().indexOf('/favicon.ico') != -1) {
    return next(); // No error proceed to next middleware
  } else if (req.headers.authorization == authConfiguration.authWebsite() || req.headers.authorization == authConfiguration.authMobile()) {
    return next(); // No error proceed to next middleware
  } else {
    const err = new Error("Not authorized! Go back!");
    err.status = 403;
    return next(err); // This will be caught by error handler
  }
};


