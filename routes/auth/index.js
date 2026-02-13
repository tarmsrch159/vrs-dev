const express = require('express');
const router = express.Router();
const auth = require('./auth')

router.post('/information', auth.authEmployeeInformation);
router.post('/reset/information', auth.resetEmployeeInformation);

module.exports = router;