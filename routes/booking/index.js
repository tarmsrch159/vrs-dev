const express = require("express");
const router = express.Router();
const booking = require("./booking");
const bookingApprove = require("./booking-approve");

// booking
router.post("/information", booking.getBookingInformation);
router.put("/information", booking.addBookingInformation);
router.patch("/information", booking.setBookingInformation);

// booking approve
router.post("/approve/information", bookingApprove.getBookingApproveInformation);
router.patch("/approve/information", bookingApprove.setBookingApproveInformation);

module.exports = router;
