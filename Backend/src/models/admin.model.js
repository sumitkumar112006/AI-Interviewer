const userModel = require('./user.model');

// Single-table user architecture: All users and administrators are stored in userModel (users collection)
module.exports = userModel;
