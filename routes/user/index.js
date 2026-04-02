const express = require("express");
const router = express.Router();
const user = require("./user");
const userGroup = require("./user-group");

//user
router.post("/information", user.getUserInformation);
router.delete("/information", user.removeUser);
router.patch("/information", user.setUserInformation);
router.patch("/password/information", user.setUserPasswordInformation);
router.put("/information", user.addUserInformation);

//user-group
router.post("/group/information", userGroup.getGroupInformation);
router.delete("/group/information", userGroup.removeGroup);
router.patch("/group/information", userGroup.setGroupInformation);
router.put("/group/information", userGroup.addGroupInformation);

module.exports = router;
