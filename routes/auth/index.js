const express = require('express');
const router = express.Router();
const auth = require('./auth')

router.post('/information', auth.authUserInformation);
router.patch('/reset-password/information', auth.resetUserInformation);

module.exports = router;