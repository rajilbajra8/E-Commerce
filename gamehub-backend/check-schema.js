require("dotenv").config();
const db = require("./config/db");

db.query("DESCRIBE users", (err, rows) => {
    if (err) {
        console.error(err.message);
    } else {
        console.log(JSON.stringify(rows, null, 2));
    }
    process.exit();
});
