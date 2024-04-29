const express = require('express');
const route = express.Router();
const moment = require('moment');

const db_con = require("../../../shared_config/database_con")

route.get("/rules", (req, res) => {
    res.render("pages/guides/rules.ejs")
})

route.get("/donate", (req, res) => {
    res.render("pages/guides/donate.ejs")
})
module.exports = route