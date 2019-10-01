db.createUser(
    {
        user: "crawler",
        pwd: "password",
        roles: [
            "readWrite"
        ]
    }
);
