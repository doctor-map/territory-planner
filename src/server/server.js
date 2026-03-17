"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var express_1 = require("express");
var app = (0, express_1.default)();
var PORT = 3000;
app.listen(PORT, function () {
    console.log("Server is listening on port ".concat(PORT, "..."));
});
