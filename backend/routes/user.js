const express = require("express");
const zod = require("zod");
const { User, Account } = require("../db");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const { authMiddleware } = require("../middleware");

const router = express.Router();

// USER SIGN UP

const signupBody = zod.object({
  username: zod.string().email(),
  firstName: zod.string(),
  lastName: zod.string(),
  password: zod.string(),
});

router.post("/signup", async (req, res) => {
  const { success } = signupBody.safeParse(req.body);
  if (!success) {
    return res.status(411).json({
      message: "Incorrect inputs",
    });
  }

  const existingUser = await User.findOne({
    username: req.body.username,
  });

  if (existingUser) {
    return res.status(411).json({
      message: "Email already taken",
    });
  }

  const { username, firstName, lastName, password } = req.body;

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hashSync(password, salt);
  const newUser = await User.create({
    username,
    firstName,
    lastName,
    password: hashedPassword,
  });
  const userId = newUser._id;

  // ----- Create new account ------

  await Account.create({
    userId,
    balance: parseInt(Math.random() * 10000),
  });

  // -----  -----

  const token = jwt.sign(
    {
      userId,
    },
    process.env.JWT_SECRET
  );

  res.status(200).json({
    message: "User created successfully",
    token: token,
  });
});

// USER SIGN IN

const signinBody = zod.object({
  username: zod.string().email(),
  password: zod.string(),
});

router.post("/signin", async (req, res) => {
  const { success } = signinBody.safeParse(req.body);
  if (!success) {
    return res.status(411).json({
      message: "Incorrect inputs",
    });
  }

  const user = await User.findOne({
    username: req.body.username,
  });

  if (!user) {
    return res.status(404).json("User not found!");
  }

  if (user) {
    const match = await bcrypt.compare(req.body.password, user.password);
    if (!match) {
      return res.status(401).json("Wrong credentials!");
    }

    const token = jwt.sign(
      {
        userId: user._id,
      },
      process.env.JWT_SECRET
    );

    res.status(200).json({
      token: token,
    });
    return;
  }
});

// FOR UPDATING USER INFO

const updateBody = zod.object({
  password: zod.string().optional(),
  firstName: zod.string().optional(),
  lastName: zod.string().optional(),
});

router.put("/", authMiddleware, async (req, res) => {
  const { success } = updateBody.safeParse(req.body);
  if (!success) {
    res.status(411).json({
      message: "Error while updating information",
    });
  }

  await User.updateOne({ _id: req.userId }, req.body);

  res.json({
    message: "Updated successfully",
  });
});

// FOR GETTING USERS WITH FILTER QUERY

router.get("/bulk", async (req, res) => {
  const filter = req.query.filter || "";

  const users = await User.find({
    $or: [
      {
        firstName: {
          $regex: filter,
        },
      },
      {
        lastName: {
          $regex: filter,
        },
      },
    ],
  });

  res.json({
    user: users.map((user) => ({
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      _id: user._id,
    })),
  });
});

// FOR GETTING CURRENT USER INFO

router.get("/getUser", authMiddleware, async (req, res) => {
  const user = await User.findOne({
    _id: req.userId,
  });
  res.json(user);
});

module.exports = router;
