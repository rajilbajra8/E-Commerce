require("dotenv").config();
const db = require("./config/db");

db.query(
    "SELECT email, role, CASE WHEN password LIKE '$2%' THEN 'bcrypt' ELSE 'plain' END AS pwd_type FROM users LIMIT 10",
    (err, rows) => {
        if (err) {
            console.error(err.message);
        } else {
            console.log(JSON.stringify(rows, null, 2));
        }
        process.exit();
    }
);
